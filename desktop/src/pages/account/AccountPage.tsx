import { useState } from 'react';
import { Form } from 'react-aria-components';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormTextField } from '@/components/form/FormTextField';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLink, Btn, PageHead, Panel, TagChip } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { PunchCard } from '@/components/allowance/PunchCard';
import { AccountsOff } from '@/components/states/NotInApp';
import { useT, translate } from '@/i18n';
import { formatDateTime } from '@/i18n/format';
import { env, missingSupabaseVars, SUPPORT_EMAIL } from '@/config/env';
import { useSystemInfo } from '@/hooks/useLocal';
import { usePublicConfig } from '@/hooks/usePublicConfig';
import { useSession } from '@/stores/session';
import { useAllowance } from '@/stores/allowance';
import { useSettings } from '@/stores/settings';
import { supabase } from '@/services/supabase';
import { callFunction } from '@/services/account';
import { signInErrorKey, signInWithGoogle, signOut } from '@/services/auth';
import { toast } from '@/lib/feedback';
import { commands, isAppError } from '@/lib/tauri';
import { NewsEmails } from './NewsEmails';

const INVITE = /^[A-Za-z0-9-]{4,32}$/;

function Referral() {
  const t = useT();
  const userId = useSession((s) => s.userId);
  const q = useQuery({
    queryKey: ['referral', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const sb = supabase();
      if (!sb || !userId) return null;
      const [{ data: prof }, { data: refs }] = await Promise.all([
        sb.from('profiles').select('referral_code').eq('id', userId).limit(1),
        sb.from('referrals').select('status').eq('referrer_id', userId).limit(50),
      ]);
      const list = (refs ?? []) as { status: string }[];
      return {
        code: (prof?.[0] as { referral_code?: string } | undefined)?.referral_code ?? null,
        confirmed: list.filter((r) => r.status === 'confirmed').length,
        pending: list.filter((r) => r.status !== 'confirmed').length,
      };
    },
  });
  if (!q.data?.code) return <p className="lede">{t('account.refSignIn')}</p>;
  const link = `${env.websiteUrl}/download?invite=${encodeURIComponent(q.data.code)}`;
  return (
    <div className="stack-v">
      <dl className="kv"><dt>{t('account.refCode')}</dt><dd>{q.data.code}</dd></dl>
      <p className="lede">{t('account.refConfirmed', { count: q.data.confirmed })} · {t('account.refPending', { count: q.data.pending })}</p>
      <div className="row-actions">
        <Btn icon="gift" onPress={() => void navigator.clipboard.writeText(link).then(() => toast(translate('account.refCopied')))}>{t('account.refCopy')}</Btn>
      </div>
      <p className="help lede">{t('account.refBody')}</p>
    </div>
  );
}

const inviteSchema = z.object({ code: z.string().trim().regex(INVITE, { error: () => translate('account.inviteInvalid') }) });

function InviteCode() {
  const t = useT();
  const saved = useSettings((s) => s.settings.inviteCode);
  const update = useSettings((s) => s.update);
  const { control, handleSubmit } = useForm<{ code: string }>({ resolver: zodResolver(inviteSchema), defaultValues: { code: saved ?? '' } });
  return (
    <Form className="row-actions" validationBehavior="aria" onSubmit={handleSubmit((v) => { update({ inviteCode: v.code.trim() }); toast(translate('account.inviteSaved')); })}>
      <FormTextField control={control} name="code" label={t('account.inviteUse')} mono />
      <Btn type="submit">{t('account.inviteSave')}</Btn>
    </Form>
  );
}

/** The typed delete confirmation as a form: the word must match exactly before the button enables. */
function DeleteAccount({ signedIn, busy, onDelete }: { signedIn: boolean; busy: boolean; onDelete: () => Promise<void> }) {
  const t = useT();
  const word = t('account.deleteWord');
  const schema = z.object({ typed: z.string().refine((v) => v.trim().toLowerCase() === word, { error: () => t('account.deleteLabel') }) });
  const { control, handleSubmit, reset } = useForm<{ typed: string }>({ resolver: zodResolver(schema), defaultValues: { typed: '' }, mode: 'onChange' });
  const typed = useWatch({ control, name: 'typed' });
  return (
    <Form className="stack-v" validationBehavior="aria" onSubmit={handleSubmit(() => void onDelete().then(() => reset({ typed: '' })))}>
      <FormTextField control={control} name="typed" label={t('account.deleteLabel')} mono autoComplete="off" isDisabled={!signedIn} />
      <div className="row-actions">
        <Btn type="submit" variant="danger" isDisabled={!signedIn || busy || typed.trim().toLowerCase() !== word}>{t('account.deleteBtn')}</Btn>
      </div>
    </Form>
  );
}

interface DeviceRow { id: string; name: string | null; os_version: string | null; last_seen_at: string | null }

/** The signed-in account's own computers (RLS: select own), newest first, at most 20. */
function Devices({ thisId }: { thisId: string | null }) {
  const t = useT();
  const userId = useSession((s) => s.userId);
  const q = useQuery({
    queryKey: ['devices', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const sb = supabase();
      if (!sb || !userId) return [];
      const { data, error } = await sb.from('devices').select('id, name, os_version, last_seen_at').eq('user_id', userId).order('last_seen_at', { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as DeviceRow[];
    },
  });
  if (q.isPending) return <p className="lede">{t('states.loading')}</p>;
  if (q.error || !q.data.length) return <p className="lede">{q.error ? t('states.server.body') : t('admin.empty')}</p>;
  return (
    <table className="ledger">
      <thead><tr><th>{t('account.colMac')}</th><th>{t('account.colOs')}</th><th>{t('account.colSeen')}</th><th className="num" /></tr></thead>
      <tbody>
        {q.data.map((d) => (
          <tr key={d.id}>
            <td>{d.name ?? t('account.unnamedMac')}</td>
            <td>{d.os_version ?? '—'}</td>
            <td>{d.last_seen_at ? formatDateTime(Date.parse(d.last_seen_at)) : '—'}</td>
            <td className="num">{d.id === thisId ? <span className="badge accent">{t('account.macName')}</span> : null}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Account: anonymous by default; Google sign-in, allowance pools, plan, referral, data export and deletion. */
export default function AccountPage() {
  const t = useT();
  const qc = useQueryClient();
  const { signedIn, email, plan } = useSession();
  const allowance = useAllowance((s) => s.allowance);
  const sys = useSystemInfo();
  const cfg = usePublicConfig();
  const [busy, setBusy] = useState(false);
  const extra = cfg.data?.accountExtraRuns ?? null;

  if (!env.accountsConfigured) {
    return (
      <div className="workbench">
        <PageHead id="h-acct" dateline={t('account.dateline')} title={t('account.title')} lede={t('account.lede')} />
        <div className="span-12"><AccountsOff vars={missingSupabaseVars} /></div>
        <p className="lede span-12">{t('account.support', { email: SUPPORT_EMAIL })}</p>
      </div>
    );
  }

  const doSignIn = async () => {
    setBusy(true);
    toast(translate('account.signingIn'));
    try {
      await signInWithGoogle();
      toast(translate('account.signedIn'));
    } catch (e) {
      toast(translate(signInErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const sb = supabase();
    if (!sb || !signedIn) { toast(translate('account.signInFirst')); return; }
    try {
      // One server call returns every table the account owns (export_my_data); the file stays on this computer.
      const { data, error } = await sb.rpc('export_my_data');
      if (error) throw new Error(error.message);
      const { path } = await commands.exportJson('linux-cleanup-account.json', JSON.stringify(data, null, 2));
      toast(translate('account.downloaded', { path }));
    } catch (e) {
      toast(translate('states.genericError', { message: isAppError(e) ? e.message || e.kind : e instanceof Error ? e.message : String(e) }));
    }
  };

  const del = async () => {
    setBusy(true);
    try {
      await callFunction('delete-account', { body: { confirm: 'DELETE' } });
      await signOut();
      void qc.invalidateQueries();
      toast(translate('account.deleted'));
    } catch (e) {
      toast(translate('states.genericError', { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="workbench">
      <PageHead
        id="h-acct"
        dateline={signedIn && email ? t('account.datelineSigned', { email }) : t('account.dateline')}
        title={t('account.title')}
        lede={extra !== null ? t('account.ledeN', { n: extra }) : t('account.lede')}
        actions={signedIn ? (
          <Btn isDisabled={busy} onPress={() => void signOut().then(() => toast(translate('account.signedOut')))}>{t('account.signOut')}</Btn>
        ) : (
          <>
            <Btn variant="run" icon="person" isDisabled={busy} aria-busy={busy} onPress={() => void doSignIn()}>{t('account.signIn')}</Btn>
            {extra !== null ? <TagChip tone="pro">{t('account.plusAfter', { n: extra })}</TagChip> : null}
          </>
        )}
      />
      <Panel idx="§ 01" title={t('account.runsTitle')} titleId="h-acct-runs" className="span-7" tour={t('account.runsTour')}>
        {allowance?.plan.unlimited ? <div className="banner mb-3"><Icon name="check" />{t('account.noLimitBanner', { plan: allowance.plan.name })}</div> : null}
        <PunchCard />
        <p className="lede mt-3">{t('account.runsLede')}</p>
      </Panel>
      <Panel idx="§ 02" title={t('account.planTitle')} titleId="h-acct-plan" className="span-5" inset>
        <div className="stack-v">
          <b className="detail-title">{allowance?.plan.name ?? t(`shell.plan.${plan}`)}</b>
          <div className="row-actions"><AppLink to="/plans" className="btn btn-quiet">{t('account.planChange')}</AppLink></div>
          <p className="lede">{t('account.planCancelNote')}</p>
        </div>
      </Panel>
      <Panel idx="§ 03" title={signedIn ? t('account.macsTitleAll') : t('account.macsTitle')} titleId="h-dev" className="span-6">
        {signedIn ? <Devices thisId={sys.data?.device_id ?? null} /> : (
          <dl className="kv">
            <dt>{t('account.macName')}</dt>
            <dd>{sys.data ? `${t('account.macOs', { v: sys.data.os_version })} · ${t('account.macChip', { v: sys.data.arch })}` : '—'}</dd>
          </dl>
        )}
      </Panel>
      <Panel idx="§ 04" title={t('account.refTitle')} titleId="h-ref" className="span-6" aside={<TagChip tone="pro">{t('account.refTag')}</TagChip>} tour={t('account.refTour')}>
        {signedIn ? <Referral /> : <p className="lede">{t('account.refSignIn')}</p>}
        <div className="mt-3"><InviteCode /></div>
      </Panel>
      <Panel idx="§ 05" title={t('account.newsPanel')} titleId="h-news" className="span-12" tour={t('account.newsTour')}>
        <NewsEmails />
      </Panel>
      <Panel idx="§ 06" title={t('account.dataTitle')} titleId="h-danger" className="span-12">
        <div className="split">
          <div className="stack-v">
            <b>{t('account.download')}</b>
            <p className="lede">{t('account.downloadBody')}</p>
            <div className="row-actions"><Btn icon="download" onPress={() => void download()}>{t('account.downloadBtn')}</Btn></div>
          </div>
          <div className="stack-v">
            <b>{t('account.deleteTitle')}</b>
            <p className="lede">{t('account.deleteBody')}</p>
            <DeleteAccount signedIn={signedIn} busy={busy} onDelete={del} />
          </div>
        </div>
        <p className="lede mt-4">{t('account.support', { email: SUPPORT_EMAIL })}</p>
      </Panel>
      <span className="sr-only" aria-live="polite">{busy ? t('states.loading') : ''}</span>
    </div>
  );
}
