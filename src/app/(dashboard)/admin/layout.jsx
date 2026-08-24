import { redirect } from "next/navigation";
import { getSessionUser, homePathForRole } from "@/lib/auth-server";

export default async function AdminLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect("/carte");
  if (user.role !== "ADMIN") redirect(homePathForRole(user.role));
  return children;
}
