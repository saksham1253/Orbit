import { forwardRef } from 'react';

const Input = forwardRef(({ label, error, className = '', ...props }, ref) => (
  <div className={`flex flex-col w-full gap-1.5 ${className}`}>
    {label && (
      <label className="text-xs font-semibold text-white/55 uppercase tracking-wider">
        {label}
      </label>
    )}
    <input
      ref={ref}
      className={`input-glass w-full px-4 py-3 text-sm text-white placeholder-white/25 ${
        error ? 'border-danger/60 focus:border-danger' : ''
      }`}
      {...props}
    />
    {error && <span className="text-xs text-danger">{error}</span>}
  </div>
));

Input.displayName = 'Input';
export default Input;
