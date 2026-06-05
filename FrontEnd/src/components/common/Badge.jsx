import React from 'react';

const Badge = ({ children, variant = 'primary', className = '' }) => {
  const variants = {
    primary: 'bg-accent/20 text-accent border-accent/50',
    secondary: 'bg-secondary/20 text-secondary border-secondary/50',
    amber: 'bg-amber/20 text-amber border-amber/50',
    danger: 'bg-danger/20 text-danger border-danger/50',
    gray: 'bg-gray-500/20 text-gray-300 border-gray-500/50'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
