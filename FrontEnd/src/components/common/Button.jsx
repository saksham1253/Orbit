import { forwardRef } from 'react';

const VARIANTS = {
  primary: 'btn-gradient text-text-primary',
  secondary: 'bg-surface hover:bg-surface-hover text-text-primary transition-all',
  danger: 'bg-danger/15 hover:bg-danger text-danger hover:text-text-primary border border-danger/40 transition-all',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all',
  outline: 'border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 hover:bg-accent/05 transition-all',
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
