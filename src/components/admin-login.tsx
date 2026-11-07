"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            nonce: string;
            auto_select: boolean;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number | boolean>) => void;
        };
      };
    };
  }
}

export default function AdminLogin({ clientId }: { clientId: string }) {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [nonce, setNonce] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    fetch("/api/admin-google", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível iniciar o login.");
        if (active) setNonce(result.nonce);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível iniciar o login.");
      });
    return () => { active = false; };
  }, [clientId]);

  useEffect(() => {
    if (!scriptReady || !nonce || !clientId || !buttonRef.current || !window.google) return;
    const button = buttonRef.current;
    button.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: clientId,
      nonce,
      auto_select: false,
      callback: async ({ credential }) => {
        setBusy(true);
        setError("");
        try {
          const response = await fetch("/api/admin-google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ credential }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Esta conta não tem acesso a esta área.");
          router.refresh();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Não foi possível concluir o login.");
          setBusy(false);
        }
      },
    });
    window.google.accounts.id.renderButton(button, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: 320,
      logo_alignment: "left",
    });
  }, [clientId, nonce, router, scriptReady]);

  return (
    <div className="tf-admin-login">
      {clientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptReady(true)} />}
      <section className="tf-admin-login-card">
        <div className="tf-admin-brand"><span className="tf-admin-brand-mark">TF</span><span>Travel Frontiers</span></div>
        <p className="tf-admin-eyebrow">Área reservada</p>
        <h1>Iniciar sessão</h1>
        <p className="tf-admin-lead">A calculadora de comissões está disponível apenas para a conta Google autorizada.</p>
        {!clientId ? <p className="tf-admin-error">O login Google ainda não está configurado.</p> : <div className="tf-admin-google-wrap"><div ref={buttonRef} />{busy && <span className="tf-admin-status">A validar a conta…</span>}</div>}
        {error && <p className="tf-admin-error" role="alert">{error}</p>}
        <a className="tf-admin-back" href="https://www.travelfrontiers.pt/">Voltar ao site</a>
      </section>
      <style jsx>{`
        .tf-admin-login{min-height:70vh;display:grid;place-items:center;padding:44px 20px;background:#f8fafc;color:#1f2937}
        .tf-admin-login-card{width:min(100%,460px);padding:38px;background:#fff;border:1px solid #e5e7eb;border-radius:22px;box-shadow:0 18px 48px rgba(31,41,55,.09)}
        .tf-admin-brand{display:flex;align-items:center;gap:11px;color:#111827;font-size:18px;font-weight:750;letter-spacing:-.03em}
        .tf-admin-brand-mark{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#f97316,#fbbf24);font-size:12px}
        .tf-admin-eyebrow{margin:36px 0 5px;color:#ea580c;font-size:12px;font-weight:750;letter-spacing:.13em;text-transform:uppercase}
        h1{margin:0;color:#111827;font-size:34px;line-height:1.1;letter-spacing:-.04em}
        .tf-admin-lead{margin:12px 0 24px;color:#6b7280;line-height:1.55}
        .tf-admin-google-wrap{min-height:44px}.tf-admin-status{display:block;margin-top:8px;color:#6b7280;font-size:13px}
        .tf-admin-error{margin:14px 0;color:#b91c1c;font-size:13px}
        .tf-admin-back{display:inline-block;margin-top:28px;color:#6b7280;font-size:13px;text-decoration:none}.tf-admin-back:hover{color:#ea580c}
        @media(max-width:520px){.tf-admin-login-card{padding:27px;border-radius:18px}}
      `}</style>
    </div>
  );
}
