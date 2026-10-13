import { notFound, redirect } from "next/navigation";
import { readServerSession } from "@/lib/session";
import { hasIkdRankingAccess } from "@/lib/pdak/access";
import IkdRegionPage from "@/components/pdak/ikd/IkdRegionPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "Profil Wilayah IKD" };
export default async function Page({
  params,
}: {
  params: Promise<{ kode: string }>;
}) {
  const user = await readServerSession();
  if (!user) redirect("/login");
  if (!(await hasIkdRankingAccess(user.S_USER_LEVEL))) notFound();
  const { kode } = await params;
  return <IkdRegionPage code={kode} />;
}
