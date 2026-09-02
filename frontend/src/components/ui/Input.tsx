import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = '', ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-2.5 text-sm font-medium
            bg-white/80 border border-white/60 rounded-xl shadow-[0_4px_12px_rgb(0,0,0,0.05)] backdrop-blur-md
            text-slate-900 placeholder:text-slate-400
            dark:bg-slate-900/60 dark:border-white/10 dark:text-slate-100 dark:placeholder:text-slate-500
            transition-all duration-300
            focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 dark:focus:border-primary-500/50
            disabled:bg-slate-100/50 disabled:text-slate-500 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600
            ${error ? 'border-danger-500 focus:ring-danger-500/20 focus:border-danger-500' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-danger-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
