import { redirect } from "next/navigation";
import { getSessionUser, STAFF_ROLES } from "@/lib/auth-server";
import DashboardShell from "@/components/dashboard/DashboardShell";

/** Layout du back-office : garde d'accès (staff uniquement) + shell. */
export default async function DashboardLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect("/carte");
  if (!STAFF_ROLES.includes(user.role)) redirect("/carte");

  const safeUser = {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    operator: user.operator ? { name: user.operator.name, color: user.operator.color } : null,
  };

  return <DashboardShell user={safeUser}>{children}</DashboardShell>;
}
