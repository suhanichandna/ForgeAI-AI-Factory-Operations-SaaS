import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const RISK_STYLES: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  MEDIUM: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  LOW: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
};

export function RiskBadge({ level }: { level: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RISK_STYLES[level] ?? "bg-slate-100 text-slate-700"}`}>{level}</span>;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  REJECTED: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-400/20",
  DRAFT: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-400/20",
  ORDERED: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  RECEIVED: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  CANCELLED: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-400/20",
  PLANNED: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-400/20",
  RELEASED: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  RUNNING: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  ATTENTION: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700"}`}>{status.replace(/_/g, " ")}</span>;
}

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "warn" | "danger" | "good" }) {
  const toneClass = { default: "text-slate-900", warn: "text-amber-600", danger: "text-red-600", good: "text-emerald-600" }[tone];
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-300",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50",
    danger: "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-300",
    ghost: "text-slate-600 hover:bg-slate-100 disabled:opacity-50",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function Spinner() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">{message}</div>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50">{children}</thead>;
}
// children is optional: tables use a bare <Th /> for the trailing
// actions column, which has no visible header text.
export function Th({ children }: { children?: ReactNode }) {
  return <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</th>;
}
export function Td({ children, className = "", colSpan }: { children: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td className={`px-4 py-2.5 text-slate-700 ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
