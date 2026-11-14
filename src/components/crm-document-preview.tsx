import { useEffect, useRef, useState } from "react";
import { officeSecondary } from "@/lib/crm-office-types";

export const documentReviewLayout = "@container";
export const documentReviewColumns = "grid items-start gap-4 @min-[44rem]:grid-cols-2";

export default function CrmDocumentPreview({ pages }: { pages: Blob[] }) {
  const [page, setPage] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const blob = pages[page];

  useEffect(() => {
    if (!blob || !image.current) return;
    const element = image.current;
    const url = URL.createObjectURL(blob);
    element.src = url;
    return () => {
      element.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  return <section data-document-preview aria-label="Documento para comparação" className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-white p-3 @min-[44rem]:sticky @min-[44rem]:top-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">Documento para comparação</h4>
      {blob && <button type="button" aria-pressed={zoomed} className={officeSecondary} onClick={() => setZoomed(value => !value)}>
        {zoomed ? "Ajustar à largura" : "Ampliar"}
      </button>}
    </div>
    {pages.length > 1 && <div role="group" aria-label="Páginas do documento" className="flex flex-wrap gap-2">
      {pages.map((_, index) => <button key={index} type="button" aria-pressed={page === index}
        className={page === index ? "min-h-10 rounded-full bg-orange-800 px-4 text-sm font-semibold text-white" : officeSecondary}
        onClick={() => setPage(index)}>Página {index + 1}</button>)}
    </div>}
    {blob && <div key={page} role={zoomed ? "region" : undefined} aria-label={zoomed ? "Documento ampliado, desloca para ver os detalhes" : undefined}
      tabIndex={zoomed ? 0 : undefined} className={zoomed ? "max-h-[55vh] overflow-auto rounded-lg border border-slate-200 bg-white" : "overflow-hidden rounded-lg border border-slate-200 bg-white"}>
      {/* The blob URL is local to this review and is revoked when the preview closes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={image} alt={"Documento original, página " + (page + 1)}
        className={zoomed ? "block w-[200%] max-w-none" : "block max-h-[55vh] w-full object-contain"}/>
    </div>}
  </section>;
}
