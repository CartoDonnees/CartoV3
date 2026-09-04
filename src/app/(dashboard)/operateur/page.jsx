import { getSessionUser } from "@/lib/auth-server";
import { PageHead } from "@/components/dashboard/ui";
import { RoleCoverage } from "@/components/dashboards/RoleCoverage";

/** Espace opérateur : les indicateurs sont restreints à son propre réseau. */
export default async function OperatorDashboard() {
  const user = await getSessionUser();
  const operator = user?.operator?.name ?? null;

  return (
    <div>
      <PageHead
        title="Espace opérateur"
        subtitle={
          operator
            ? `Couverture du réseau ${operator} - statistiques, historique et zones non couvertes.`
            : "Aucun opérateur n'est rattaché à ce compte."
        }
      />
      <RoleCoverage operator={operator} />
    </div>
  );
}
