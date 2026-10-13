import { notFound, redirect } from "next/navigation";
import { readServerSession } from "@/lib/session";
import { hasPdakViewAccess } from "@/lib/pdak/access";
import PdakDataPage from "@/components/pdak/PdakDataPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "Data PDAK" };
export default async function Page() {
  const user = await readServerSession();
  if (!user) redirect("/login");
  if (!(await hasPdakViewAccess(user.S_USER_LEVEL))) notFound();
  return <PdakDataPage />;
}
