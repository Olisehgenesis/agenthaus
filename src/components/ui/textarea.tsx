import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-forest">{label}</label>
        )}
        <textarea
          className={cn(
            "flex min-h-[120px] w-full rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm text-forest placeholder:text-forest-muted/60 focus:outline-none focus:ring-2 focus:ring-celo/50 focus:border-forest-light transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 font-mono",
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
Textarea.displayName = "Textarea";

export { Textarea };
