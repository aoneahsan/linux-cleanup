import { useEffect, useRef, useState } from 'react';
import { Button, ToggleButton } from 'react-aria-components';
import { Btn } from '@/components/ui/primitives';
import { useT, translate } from '@/i18n';
import { SHORTCUTS, comboFrom, useSettings, type ShortcutId } from '@/stores/settings';
import { toast } from '@/lib/feedback';
import { useSession } from '@/stores/session';

/** Rebindable shortcuts: capture, uniqueness, a named clash with a deep link, reset to defaults. */
export function ShortcutsPanel() {
  const t = useT();
  const bindings = useSettings((s) => s.bindings);
  const bind = useSettings((s) => s.bind);
  const reset = useSettings((s) => s.resetBindings);
  const signedIn = useSession((s) => s.signedIn);
  const [capturing, setCapturing] = useState<ShortcutId | null>(null);
  const [message, setMessage] = useState<{ text: string; owner: ShortcutId | null } | null>(null);
  const [flash, setFlash] = useState<ShortcutId | null>(null);
  const refs = useRef<Partial<Record<ShortcutId, HTMLButtonElement | null>>>({});
  const label = (id: ShortcutId) => t(`settings.keyLabels.${id}`);
  const groupOf = (id: ShortcutId) => SHORTCUTS.find((s) => s.id === id)?.group ?? 'everywhere';

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setCapturing(null);
        return;
      }
      if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return;
      const combo = comboFrom(e);
      if (!combo) {
        setMessage({ text: translate('settings.needModifier'), owner: null });
        return;
      }
      const res = bind(capturing, combo);
      if (res?.kind === 'menu') {
        setMessage({ text: translate('settings.clashMenu', { keys: combo, item: translate(`settings.menuItems.${res.item}`) }), owner: null });
        return;
      }
      if (res?.kind === 'shortcut') {
        const owner = res.owner;
        setMessage({
          text: translate('settings.clash', { keys: combo, action: translate(`settings.keyLabels.${owner}`), group: translate(`settings.keyGroups.${groupOf(owner)}`) }),
          owner,
        });
        return;
      }
      setMessage(null);
      toast(translate('settings.bound', { action: translate(`settings.keyLabels.${capturing}`), keys: combo }));
      setCapturing(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, bind]);

  const goToOwner = (id: ShortcutId) => {
    const el = refs.current[id];
    el?.scrollIntoView({ block: 'center' });
    el?.focus();
    setFlash(id);
    window.setTimeout(() => setFlash(null), 1600);
  };

  const groups = [...new Set(SHORTCUTS.map((s) => s.group))];
  return (
    <div>
      {message ? (
        <div className="clash" role="alert">
          {message.text}{' '}
          {message.owner ? (
            <Button className="link-arrow" onPress={() => message.owner && goToOwner(message.owner)}>{t('settings.clashGo')}</Button>
          ) : null}
        </div>
      ) : null}
      {groups.map((g) => (
        <div key={g}>
          <p className="kbd-group">{t(`settings.keyGroups.${g}`)}</p>
          {SHORTCUTS.filter((s) => s.group === g).map((s) => (
            <div className="kbd-row" key={s.id} id={`shortcut-${s.id}`} data-flash={flash === s.id ? 'true' : undefined}>
              <span>{label(s.id)}</span>
              <span className="kbd">{bindings[s.id]}</span>
              <ToggleButton
                ref={(el) => { refs.current[s.id] = el; }}
                className="capture"
                data-capturing={capturing === s.id ? '' : undefined}
                isSelected={capturing === s.id}
                onChange={(on) => { setMessage(null); setCapturing(on ? s.id : null); }}
                aria-label={t('settings.rebind', { action: label(s.id), keys: bindings[s.id] })}
              >
                {capturing === s.id ? t('settings.pressKeys') : bindings[s.id]}
              </ToggleButton>
            </div>
          ))}
        </div>
      ))}
      <div className="row-actions mt-4">
        <Btn onPress={() => { reset(); setMessage(null); toast(translate('settings.resetDone')); }}>{t('settings.reset')}</Btn>
        <span className="lede">{signedIn ? t('settings.keysSync') : t('settings.keysLocal')}</span>
      </div>
    </div>
  );
}
