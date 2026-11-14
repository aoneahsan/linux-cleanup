import { answerBlocks } from '@/lib/answerBlocks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLink, Btn, ExternalLink, PageHead, Plate, RouterLink, StateCard, Stamp } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { AccountsOff } from '@/components/states/NotInApp';
import { Composer } from '@/components/assistant/Composer';
import { useT, translate, type TKey } from '@/i18n';
import { formatDate, formatDateTime, formatKb, formatShortDateTime } from '@/i18n/format';
import { env, missingSupabaseVars } from '@/config/env';
import { tierFor } from '@/data/sections';
import { usePlans } from '@/hooks/usePlans';
import { askAssistant, assistantStatus, assistantStatusKey, ASSISTANT_STATUS_STALE_MS, type AssistantSection, type AssistantStatus } from '@/services/assistant';
import { hasCode } from '@/services/account';
import { useAssistant } from '@/stores/assistant';
import { useRun } from '@/stores/run';
import { useReceipts } from '@/stores/receipts';
import { useSession } from '@/stores/session';
import { click, toast } from '@/lib/feedback';

const CHIPS: readonly TKey[] = ['assistant.chipSafe', 'assistant.chipXcode', 'assistant.chipPermanent'];

/** A docs URL's page name for the citation line. */
function docLabel(url: string): string {
  const path = (() => { try { return new URL(url).pathname; } catch { return ''; } })();
  const key = ([
    ['/reference/sections', 'sections'], ['/before-you-run/what-gets-deleted', 'deleted'], ['/recovery', 'recovery'],
    ['/reference/configuration', 'configuration'], ['/before-you-run/dry-run', 'dryRun'], ['/before-you-run/safety-model', 'safety'], ['/faq', 'faq'],
  ] as const).find(([p]) => path.startsWith(p))?.[1] ?? 'page';
  return translate(`assistant.docs.${key}`);
}

/**
 * The preview the assistant answers about: the dry run in memory when there is one
 * (live or just finished), else the latest preview receipt on this Mac (the Preview
 * ledger's fallback after a restart). Only id, planned KB, tier, item count and status
 * are kept; titles, paths and item lists stay here.
 */
function usePreviewSummary() {
  const request = useRun((s) => s.request);
  const runState = useRun((s) => s.state);
  const startedAt = useRun((s) => s.startedAt);
  const lastPreview = useReceipts((s) => s.receipts.find((r) => r.dryRun) ?? null);
  const findings = useReceipts((s) => s.findings);
  return useMemo(() => {
    const live = request?.dryRun ? runState.order.map((id) => runState.sections[id]).filter((x) => x !== undefined) : [];
    if (request?.dryRun && live.length) {
      const rows: AssistantSection[] = live.map((sec) => ({ id: sec.id, planned_kb: sec.plannedKb, tier: tierFor(sec.id, sec.stamp), item_count: sec.itemCount, status: sec.state }));
      return { name: request.name, at: startedAt, rows, totalKb: rows.reduce((n, r) => n + r.planned_kb, 0) };
    }
    if (!lastPreview) return { name: '', at: null, rows: [] as AssistantSection[], totalKb: 0 };
    const rows: AssistantSection[] = lastPreview.sections.map((sec) => ({
      id: sec.id, planned_kb: sec.plannedKb, tier: tierFor(sec.id, findings[sec.id]?.section.stamp), item_count: sec.itemCount, status: sec.state,
    }));
    return { name: lastPreview.name, at: lastPreview.at, rows, totalKb: rows.reduce((n, r) => n + r.planned_kb, 0) };
  }, [request, runState, startedAt, lastPreview, findings]);
}

/** Level badge with its tooltip: the level follows the plan, never the model behind it. */
function LevelBadge({ level }: { level: AssistantStatus['level'] }) {
  const t = useT();
  return (
    <TooltipTrigger delay={0} closeDelay={0}>
      <Button className="level-badge"><Icon name="level" /><span>{t(`common.levels.${level}`)}</span></Button>
      <Tooltip className="level-tip" placement="bottom start" offset={8}>{t('assistant.levelTip')}</Tooltip>
    </TooltipTrigger>
  );
}

/** Assistant: questions about the current preview, answered from its numbers and the macleanup docs. */
export default function AssistantPage() {
  const t = useT();
  const qc = useQueryClient();
  const summary = usePreviewSummary();
  const history = useAssistant((s) => s.history);
  const store = useAssistant;
  const plan = useSession((s) => s.plan);
  const plans = usePlans();
  const [refused, setRefused] = useState<'limit_reached' | 'paused' | null>(null);
  const log = useRef<HTMLOListElement>(null);
  const status = useQuery({ queryKey: assistantStatusKey, queryFn: assistantStatus, staleTime: ASSISTANT_STATUS_STALE_MS, enabled: env.accountsConfigured });
  const s = status.data;
  const level = s?.level ?? 'spark';
  const pausedUntil = s?.paused_until ? Date.parse(s.paused_until) : null;
  const resting = refused === 'paused' || pausedUntil !== null;
  const spent = refused === 'limit_reached' || (s ? s.questions_left <= 0 : false);

  const ask = useMutation({
    mutationFn: ({ q }: { q: string; id: number }) => askAssistant(q, summary.rows),
    onSuccess: (res, { id }) => {
      if (res.ok) store.getState().answer(id, res.answer, res.sources, res.level);
      else { store.getState().drop(id); setRefused(res.reason); }
    },
    onError: (e, { id }) => {
      store.getState().drop(id);
      toast(hasCode(e, 'ai_unavailable') ? translate('assistant.unavailable') : hasCode(e, 'device_owned') ? translate('assistant.owned')
        : translate('assistant.askFailed', { message: e instanceof Error ? e.message : String(e) }));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: assistantStatusKey }),
  });

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history]);

  const send = (q: string) => {
    if (ask.isPending || spent || resting) return;
    ask.mutate({ q, id: store.getState().ask(q, level) });
  };

  if (!summary.rows.length) {
    return (
      <div className="workbench">
        <PageHead id="h-as" dateline={t('assistant.dateline')} title={t('assistant.title')} lede={t('assistant.lede')} />
        <div className="span-12" data-tour={t('assistant.noPreviewTour')}>
          <StateCard icon="spark" title={t('assistant.noPreviewTitle')} actions={<RouterLink to="/sections" className="btn btn-preview"><span className="tag">{t('common.dryRun')}</span>{t('assistant.noPreviewPick')}</RouterLink>}>
            {t('assistant.noPreviewBody')}
          </StateCard>
        </div>
      </div>
    );
  }

  const proRow = plans.data?.find((p) => p.id === 'pro');
  const resets = s ? formatDate(Date.parse(s.resets_at)) : '';
  const limit = s?.questions_limit ?? 0;
  const left = Math.max(0, s?.questions_left ?? 0);

  return (
    <div className="workbench">
      <PageHead id="h-as" dateline={t('assistant.dateline')} title={t('assistant.title')} lede={t('assistant.lede')}
        actions={<AppLink to="/preview" className="btn btn-quiet"><Icon name="ledger" />{t('assistant.previewLink')}</AppLink>} />
      <aside className="panel inset span-5" aria-labelledby="h-as-sees" data-tour={t('assistant.seesTour')}>
        <div className="panel-head"><span className="idx">§ 01</span><h2 id="h-as-sees">{t('assistant.seesTitle')}</h2><span className="rule" /></div>
        <ul className="ask-summary">
          {summary.rows.map((r) => (
            <li key={r.id}><Plate id={r.id} tier={r.tier} /><span>{t(`sections.s${r.id}.title` as never)}</span><span className="mono">{r.planned_kb ? formatKb(r.planned_kb) : '—'}</span><Stamp tier={r.tier} /></li>
          ))}
        </ul>
        <p className="lede mono">{t('assistant.total', { n: summary.rows.length, size: formatKb(summary.totalKb), name: summary.name })}</p>
        {summary.at ? <p className="lede">{t('assistant.previewOf', { when: formatDateTime(summary.at) })}</p> : null}
        <div className="callout privacy-line"><Icon name="lock" /><span>{t('assistant.privacy')}</span></div>
      </aside>
      <section className="panel span-7 ask" aria-labelledby="h-as-ask">
        <div className="panel-head">
          <span className="idx">§ 02</span><h2 id="h-as-ask">{t('assistant.askTitle')}</h2><span className="rule" />
          <Button className="link-arrow" isDisabled={!history.length} onPress={() => { store.getState().clear(); toast(translate('assistant.cleared')); }}>{t('assistant.clear')}</Button>
        </div>
        {!env.accountsConfigured ? <AccountsOff vars={missingSupabaseVars} /> : status.isError && !s ? (
          <StateCard tone="offline" icon="wifioff" title={t('states.server.title')} actions={<Btn onPress={() => void status.refetch()}>{t('common.retry')}</Btn>}>{t('assistant.statusFailed')}</StateCard>
        ) : (
          <>
            <div className="ask-meta" data-tour={t('assistant.metaTour')}>
              <span className="level-wrap"><LevelBadge level={level} /></span>
              <div className="allowance">
                <span>{s ? t('assistant.left', { left, limit }) : t('assistant.leftLoading')}</span>
                <div className="progress" aria-hidden="true"><i style={{ width: `${limit ? (left / limit) * 100 : 0}%` }} /></div>
              </div>
            </div>
            <ol className="chat" ref={log} role="log" aria-live="polite" aria-label={t('assistant.log')}>
              {history.length ? history.flatMap((x) => [
                <li className="chat-you" key={`q${x.id}`}><span className="chat-who">{t('assistant.you')}</span><p>{x.q}</p></li>,
                <li className="chat-ai" key={`a${x.id}`}>
                  <span className="chat-who">{t(`common.levels.${x.level}`)}</span>
                  {x.a === null ? <p className="thinking">{t('assistant.thinking', { level: t(`common.levels.${x.level}`) })}</p> : answerBlocks(x.a).map((b, i) => (b.kind === 'p'
                    ? <p key={i}>{b.text}</p>
                    : <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>))}
                  {x.sources.map((u) => <ExternalLink key={u} href={u} className="cite"><Icon name="book" />{t('assistant.cite', { label: docLabel(u) })}</ExternalLink>)}
                </li>,
              ]) : <li className="chat-empty">{t('assistant.empty')}</li>}
            </ol>
            {resting ? (
              <StateCard icon="snap" title={t('assistant.restingTitle', { time: pausedUntil ? formatShortDateTime(pausedUntil) : '—' })}>{t('assistant.restingBody')}</StateCard>
            ) : spent ? (
              <StateCard icon="spark" title={t('assistant.spentTitle', { limit })}
                actions={plan === 'free' ? <AppLink to="/plans" className="btn btn-run"><span className="tag">{t('assistant.proTag')}</span>{t('assistant.seePro')}</AppLink> : undefined}>
                {plan !== 'free' ? t('assistant.spentBody', { date: resets }) : proRow ? t('assistant.spentFree', { date: resets, pro: proRow.ai_questions_per_month }) : t('assistant.spentFreePlain', { date: resets })}
              </StateCard>
            ) : (
              <>
                <div className="ask-chips" role="group" aria-label={t('assistant.chips')}>
                  {CHIPS.map((k) => <Button key={k} className="chip" isDisabled={ask.isPending} onPress={() => { click(); send(t(k)); }}>{t(k)}</Button>)}
                </div>
                <Composer busy={ask.isPending} onAsk={send} onRefused={(r) => { setRefused(r); void qc.invalidateQueries({ queryKey: assistantStatusKey }); }} />
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
