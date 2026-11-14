import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { FieldError, Label, Text, TextArea, TextField } from 'react-aria-components';
import { useT } from '@/i18n';

interface Props<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  help?: string;
  placeholder?: string;
  /** The character limit the counter shows; the form's schema enforces it. */
  max: number;
  className?: string;
}

/**
 * Multi-line plain text (the dummy's `.note-field`): a React Aria TextField with
 * TextArea, driven by react-hook-form, with a live "n / max" counter.
 */
export function FormNoteField<T extends FieldValues>({ control, name, label, help, placeholder, max, className = 'field full' }: Props<T>) {
  const t = useT();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = (field.value as string | undefined) ?? '';
        const len = value.trim().length;
        return (
          <TextField className={className} value={value} onChange={field.onChange} onBlur={field.onBlur} isInvalid={fieldState.invalid} validationBehavior="aria">
            <Label className="label">{label}</Label>
            <TextArea className="note-field" ref={field.ref} placeholder={placeholder} rows={3} />
            <div className="note-foot">
              {help ? <Text slot="description" className="help">{help}</Text> : <span />}
              <span className={`counter${len > max ? ' over' : ''}`} aria-live="polite">{t('common.countOf', { n: len, max })}</span>
            </div>
            <FieldError className="error">{fieldState.error?.message}</FieldError>
          </TextField>
        );
      }}
    />
  );
}
