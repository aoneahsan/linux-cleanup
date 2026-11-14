import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { FieldError, Input, Label, Text, TextField } from 'react-aria-components';

interface Props<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  ariaLabel?: string;
  help?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password';
  mono?: boolean;
  className?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  isDisabled?: boolean;
  /** Hard cap on typed characters (the schema still validates the same limit). */
  maxLength?: number;
  /** Called after the field's own blur (e.g. save-on-blur). */
  onBlur?: () => void;
}

/** A React Aria text field driven by react-hook-form (validation from the form's zod schema). */
export function FormTextField<T extends FieldValues>({ control, name, label, ariaLabel, help, placeholder, type = 'text', mono, className = 'field', autoComplete, autoFocus, isDisabled, maxLength, onBlur }: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          className={className}
          type={type}
          value={(field.value as string | undefined) ?? ''}
          onChange={field.onChange}
          onBlur={() => { field.onBlur(); onBlur?.(); }}
          isInvalid={fieldState.invalid}
          validationBehavior="aria"
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          isDisabled={isDisabled}
          maxLength={maxLength}
          aria-label={label ? undefined : ariaLabel}
        >
          {label ? <Label>{label}</Label> : null}
          <Input className={`input${mono ? ' mono' : ''}`} ref={field.ref} placeholder={placeholder} />
          {help ? <Text slot="description" className="help">{help}</Text> : null}
          <FieldError className="error">{fieldState.error?.message}</FieldError>
        </TextField>
      )}
    />
  );
}
