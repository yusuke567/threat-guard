import { HTMLAttributes, forwardRef } from 'react';

type CardVariant = 'default' | 'interactive' | 'status';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-surface-card border border-[var(--border-default)]',
  interactive: 'bg-surface-card border border-[var(--border-default)] hover:bg-surface-elevated cursor-pointer transition-colors',
  status: 'border-2',
};

const paddingStyles = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-xl ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
export default Card;
