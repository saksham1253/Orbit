import { forwardRef, useId } from 'react';

const Input = forwardRef(({ label, error, required, id: externalId, className = '', ...props }, ref) => {
  const generatedId = useId();
  const inputId = externalId || generatedId;

  return (
    <div className={`flex flex-col w-full gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-text-secondary uppercase tracking-wider"
        >
          {label}
          {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`input-glass w-full px-4 py-3 text-sm text-text-primary placeholder-text-muted ${
          error ? 'border-danger/60 focus:border-danger' : ''
        }`}
        {...props}
      />
      {error && (
        <span id={`${inputId}-error`} role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
