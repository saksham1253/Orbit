import { forwardRef } from 'react';

const VARIANTS = {
  primary: 'btn-gradient text-white',
  secondary: 'bg-surface hover:bg-surface-hover text-white transition-all',
  danger: 'bg-danger/15 hover:bg-danger text-danger hover:text-white border border-danger/40 transition-all',
  ghost: 'text-white/60 hover:text-white hover:bg-white/05 transition-all',
  outline: 'border border-border text-white/70 hover:text-white hover:border-accent/50 hover:bg-accent/05 transition-all',
};

const Button = forwardRef(({ children, variant = 'primary', className = '', ...props }, ref) => (
  <button
    ref={ref}
    className={`
      inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-medium text-sm
      active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
      ${VARIANTS[variant] || VARIANTS.primary}
      ${className}
    `}
    {...props}
  >
    {children}
  </button>
));

Button.displayName = 'Button';
export default Button;
