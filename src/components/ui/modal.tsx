"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X, RotateCcw } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** Optional "Use default" button — resets form/options to defaults */
  onUseDefault?: () => void;
}

export function Modal({ open, onClose, children, className, onUseDefault }: ModalProps) {
  // Close on Escape key
  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-forest/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Content */}
      <div
        className={cn(
          "relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-forest/10 bg-white shadow-2xl shadow-forest/10 animate-in fade-in zoom-in-95 duration-200",
          className
        )}
      >
        <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
          {onUseDefault && (
            <button
              onClick={onUseDefault}
              className="p-1.5 rounded-lg text-forest-muted hover:text-forest hover:bg-gypsum-dark transition-colors cursor-pointer text-xs flex items-center gap-1"
              title="Use default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Default
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-forest-muted hover:text-forest hover:bg-gypsum-dark transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
