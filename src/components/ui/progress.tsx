import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  showLabel?: boolean;
  variant?: "default" | "warning" | "danger";
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, showLabel, variant = "default", ...props }, ref) => {
    const percentage = Math.min((value / max) * 100, 100);
    
    const barColors = {
      default: "bg-forest",
      warning: "bg-amber-500",
      danger: "bg-red-500",
    };

    const autoVariant = percentage > 90 ? "danger" : percentage > 70 ? "warning" : variant;

    return (
      <div className="space-y-1">
        {showLabel && (
          <div className="flex justify-between text-xs text-forest-muted">
            <span>{value.toFixed(1)}</span>
            <span>{max.toFixed(1)}</span>
          </div>
        )}
        <div
          ref={ref}
          className={cn("h-2 w-full overflow-hidden rounded-full bg-gypsum-dark", className)}
          {...props}
        >
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColors[autoVariant])}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
