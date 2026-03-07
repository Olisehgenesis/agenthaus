import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-bold uppercase tracking-tight transition-all duration-100 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer border-2 border-forest",
  {
    variants: {
      variant: {
        default: "bg-celo text-forest shadow-hard hover:-translate-y-1 hover:shadow-hard-hover active:translate-y-px active:shadow-hard-active",
        destructive: "bg-red-500 text-forest shadow-hard hover:-translate-y-1 hover:shadow-hard-hover active:translate-y-px active:shadow-hard-active",
        outline: "bg-white text-forest shadow-hard hover:-translate-y-1 hover:shadow-hard-hover active:translate-y-px active:shadow-hard-active",
        secondary: "bg-gypsum text-forest shadow-hard hover:-translate-y-1 hover:shadow-hard-hover active:translate-y-px active:shadow-hard-active",
        ghost: "border-transparent text-forest hover:bg-forest/5",
        link: "border-transparent text-forest underline-offset-4 hover:underline",
        glow: "bg-celo text-forest shadow-hard hover:-translate-y-1 hover:shadow-hard-hover active:translate-y-px active:shadow-hard-active",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 px-4 text-xs",
        lg: "h-14 px-10 text-lg",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
