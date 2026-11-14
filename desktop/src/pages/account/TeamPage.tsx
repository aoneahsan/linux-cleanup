import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, FieldError, Form, Input, Label, TextField } from 'react-aria-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLink, Btn, PageHead, Panel, StateCard } from '@/components/ui/primitives';
import { AccountsOff } from '@/components/states/NotInApp';
import { useT, translate } from '@/i18n';
import { env, missingSupabaseVars } from '@/config/env';
import { useSession } from '@/stores/session';
import { callFunction, hasCode } from '@/services/account';
import { useState } from 'react';
import { toast } from '@/lib/feedback';
import { TeamInvitation } from '@/pages/account/TeamInvitation';

interface Fleet {
  team: { id: string; name: string; seats: number } | null;
  members: { user_id: string; email: string; role: 'owner' | 'member'; status: string }[];
  invites: { id: string; email: string; status: string; created_at: string }[];
  totals: { machines: number; quiet_machines: number };
}

const inviteSchema = z.object({ email: z.email({ error: () => translate('account.team.emailError') }).max(254) });
const createSchema = z.object({ name: z.string().trim().min(1).max(80) });
const msg = (e: unknown) => translate('account.team.failed', { message: e instanceof Error ? e.message : String(e) });

/** Team: fleet totals from run numbers only, members, invites (branded email from the backend). */
export default function TeamPage() {
  const t = useT();
  const qc = useQueryClient();
  const { signedIn, plan } = useSession();
  const fleet = useQuery({
    queryKey: ['team-fleet'],
    enabled: env.accountsConfigured && signedIn && plan === 'team',
    retry: 0,
    queryFn: () => callFunction<Fleet>('team', { body: { action: 'fleet' } }),
  });
  const [needsPlan, setNeedsPlan] = useState(false);
  const done = () => void qc.invalidateQueries({ queryKey: ['team-fleet'] });
  const onTeamError = (e: unknown) => (hasCode(e, 'plan_required') ? setNeedsPlan(true) : toast(msg(e)));
  const invite = useMutation({
    mutationFn: (email: string) => callFunction<{ invite_id: string; email_sent: boolean }>('team', { body: { action: 'invite', email } }),
    onSuccess: done,
    onError: onTeamError,
  });
  const remove = useMutation({
    mutationFn: (b: { user_id?: string; invite_id?: string }) => callFunction('team', { body: { action: 'remove', ...b } }),
    onSuccess: done, onError: (e) => toast(msg(e)),
  });
  const create = useMutation({ mutationFn: (name: string) => callFunction('team', { body: { action: 'create', name } }), onSuccess: () => { done(); toast(translate('account.team.created')); }, onError: onTeamError });
  const inv = useForm<{ email: string }>({ resolver: zodResolver(inviteSchema), defaultValues: { email: '' } });
  const cr = useForm<{ name: string }>({ resolver: zodResolver(createSchema), defaultValues: { name: '' } });
  const f = fleet.data;
  const head = <PageHead id="h-team" dateline={f?.team ? t('account.team.datelineNamed', { name: f.team.name }) : t('account.team.dateline')} title={t('account.team.title')} lede={t('account.team.lede')} />;

  if (!env.accountsConfigured) return <div className="workbench">{head}<div className="span-12"><AccountsOff vars={missingSupabaseVars} /></div></div>;
  if (!signedIn || plan !== 'team' || needsPlan || hasCode(fleet.error, 'plan_required')) {
    return (
      <div className="workbench">{head}
        {signedIn ? <div className="span-12"><TeamInvitation /></div> : null}
        <div className="span-12">
          <StateCard icon="team" title={t('account.team.lockedTitle')} actions={<AppLink to="/plans" className="btn btn-quiet">{t('schedules.seePlans')}</AppLink>}>{t('account.team.lockedBody')}</StateCard>
        </div>
      </div>
    );
  }
  if (fleet.isPending) return <div className="workbench">{head}<p className="lede span-12">{t('states.loading')}</p></div>;
  if (!f?.team) {
    return (
      <div className="workbench">{head}
        <Panel idx="§ 01" title={t('account.team.createTitle')} titleId="h-team-create" className="span-6" inset>
          <Form className="stack-v" validationBehavior="aria" onSubmit={cr.handleSubmit((v) => create.mutate(v.name))}>
            <Controller control={cr.control} name="name" render={({ field, fieldState }) => (
              <TextField className="field" value={field.value} onChange={field.onChange} onBlur={field.onBlur} isInvalid={fieldState.invalid} validationBehavior="aria">
                <Label>{t('account.team.createName')}</Label><Input className="input" ref={field.ref} />
              </TextField>
            )} />
            <Btn type="submit" variant="run" isDisabled={create.isPending}>{t('account.team.create')}</Btn>
          </Form>
        </Panel>
      </div>
    );
  }
  const used = f.members.length + f.invites.length;
  return (
    <div className="workbench">{head}
      <section className="span-12" aria-label={t('account.team.machines')} data-tour={t('account.team.tilesTour')}>
        <div className="tiles">
          <div className="tile"><span>{t('account.team.machines')}</span><b>{f.totals.machines}</b><small>{t('account.team.macsSub')}</small></div>
          <div className="tile"><span>{t('account.team.quiet')}</span><b>{f.totals.quiet_machines}</b><small>{t('account.team.quietSub')}</small></div>
          <div className="tile"><span>{t('account.team.members')}</span><b>{f.members.length}</b><small>{t('account.team.seatsUse', { used, seats: f.team.seats })}</small></div>
        </div>
      </section>
      <Panel idx="§ 01" title={t('account.team.members')} titleId="h-members" className="span-8" aside={t('account.team.seatsUse', { used, seats: f.team.seats })}>
        <table className="ledger">
          <thead><tr><th>{t('account.team.colMember')}</th><th>{t('account.team.colRole')}</th><th>{t('account.team.colStatus')}</th><th className="num" /></tr></thead>
          <tbody>
            {f.members.map((m) => (
              <tr key={m.user_id}>
                <td>{m.email}</td><td>{t(`account.team.${m.role}`)}</td><td><span className="badge ok">{t('account.team.active')}</span></td>
                <td className="num">{m.role === 'owner' ? null : <Button className="link-arrow" onPress={() => remove.mutate({ user_id: m.user_id }, { onSuccess: () => toast(translate('account.team.removed', { email: m.email })) })}>{t('account.team.remove')}</Button>}</td>
              </tr>
            ))}
            {f.invites.map((i) => (
              <tr key={i.id}>
                <td>{i.email}</td><td>{t('account.team.member')}</td><td><span className="badge warn">{t('account.team.invited')}</span></td>
                <td className="num"><Button className="link-arrow" onPress={() => remove.mutate({ invite_id: i.id }, { onSuccess: () => toast(translate('account.team.removed', { email: i.email })) })}>{t('account.team.remove')}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel idx="§ 02" title={t('account.team.inviteTitle')} titleId="h-invite" className="span-4" inset tour={t('account.team.inviteTour')}>
        <Form className="stack-v" validationBehavior="aria" onSubmit={inv.handleSubmit((v) => invite.mutate(v.email, { onSuccess: (r) => { toast(translate(r.email_sent ? 'account.team.sent' : 'account.team.alreadySent', { email: v.email })); inv.reset(); } }))}>
          <Controller control={inv.control} name="email" render={({ field, fieldState }) => (
            <TextField className="field" type="email" value={field.value} onChange={field.onChange} onBlur={field.onBlur} isInvalid={fieldState.invalid} validationBehavior="aria">
              <Label>{t('account.team.email')}</Label>
              <Input className="input" ref={field.ref} placeholder={t('account.team.emailPlaceholder')} />
              <FieldError className="error">{fieldState.error?.message}</FieldError>
            </TextField>
          )} />
          <Btn type="submit" variant="run" tag={t('account.team.sendTag')} isDisabled={invite.isPending || used >= f.team.seats}>{t('account.team.send')}</Btn>
          <p className="lede">{t('account.team.seatsNote')}</p>
        </Form>
      </Panel>
    </div>
  );
}
