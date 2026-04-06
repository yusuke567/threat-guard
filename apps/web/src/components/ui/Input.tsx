import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.replace(/\s+/g, '-').toLowerCase();
    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--text-primary)] mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-default)] bg-surface-card text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors ${className}`}
          {...props}
        />
        {hint && (
          <p className="text-xs text-[var(--text-tertiary)] mt-1">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
