import { notFound, redirect } from "next/navigation";
import PdakUploadPage from "@/components/pdak/PdakUploadPage";
import { hasPdakUploadAccess } from "@/lib/pdak/access";
import { readServerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const session = await readServerSession();
  if (!session?.S_USER_ID) redirect("/login");
  if (!(await hasPdakUploadAccess(session.S_USER_LEVEL))) notFound();
  return <PdakUploadPage />;
}
