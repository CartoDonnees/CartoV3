import { redirect } from "next/navigation";
import { getSessionUser, homePathForRole } from "@/lib/auth-server";

export default async function OperatorLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect("/carte");
  if (user.role !== "OPERATOR") redirect(homePathForRole(user.role));
  return children;
}
