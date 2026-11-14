import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, Heading, Modal, ModalOverlay, Form } from 'react-aria-components';
import { FormTextField } from '@/components/form/FormTextField';
import { Btn } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useT, translate } from '@/i18n';
import { plate } from '@/i18n/format';
import { SUDO } from '@/data/sections';
import { useRun } from '@/stores/run';

/** Stable empty list: a fresh `[]` inside a selector re-renders forever. */
const NO_SECTIONS: readonly number[] = [];
const schema = z.object({ password: z.string().min(1, { error: () => translate('run.sudo.empty') }) });

/**
 * Answers the CLI's SUDO_ASKPASS request through `askpass_reply`. The password
 * lives only in this field's state until it is sent; it is never stored or logged.
 */
export function SudoSheet() {
  const t = useT();
  const askpass = useRun((s) => s.askpass);
  const answer = useRun((s) => s.answerAskpass);
  const sections = useRun((s) => s.request?.sections ?? NO_SECTIONS);
  // The password lives only in this form until it is sent; reset clears it at once.
  const { control, handleSubmit, reset } = useForm<{ password: string }>({ resolver: zodResolver(schema), defaultValues: { password: '' } });
  const sudoIds = sections.filter((id) => SUDO.includes(id));

  const close = (value: string | null) => {
    reset({ password: '' });
    void answer(value);
  };

  return (
    <ModalOverlay className="scrim" isOpen={askpass !== null} isDismissable={false}>
      <Modal className="sheet sheet-modal">
        <Dialog className="sheet-dialog" aria-labelledby="sudo-title">
          <div className="sheet-head">
            <Heading slot="title" id="sudo-title">{t('run.sudo.title')}</Heading>
          </div>
          <Form className="sheet-body stack-v" validationBehavior="aria" onSubmit={handleSubmit((v) => close(v.password))}>
            <div className="keycard">
              <Icon name="key" />
              <div className="stack-v">
                <p className="lede">
                  {sudoIds.length ? t('run.sudo.why', { ids: sudoIds.map(plate).join(', ') }) : t('run.sudo.whyGeneric')}
                </p>
                {askpass?.prompt ? <p className="lede">{t('run.sudo.prompt', { prompt: askpass.prompt })}</p> : null}
                <FormTextField control={control} name="password" type="password" autoComplete="current-password" autoFocus
                  label={t('run.sudo.label')} help={t('run.sudo.help')} />
              </div>
            </div>
            <div className="row-actions">
              <Btn type="submit" variant="run" icon="lock">{t('run.sudo.submit')}</Btn>
              <Btn variant="quiet" onPress={() => close(null)}>{t('run.sudo.cancel')}</Btn>
            </div>
          </Form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
