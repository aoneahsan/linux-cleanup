-- Custom migration: price and apply Polar orders. Called only by the polar-webhook Edge
-- Function (service role) after the signature is verified. The ORDER IS PRICED HERE
-- against the plans row: a subtotal that differs from plan price x seats is recorded as a
-- mismatch and grants nothing. A paid period EXTENDS the user's current time on that
-- plan, never overwrites it. A returned payment ends exactly the period it paid for.
set check_function_bodies = off;

create or replace function public.apply_paid_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id text := p_order ->> 'order_id';
  v_user uuid := nullif(p_order ->> 'user_id', '')::uuid;
  v_interval public.billing_interval := (p_order ->> 'interval')::public.billing_interval;
  v_seats integer := coalesce((p_order ->> 'seats')::integer, 1);
  v_subtotal integer := (p_order ->> 'subtotal_cents')::integer;
  v_currency text := lower(coalesce(p_order ->> 'currency', 'usd'));
  v_plan public.plans%rowtype;
  v_expected integer;
  v_team uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_sub uuid;
begin
  if exists (select 1 from public.subscriptions s where s.polar_order_id = v_order_id) then
    return jsonb_build_object('result', 'duplicate');
  end if;
  if v_user is null or not exists (select 1 from public.profiles p where p.id = v_user) then
    return jsonb_build_object('result', 'unknown_user');
  end if;
  select * into v_plan from public.plans where id = p_order ->> 'plan_id';
  if v_plan.id is null or v_interval is null then
    return jsonb_build_object('result', 'unknown_plan');
  end if;

  v_seats := case when v_plan.per_seat then v_seats else 1 end;
  v_expected := (case v_interval when 'month' then v_plan.price_month_cents else v_plan.price_year_cents end) * v_seats;
  if v_expected <= 0 or v_currency <> 'usd' or v_subtotal is distinct from v_expected
     or (v_plan.per_seat and v_seats < v_plan.min_seats) then
    perform private.audit(null, 'billing.mismatch', 'order', v_order_id, v_user,
      jsonb_build_object('expected_cents', v_expected, 'subtotal_cents', v_subtotal,
                         'currency', v_currency, 'seats', v_seats, 'plan', v_plan.id));
    return jsonb_build_object('result', 'price_mismatch', 'expected_cents', v_expected);
  end if;

  if v_plan.per_seat then
    select t.id into v_team from public.teams t where t.owner_id = v_user;
    if v_team is null then
      insert into public.teams (name, owner_id, seats) values ('My team', v_user, v_seats) returning id into v_team;
      insert into public.team_members (team_id, user_id, role) values (v_team, v_user, 'owner')
      on conflict do nothing;
    else
      update public.teams set seats = v_seats where id = v_team;
    end if;
  end if;

  -- Extend: start where this user's current paid time on the same plan ends.
  select greatest(now(), coalesce(max(s.period_end), now())) into v_start
    from public.subscriptions s
   where s.user_id = v_user and s.plan_id = v_plan.id and s.status = 'active' and s.period_end > now();
  v_end := v_start + case v_interval when 'month' then interval '1 month' else interval '1 year' end;

  insert into public.subscriptions (user_id, plan_id, team_id, interval, seats, status, period_start,
    period_end, amount_cents, currency, polar_order_id, polar_subscription_id, polar_customer_id)
  values (v_user, v_plan.id, v_team, v_interval, v_seats, 'active', v_start, v_end, v_subtotal,
    v_currency, v_order_id, p_order ->> 'polar_subscription_id', p_order ->> 'polar_customer_id')
  returning id into v_sub;

  perform private.audit(null, 'billing.paid', 'subscription', v_sub::text, v_user,
    jsonb_build_object('plan', v_plan.id, 'interval', v_interval, 'seats', v_seats,
                       'amount_cents', v_subtotal, 'order_id', v_order_id));

  return jsonb_build_object('result', 'granted', 'subscription_id', v_sub, 'user_id', v_user,
    'plan_name', v_plan.name, 'interval', v_interval, 'seats', v_seats, 'amount_cents', v_subtotal,
    'currency', v_currency, 'period_start', v_start, 'period_end', v_end);
end;
$$;

/** A payment the bank or Polar returned ends the period it paid for. Never a refund we offer. */
create or replace function public.apply_returned_order(p_order_id text, p_returned_cents integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_plan_name text;
begin
  select * into v_sub from public.subscriptions s where s.polar_order_id = p_order_id for update;
  if v_sub.id is null then
    return jsonb_build_object('result', 'unknown_order');
  end if;
  if v_sub.status = 'returned' then
    return jsonb_build_object('result', 'duplicate');
  end if;

  update public.subscriptions set status = 'returned', ended_at = now() where id = v_sub.id;
  select p.name into v_plan_name from public.plans p where p.id = v_sub.plan_id;

  perform private.audit(null, 'billing.returned', 'subscription', v_sub.id::text, v_sub.user_id,
    jsonb_build_object('order_id', p_order_id, 'returned_cents', p_returned_cents));

  return jsonb_build_object('result', 'returned', 'user_id', v_sub.user_id, 'plan_name', v_plan_name,
    'interval', v_sub.interval, 'returned_cents', coalesce(p_returned_cents, v_sub.amount_cents),
    'currency', v_sub.currency,
    'plan_now', (select p.name from public.plans p where p.id = private.effective_plan_id(v_sub.user_id)));
end;
$$;

revoke execute on function public.apply_paid_order(jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.apply_returned_order(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.apply_paid_order(jsonb) to service_role;
grant execute on function public.apply_returned_order(text, integer) to service_role;
