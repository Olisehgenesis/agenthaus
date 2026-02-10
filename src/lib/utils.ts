import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: "bg-forest/10 text-forest border-forest/20",
    deploying: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    draft: "bg-forest/5 text-forest-muted border-forest/10",
    paused: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    stopped: "bg-red-500/10 text-red-600 border-red-500/20",
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    confirmed: "bg-forest/10 text-forest border-forest/20",
    failed: "bg-red-500/10 text-red-600 border-red-500/20",
  };
  return colors[status] || colors.draft;
}

export function getTemplateIcon(type: string): string {
  const icons: Record<string, string> = {
    payment: "💳",
    trading: "📈",
    forex: "💹",
    social: "💬",
    custom: "🔧",
  };
  return icons[type] || "🤖";
}

