import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Nav from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Nav user={{ name: session.name, role: session.role, email: session.email }} />
      <main className="flex-1 px-6 py-6 sm:px-10 sm:py-8">{children}</main>
    </div>
  );
}
