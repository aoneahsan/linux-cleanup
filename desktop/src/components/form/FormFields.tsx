import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import type { ReactNode } from 'react';
import { Checkbox, FieldError, Input, Label, NumberField, Radio, RadioGroup, Switch, Text } from 'react-aria-components';

/** A React Aria number field driven by react-hook-form; an empty field is `null`. */
export function FormNumberField<T extends FieldValues>({ control, name, label, min = 0, max }: { control: Control<T>; name: FieldPath<T>; label: string; min?: number; max?: number }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <NumberField className="field" value={typeof field.value === 'number' ? field.value : NaN} minValue={min} maxValue={max}
          onChange={(n) => field.onChange(Number.isFinite(n) ? n : null)} onBlur={field.onBlur} isInvalid={fieldState.invalid} validationBehavior="aria">
          <Label>{label}</Label>
          <Input className="input mono" ref={field.ref} />
          <FieldError className="error">{fieldState.error?.message}</FieldError>
        </NumberField>
      )}
    />
  );
}

/** A React Aria checkbox (punched hole) driven by react-hook-form. */
export function FormCheckbox<T extends FieldValues>({ control, name, label }: { control: Control<T>; name: FieldPath<T>; label: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Checkbox className="check" isSelected={Boolean(field.value)} onChange={field.onChange}>
          <span className="punch" aria-hidden="true" />{label}
        </Checkbox>
      )}
    />
  );
}

/** One option of a card selector: a value, its label and a short line under it. */
export interface CardOption {
  value: string;
  label: ReactNode;
  sub?: ReactNode;
}

/** A card selector (React Aria RadioGroup of `.card-opt` cards) driven by react-hook-form. */
export function FormCardRadio<T extends FieldValues>({ control, name, label, options, help, className = 'field' }: {
  control: Control<T>; name: FieldPath<T>; label: string; options: readonly CardOption[]; help?: string; className?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <RadioGroup className={className} value={(field.value as string | undefined) ?? ''} onChange={field.onChange} isInvalid={fieldState.invalid} validationBehavior="aria">
          <Label className="label">{label}</Label>
          <div className="cards">
            {options.map((o) => <Radio key={o.value} value={o.value} className="card-opt">{o.label}{o.sub ? <small>{o.sub}</small> : null}</Radio>)}
          </div>
          {help ? <Text slot="description" className="help">{help}</Text> : null}
          <FieldError className="error">{fieldState.error?.message}</FieldError>
        </RadioGroup>
      )}
    />
  );
}

/** A React Aria switch (the slide lock) driven by react-hook-form, in a setting row. */
export function FormSwitch<T extends FieldValues>({ control, name, label, body }: { control: Control<T>; name: FieldPath<T>; label: string; body?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="setting-row">
          <div><b>{label}</b>{body ? <p>{body}</p> : null}</div>
          <Switch className="switch" isSelected={Boolean(field.value)} onChange={field.onChange} aria-label={label}>
            <span className="track" aria-hidden="true" />
          </Switch>
        </div>
      )}
    />
  );
}
