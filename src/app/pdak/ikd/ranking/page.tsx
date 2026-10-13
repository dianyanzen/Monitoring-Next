import { notFound, redirect } from "next/navigation";
import { readServerSession } from "@/lib/session";
import { hasIkdRankingAccess } from "@/lib/pdak/access";
import IkdRankingPage from "@/components/pdak/ikd/IkdRankingPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "Klasemen IKD" };
export default async function Page() {
  const user = await readServerSession();
  if (!user) redirect("/login");
  if (!(await hasIkdRankingAccess(user.S_USER_LEVEL))) notFound();
  return <IkdRankingPage />;
}
