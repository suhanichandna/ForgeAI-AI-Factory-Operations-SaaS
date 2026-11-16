import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";

/** §15 Settings: users, roles, factory configuration (read-only in this prototype). */
export const GET = withErrorHandling(async () => {
  const session = await requireUser();
  const [users, company, factories] = await Promise.all([
    prisma.user.findMany({ where: { companyId: session.companyId }, orderBy: { role: "asc" } }),
    prisma.company.findUniqueOrThrow({ where: { id: session.companyId } }),
    prisma.factory.findMany({ where: { companyId: session.companyId }, include: { warehouses: true, machines: true } }),
  ]);
  return NextResponse.json({
    company: { id: company.id, name: company.name },
    factories: factories.map((f) => ({ id: f.id, name: f.name, location: f.location, warehouseCount: f.warehouses.length, machineCount: f.machines.length })),
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
  });
});
