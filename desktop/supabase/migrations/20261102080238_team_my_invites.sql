-- Custom migration: the invitee's side of a team invite (product audit run 2, 2026-11-02).
-- An invited person could not see or accept an invite in the app: RLS lets them read the
-- invite row but not the team's name, and no screen called `team_accept`. This lists the
-- caller's own pending, unexpired invites, matched on the caller's VERIFIED email, with the
-- team name and the inviter's email. Acceptance stays in `team_accept`, which re-checks all of it.
create or replace function public.team_my_invites(p_actor uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'invite_id', x.id, 'team_name', x.team_name, 'invited_by', x.invited_by, 'expires_at', x.expires_at)
         order by x.created_at desc), '[]'::jsonb)
    from (
      select i.id, t.name as team_name, i.expires_at, i.created_at,
             (select p.email from public.profiles p where p.id = i.invited_by) as invited_by
        from public.team_invites i
        join public.teams t on t.id = i.team_id
        join public.profiles me on me.id = p_actor
        join auth.users u on u.id = p_actor and u.email_confirmed_at is not null
       where i.email = me.email
         and i.accepted_at is null
         and i.expires_at > now()
       order by i.created_at desc
       limit 20
    ) x;
$$;
--> statement-breakpoint
revoke all on function public.team_my_invites(uuid) from public, anon, authenticated, service_role;
--> statement-breakpoint
grant execute on function public.team_my_invites(uuid) to service_role;
