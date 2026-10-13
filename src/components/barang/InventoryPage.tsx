import { readServerSession } from "@/lib/session";
import {
  inventoryPermissions,
  allowed,
  type InventoryMode,
} from "@/lib/barang/access";
import InventoryWorkspace from "./InventoryWorkspace";
export default async function InventoryPage({ mode }: { mode: InventoryMode }) {
  const session = await readServerSession();
  const permissions = await inventoryPermissions(session?.S_USER_LEVEL);
  if (!allowed(permissions, mode))
    return (
      <section className="monalisa-ops ops-empty" role="alert">
        Anda tidak memiliki izin untuk menu ini.
      </section>
    );
  return (
    <InventoryWorkspace key={mode} mode={mode} permissions={permissions} />
  );
}
