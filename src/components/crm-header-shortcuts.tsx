import { useState } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import type { AuthorizedFetch } from "@/lib/crm-office-types";

const partners = [
  { name: "Airmet", url: "https://intranet.airmet.pt/panel/" },
  { name: "Cotur", url: "https://gupitravel.paquetedinamico.com/home?agency=746" },
];
const button = "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60";

export default function CrmHeaderShortcuts({ authorizedFetch, connected }: { authorizedFetch: AuthorizedFetch; connected: boolean }) {
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copyIban() {
    if (copying || !connected) return;
    setCopying(true);
    setCopied(false);
    setError("");
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard) throw new Error("O navegador não permite copiar neste ecrã.");
      const value = authorizedFetch("/api/crm/agency-iban").then(async response => {
        const data = await response.json();
        if (!response.ok || typeof data.iban !== "string" || !data.iban) {
          throw new Error(data.error || "O IBAN da GupiTravel está indisponível.");
        }
        return data.iban as string;
      });

      if (typeof ClipboardItem === "function" && typeof clipboard.write === "function") {
        // Start the write during the click so Safari keeps the clipboard permission.
        const text = value.then(iban => new Blob([iban], { type: "text/plain" }));
        await Promise.all([text, clipboard.write([new ClipboardItem({ "text/plain": text })])]);
      } else {
        await clipboard.writeText(await value);
      }
      setCopied(true);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "Error" ? cause.message : "Não foi possível copiar o IBAN.");
    } finally {
      setCopying(false);
    }
  }

  const Icon = copied ? Check : Copy;
  return <div role="group" aria-label="Atalhos do CRM" className="flex flex-wrap items-center gap-2">
    {partners.map(partner => <a className={button} key={partner.name} href={partner.url}
      target="_blank" rel="noopener noreferrer" aria-label={partner.name + " (abre num novo separador)"}>
      {partner.name}<ArrowUpRight className="size-4" aria-hidden="true" />
    </a>)}
    <button type="button" className={button} disabled={!connected || copying} onClick={() => void copyIban()}>
      <Icon className="size-4" aria-hidden="true" />{copying ? "A copiar…" : "Copiar IBAN GupiTravel"}
    </button>
    <span role="status" className={error ? "w-full text-sm text-red-700" : "sr-only"}>{error || (copied ? "IBAN copiado." : "")}</span>
    {copied && <span className="text-sm font-medium text-orange-800" aria-hidden="true">IBAN copiado</span>}
  </div>;
}
