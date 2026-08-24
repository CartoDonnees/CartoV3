import { getSessionUser } from "@/lib/auth-server";
import { CoverageDeclaration } from "@/components/dashboard/CoverageDeclaration";

/** L'opérateur ne déclare que pour son propre réseau. */
export default async function OperatorCoverageDataPage() {
  const user = await getSessionUser();
  return <CoverageDeclaration operator={user?.operator?.name ?? null} />;
}
