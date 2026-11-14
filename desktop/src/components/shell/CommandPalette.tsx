import { useMemo } from 'react';
import { Autocomplete, Dialog, Input, Menu, MenuItem, Modal, ModalOverlay, TextField, useFilter } from 'react-aria-components';
import { useNavigate } from '@tanstack/react-router';
import { Plate, Stamp, TagChip, goTo } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { TIER } from '@/data/sections';
import { NAV } from '@/router/nav';
import { isRegistered } from '@/router/registry';
import { useOverlays } from '@/stores/overlays';
import { useSession } from '@/stores/session';
import { useSettings } from '@/stores/settings';
import { openExternal } from '@/lib/open';
import { env } from '@/config/env';
import { startSafePreview } from '@/services/previewLauncher';

interface Entry {
  id: string;
  text: string;
  run: () => void;
  kind: 'action' | 'screen' | 'section';
  hint?: string;
  group?: string;
  section?: number;
}

/** Ctrl+K command palette: sections, screens and actions by number, name or tier. */
export function CommandPalette() {
  const t = useT();
  const open = useOverlays((s) => s.paletteOpen);
  const setOpen = useOverlays((s) => s.setPaletteOpen);
  const startTour = useOverlays((s) => s.startTour);
  const role = useSession((s) => s.role);
  const navigate = useNavigate();
  const { contains } = useFilter({ sensitivity: 'base' });
  const bindings = useSettings((s) => s.bindings);

  const entries = useMemo<Entry[]>(() => {
    const actions: Entry[] = [
      { id: 'a-preview', kind: 'action', text: t('shell.palette.previewSafe'), hint: bindings.preview, run: () => void startSafePreview() },
      { id: 'a-theme', kind: 'action', text: t('shell.palette.openAppearance'), hint: bindings.appearance, run: () => window.requestAnimationFrame(() => useOverlays.getState().setThemeOpen(true)) },
      { id: 'a-tour', kind: 'action', text: t('shell.palette.tourScreen'), hint: t('shell.palette.tour'), run: startTour },
      { id: 'a-docs', kind: 'action', text: t('shell.palette.readGuide'), hint: t('shell.palette.docs'), run: () => void openExternal(`${env.docsUrl}/before-you-run/dry-run`) },
    ];
    const screens: Entry[] = NAV.filter((g) => g.group !== 'admin' || role === 'admin').flatMap((g) =>
      g.items.filter((i) => isRegistered(i.to)).map((i) => ({
        id: `s-${i.to}`, kind: 'screen' as const, text: t(i.label), group: t(`shell.rail.groups.${g.group}`),
        run: () => goTo(navigate, i.to),
      })),
    );
    return [...actions, ...screens];
  }, [t, role, navigate, startTour, bindings]);

  return (
    <ModalOverlay className="scrim" isDismissable isOpen={open} onOpenChange={setOpen}>
      <Modal className="palette">
        <Dialog aria-label={t('shell.palette.label')}>
          <Autocomplete filter={(text, input) => contains(text, input)}>
            <TextField aria-label={t('shell.palette.label')} autoFocus>
              <Input placeholder={t('shell.palette.placeholder')} />
            </TextField>
            <Menu
              items={entries}
              aria-label={t('shell.palette.results')}
              className="palette-list"
              renderEmptyState={() => <p className="palette-empty">{t('shell.palette.none')}</p>}
              onAction={(key) => {
                const entry = entries.find((e) => e.id === key);
                setOpen(false);
                entry?.run();
              }}
            >
              {(e) => (
                <MenuItem id={e.id} textValue={e.text} className="palette-item">
                  {e.kind === 'screen' ? <TagChip>{e.group}</TagChip> : null}
                  {e.kind === 'section' && e.section !== undefined ? (
                    <>
                      <Plate id={e.section} tier={TIER[e.section] ?? 'read'} />
                      {t(`sections.s${e.section}.title` as never)}
                      <Stamp tier={TIER[e.section] ?? 'read'} />
                    </>
                  ) : (
                    <>
                      {e.text}
                      <span className="kbd">{e.kind === 'screen' ? t('shell.palette.go') : e.hint}</span>
                    </>
                  )}
                </MenuItem>
              )}
            </Menu>
          </Autocomplete>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
