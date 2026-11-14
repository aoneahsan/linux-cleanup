import { useRouter } from '@tanstack/react-router';
import { Btn, RouterLink, StateCard } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { logger } from '@/lib/logger';

/** Route error boundary: names the failure, says nothing on the computer changed, offers a way out. */
export function ErrorView({ error }: { error: unknown }) {
  const t = useT();
  const router = useRouter();
  logger.error('screen crashed', error instanceof Error ? error.message : String(error));
  return (
    <div className="workbench">
      <div className="span-12">
        <StateCard
          tone="error"
          icon="alert"
          title={t('states.crash.title')}
          actions={
            <>
              <Btn variant="quiet" icon="refresh" onPress={() => void router.invalidate()}>
                {t('states.crash.reload')}
              </Btn>
              <RouterLink to="/" className="btn btn-quiet">
                {t('states.crash.home')}
              </RouterLink>
            </>
          }
        >
          {t('states.crash.body')}
        </StateCard>
        {import.meta.env.DEV && error instanceof Error ? (
          <pre className="dev-error">{`${error.message}\n${error.stack ?? ''}`}</pre>
        ) : null}
      </div>
    </div>
  );
}

/** Unknown route. */
export function NotFoundView() {
  const t = useT();
  return (
    <div className="workbench">
      <div className="span-12">
        <StateCard
          icon="compass"
          title={t('states.notFound.title')}
          actions={
            <RouterLink to="/" className="btn btn-quiet">
              {t('states.notFound.home')}
            </RouterLink>
          }
        >
          {t('states.notFound.body')}
        </StateCard>
      </div>
    </div>
  );
}
