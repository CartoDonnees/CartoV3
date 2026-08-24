import { redirect } from "next/navigation";
import { getSessionUser, homePathForRole } from "@/lib/auth-server";

export default async function SupervisorLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect("/carte");
  if (user.role !== "SUPERVISOR" && user.role !== "CONTROLLER") redirect(homePathForRole(user.role));
  return children;
}
