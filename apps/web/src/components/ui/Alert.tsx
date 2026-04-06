import { HTMLAttributes, forwardRef } from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

const variantStyles: Record<AlertVariant, string> = {
  info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
  warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
};

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'info', className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-xl border p-4 ${variantStyles[variant]} ${className}`}
        role="alert"
        {...props}
      >
        {children}
      </div>
    );
  }
);

Alert.displayName = 'Alert';
export default Alert;
