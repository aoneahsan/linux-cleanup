import { useEffect } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { ExternalLink } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { useLicence, verifyPageUrl } from '@/services/licensing/licenceCheck';

/**
 * The inactive-licence view of a white-label build, drawn as the release gate's slip.
 * It covers the window and deletes nothing; receipts and settings stay on the Mac.
 * Mounted by the shell only when a white-label key is built in.
 */
export function WhiteLabelGuard() {
  const t = useT();
  const inactive = useLicence((s) => s.inactive);
  useEffect(() => {
    if (!inactive) return undefined;
    const win = document.querySelector<HTMLElement>('.window');
    if (win) win.inert = true;
    return () => { if (win) win.inert = false; };
  }, [inactive]);
  if (!inactive) return null;
  return (
    <ModalOverlay className="gate" isOpen isDismissable={false} isKeyboardDismissDisabled>
      <Modal className="gate-modal">
        <Dialog role="alertdialog" className="slip gate-slip" aria-labelledby="licence-title" aria-describedby="licence-reason">
          <div className="slip-head"><b>{t('whiteLabel.inactive.head')}</b></div>
          <Heading slot="title" id="licence-title">{t('whiteLabel.inactive.title')}</Heading>
          <p className="gate-reason" id="licence-reason">{t('whiteLabel.inactive.reason')}</p>
          <hr className="perf" />
          <p className="gate-line"><ExternalLink href={verifyPageUrl()} className="link-arrow">{t('whiteLabel.inactive.verify')}</ExternalLink></p>
          <p className="gate-fine">{t('whiteLabel.inactive.fine')}</p>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
