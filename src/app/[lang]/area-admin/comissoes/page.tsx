import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminLogin from "@/components/admin-login";
import AdminLogout from "@/components/admin-logout";
import CommissionCalculator from "@/components/commission-calculator";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Área reservada | Travel Frontiers",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CommissionAdminPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "pt") redirect("/pt/area-admin/comissoes");

  const admin = await getAdminSession();
  if (!admin) return <AdminLogin clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""} />;

  return <>
    <div className="tf-admin-session"><span>Área reservada · {admin.email}</span><AdminLogout /></div>
    <CommissionCalculator />
    <style>{`.tf-admin-session{max-width:1120px;margin:0 auto;padding:24px 20px 0;display:flex;justify-content:space-between;align-items:center;gap:14px;color:#6b7280;font-size:13px}@media(max-width:520px){.tf-admin-session{padding:18px 14px 0;align-items:flex-start;flex-direction:column}}`}</style>
  </>;
}
