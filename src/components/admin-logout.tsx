"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/admin-google", { method: "DELETE", credentials: "same-origin" });
    router.refresh();
  }

  return <button className="tf-admin-logout" type="button" onClick={logout} disabled={busy}>{busy ? "A terminar sessão…" : "Terminar sessão"}<style jsx>{`.tf-admin-logout{border:1px solid #e5e7eb;border-radius:10px;background:#fff;padding:10px 13px;color:#4b5563;font-size:13px;font-weight:600;line-height:1.2;cursor:pointer}.tf-admin-logout:hover{border-color:#f97316;color:#ea580c}.tf-admin-logout:disabled{opacity:.6;cursor:wait}`}</style></button>;
}
