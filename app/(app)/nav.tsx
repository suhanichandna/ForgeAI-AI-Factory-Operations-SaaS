"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiPost } from "@/lib/client";
import {
  DashboardIcon,
  InventoryIcon,
  ProductsIcon,
  ProductionIcon,
  ProcurementIcon,
  MachinesIcon,
  AssistantIcon,
  ApprovalsIcon,
  AnalyticsIcon,
  SettingsIcon,
} from "@/components/icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/inventory", label: "Inventory", Icon: InventoryIcon },
  { href: "/products", label: "Products & BOM", Icon: ProductsIcon },
  { href: "/production", label: "Production", Icon: ProductionIcon },
  { href: "/procurement", label: "Procurement", Icon: ProcurementIcon },
  { href: "/machines", label: "Machines", Icon: MachinesIcon },
  { href: "/assistant", label: "AI Assistant", Icon: AssistantIcon },
  { href: "/approvals", label: "Approvals", Icon: ApprovalsIcon },
  { href: "/analytics", label: "Analytics", Icon: AnalyticsIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

const ROLE_LABELS: Record<string, string> = {
  FACTORY_ADMIN: "Factory Admin",
  PRODUCTION_MANAGER: "Production Manager",
  INVENTORY_MANAGER: "Inventory Manager",
  PROCUREMENT_MANAGER: "Procurement Manager",
  MANAGEMENT: "Management",
  EMPLOYEE: "Employee",
};

export default function Nav({ user }: { user: { name: string; role: string; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await apiPost("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-lg font-semibold tracking-tight text-slate-900">ForgeAI</p>
        <p className="text-xs text-slate-400">AI Factory Operations</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon aria-hidden className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 px-4 py-4">
        <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
        <p className="text-xs text-slate-400">{ROLE_LABELS[user.role] ?? user.role}</p>
        <button onClick={handleLogout} className="mt-2 text-xs font-medium text-slate-500 underline decoration-dotted hover:text-slate-800">
          Sign out
        </button>
      </div>
    </aside>
  );
}
