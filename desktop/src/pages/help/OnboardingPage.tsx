import { useNavigate, useSearch } from '@tanstack/react-router';
import { Button } from 'react-aria-components';
import { Btn, goTo } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { PunchCard } from '@/components/allowance/PunchCard';
import { useT, translate } from '@/i18n';
import { usePublicConfig } from '@/hooks/usePublicConfig';
import { usePrefs } from '@/stores/prefs';
import { useSession } from '@/stores/session';
import { signInWithGoogle } from '@/services/auth';
import { env } from '@/config/env';
import { toast } from '@/lib/feedback';

const STEPS = [1, 2, 3] as const;
/** The guard's protected folders (lib/common.sh PROTECTED_PATHS), shown as facts. */
const KEPT = ['~/Documents', '~/Pictures', '~/Music', '~/Videos', '~/Desktop', '~/.ssh', '~/.gnupg', '~/.config'] as const;
const pad = (n: number) => `0${n}`;

/** First launch: three steps (welcome, what stays, optional sign-in). The step lives in the URL. */
export default function OnboardingPage() {
  const t = useT();
  const navigate = useNavigate({ from: '/onboarding' });
  const { step = 1 } = useSearch({ from: '/onboarding' });
  const markOnboarded = usePrefs((s) => s.markOnboarded);
  const signedIn = useSession((s) => s.signedIn);
  const cfg = usePublicConfig();
  const go = (n: number) => void navigate({ search: { step: n === 1 ? undefined : n } });
  const finish = () => { markOnboarded(); goTo(navigate, '/'); };
  const device = cfg.data?.deviceRuns;
  const extra = cfg.data?.accountExtraRuns;
  const nums = typeof device === 'number' && typeof extra === 'number';

  const nav = (
    <div className="row-actions">
      <Btn variant="run" tag={t('common.next')} onPress={() => go(step + 1)}>{t('help.onboarding.continue')}</Btn>
      <Btn onPress={() => go(step - 1)}>{t('common.back')}</Btn>
    </div>
  );

  return (
    <div className="onboard">
      <nav className="steps" aria-label={t('help.onboarding.steps')}>
        {STEPS.map((n) => (
          <Button key={n} className={n < step ? 'done' : undefined} aria-current={n === step ? 'step' : undefined} onPress={() => go(n)}>
            <span className="plate" data-tier="read">{pad(n)}</span>
            {t(`help.onboarding.names.s${n}`)}
          </Button>
        ))}
      </nav>
      {step === 1 ? (
        <section className="step-pane welcome" aria-labelledby="h-ob1" data-tour={t('help.onboarding.tour')}>
          <div className="stack-v">
            <span className="dateline">{t('help.onboarding.d1')}</span>
            <h1 id="h-ob1">{t('help.onboarding.h1')}</h1>
            <p className="lede">{t('help.onboarding.p1')}</p>
            <div className="row-actions">
              <Btn variant="run" tag={t('help.onboarding.startTag')} onPress={() => go(2)}>{t('help.onboarding.start')}</Btn>
              <Btn onPress={finish}>{t('help.onboarding.skip')}</Btn>
            </div>
          </div>
          <div className="panel">
            <div className="gauge-bar" aria-hidden="true">
              <span className="seg" data-k="used" style={{ flex: 3 }} />
              <span className="seg" data-k="free" style={{ flex: 5 }} />
            </div>
            <p className="lede mt-3">{t('help.onboarding.gaugeNote')}</p>
          </div>
        </section>
      ) : null}
      {step === 2 ? (
        <section className="step-pane welcome" aria-labelledby="h-ob2">
          <div className="stack-v">
            <span className="dateline">{t('help.onboarding.d2')}</span>
            <h1 id="h-ob2">{t('help.onboarding.h2')}</h1>
            <p className="lede">{t('help.onboarding.p2')}</p>
            {nav}
          </div>
          <div className="panel">
            <ul className="path-list">
              {KEPT.map((p) => <li key={p}><Icon name="lock" /><span className="path">{p}</span></li>)}
            </ul>
            <p className="help lede mt-3">{t('help.onboarding.keptNote')}</p>
          </div>
        </section>
      ) : null}
      {step === 3 ? (
        <section className="step-pane welcome" aria-labelledby="h-ob3">
          <div className="stack-v">
            <span className="dateline">{t('help.onboarding.d3')}</span>
            <h1 id="h-ob3">{nums ? t('help.onboarding.h3', { device, account: extra }) : t('help.onboarding.h3plain')}</h1>
            <p className="lede">{nums ? t('help.onboarding.p3', { device, account: extra }) : t('help.onboarding.p3plain')}</p>
            <div className="row-actions">
              {env.accountsConfigured && !signedIn ? (
                <Btn variant="run" icon="person" onPress={() => void signInWithGoogle().then(() => { toast(translate('help.onboarding.signedIn')); finish(); }).catch((e: unknown) => toast(translate('states.genericError', { message: e instanceof Error ? e.message : String(e) })))}>
                  {t('help.onboarding.signIn')}
                </Btn>
              ) : null}
              <Btn onPress={finish}>{t('help.onboarding.notNow')}</Btn>
              <Btn icon="compass" onPress={() => { markOnboarded(); goTo(navigate, '/walkthrough'); }}>{t('help.onboarding.seeHow')}</Btn>
            </div>
          </div>
          {env.accountsConfigured ? <div className="panel"><PunchCard /></div> : null}
        </section>
      ) : null}
    </div>
  );
}
