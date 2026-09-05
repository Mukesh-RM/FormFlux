import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function workerUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_WORKER_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
  return `${base}${path}`;
}

export function siteUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateShort(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function relativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateShort(value);
}

export function truncate(value: string, max = 80): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function isValidUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Fields the submission detail drawer shows separately from user data. */
export const SPECIAL_FIELD_HELP: Record<string, string> = {
  _subject: "Custom email subject",
  _cc: "Extra CC recipients",
  _replyto: "Reply-To address",
  _template: "Email layout (table or plain)",
  _format: "AJAX / JSON response mode",
  _next: "Per-submission redirect override",
  _blacklist: "Per-submission blocked phrases",
  _captcha: "Per-submission captcha override",
  _webhook: "One-off webhook destination",
  _autoresponse: "Custom autoreply body",
  _honeypot: "Bot trap field",
  _honey: "Bot trap field (FormSubmit name)",
};
