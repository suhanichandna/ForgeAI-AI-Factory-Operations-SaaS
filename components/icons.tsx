/**
 * Minimal hand-authored line icons (no emoji, no icon-font dependency) used
 * in the sidebar nav. 20x20 viewBox, stroke-based, inherits currentColor so
 * they follow the active/inactive nav item color automatically.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="10.5" width="3.5" height="7" rx="0.5" />
      <rect x="8.25" y="6" width="3.5" height="11.5" rx="0.5" />
      <rect x="14" y="2.5" width="3.5" height="15" rx="0.5" />
    </svg>
  );
}

export function InventoryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 6.2 10 2.5l7.5 3.7-7.5 3.7-7.5-3.7Z" />
      <path d="M2.5 6.2v7.6L10 17.5l7.5-3.7V6.2" />
      <path d="M10 9.9v7.6" />
    </svg>
  );
}

export function ProductsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="0.75" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="0.75" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="0.75" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="0.75" />
    </svg>
  );
}

export function ProductionIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 17.5v-7l4.5 3v-3l4.5 3v-3l4.5 3v-2.2c0-.4.32-.8.72-.8H17c.28 0 .5.22.5.5v6.5H2.5Z" />
      <path d="M5 7V3.5" />
      <path d="M8.5 7V4.5" />
    </svg>
  );
}

export function ProcurementIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3h1.6l1.2 10.2a1.5 1.5 0 0 0 1.5 1.3h6.9a1.5 1.5 0 0 0 1.48-1.24l1.1-6.26H5.3" />
      <circle cx="8" cy="17" r="1.1" />
      <circle cx="14.5" cy="17" r="1.1" />
    </svg>
  );
}

export function MachinesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 3v2M10 15v2M17 10h-2M5 10H3M14.9 5.1l-1.4 1.4M6.5 13.5l-1.4 1.4M14.9 14.9l-1.4-1.4M6.5 6.5 5.1 5.1" />
    </svg>
  );
}

export function AssistantIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="3.5" width="15" height="10.5" rx="2" />
      <path d="M6.5 8.5h7M6.5 11h4.5" />
      <path d="M7 14v2.7l3-2.7" />
    </svg>
  );
}

export function ApprovalsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M6.8 10.2l2.1 2.1 4.3-4.6" />
    </svg>
  );
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 17.5h15" />
      <path d="M2.5 14 7 8.5l3 3 5.5-6.5" />
      <path d="M12 4.5h3.5V8" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8.4 3h3.2l.5 2.1a5.9 5.9 0 0 1 1.6.9l2.1-.7 1.6 2.8-1.6 1.4a5.9 5.9 0 0 1 0 1.9l1.6 1.4-1.6 2.8-2.1-.7a5.9 5.9 0 0 1-1.6.9l-.5 2.1H8.4l-.5-2.1a5.9 5.9 0 0 1-1.6-.9l-2.1.7-1.6-2.8 1.6-1.4a5.9 5.9 0 0 1 0-1.9L2.6 8.1l1.6-2.8 2.1.7a5.9 5.9 0 0 1 1.6-.9L8.4 3Z" />
      <circle cx="10" cy="10" r="2.4" />
    </svg>
  );
}
