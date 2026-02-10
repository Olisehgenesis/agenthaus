import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-forest">{label}</label>
        )}
        <select
          className={cn(
            "flex h-10 w-full rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm text-forest focus:outline-none focus:ring-2 focus:ring-celo/50 focus:border-forest-light transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-400 focus:ring-red-400/50",
            className
          )}
          ref={ref}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-white text-forest">
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
