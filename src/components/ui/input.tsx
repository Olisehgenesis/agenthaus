import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-forest">{label}</label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm text-forest placeholder:text-forest-muted/60 focus:outline-none focus:ring-2 focus:ring-celo/50 focus:border-forest-light transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-400 focus:ring-red-400/50",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
