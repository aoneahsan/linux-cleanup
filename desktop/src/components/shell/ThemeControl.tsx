import type { CSSProperties } from 'react';
import { Button, Dialog, DialogTrigger, Heading, Label, Popover, Radio, RadioGroup } from 'react-aria-components';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import { click } from '@/lib/feedback';
import { useAppearance } from '@/theme/apply';
import { useOverlays } from '@/stores/overlays';
import { AXES, AXIS_ORDER, SWATCH, legendKey, valueKey, type Axis } from '@/theme/axes';

/** Each card previews its own value (inline styles only for the preview chip). */
function Preview({ axis, value }: { axis: Axis; value: string }) {
  const t = useT();
  if (axis === 'palette') {
    const triad = SWATCH[value as keyof typeof SWATCH];
    return (
      <span className="swatch">
        {triad.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </span>
    );
  }
  const style: CSSProperties = {};
  if (axis === 'radius') style.borderRadius = { none: '0', small: '.2rem', medium: '.35rem', large: '.6rem' }[value];
  if (axis === 'density') style.padding = { compact: '0 .15rem', comfortable: '0 .3rem', spacious: '0 .6rem' }[value];
  if (axis === 'type-scale') style.fontSize = { small: '.66rem', medium: '.74rem', large: '.86rem' }[value];
  return (
    <span className="plate" data-preview={axis === 'theme' ? value : undefined} style={style}>
      {t('theme.platePreview')}
    </span>
  );
}

/** The ONE theme control: a dial in the title bar opening one panel with every axis. */
export function ThemeControl() {
  const t = useT();
  const values = useAppearance((s) => s.values);
  const set = useAppearance((s) => s.set);
  const open = useOverlays((s) => s.themeOpen);
  const setOpen = useOverlays((s) => s.setThemeOpen);
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <Button className="dial-button" aria-label={t('shell.appearance')}>
        <Icon name="dial" />
      </Button>
      <Popover className="popover" placement="bottom end" offset={6}>
        <Dialog aria-label={t('theme.title')}>
          <Heading slot="title">{t('theme.title')}</Heading>
          {AXIS_ORDER.map((axis) => (
            <RadioGroup
              key={axis}
              className="axis"
              orientation="horizontal"
              value={values[axis]}
              onChange={(v) => {
                set(axis, v as never);
                click();
              }}
            >
              <Label className="legend">{t(legendKey(axis))}</Label>
              <div className="cards">
                {AXES[axis].map((value) => (
                  <Radio key={value} value={value} className="card-opt">
                    <Preview axis={axis} value={value} />
                    {t(valueKey(axis, value))}
                  </Radio>
                ))}
              </div>
            </RadioGroup>
          ))}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
