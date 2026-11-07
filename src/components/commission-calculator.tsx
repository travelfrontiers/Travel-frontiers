"use client";

import { useMemo, useState } from "react";

const roundEuro = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const formatEuro = (value: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number.isFinite(value) ? value : 0);

function amount(value: string) {
  return Math.max(0, Number(value) || 0);
}

export default function CommissionCalculator() {
  const [commission, setCommission] = useState("617.49");
  const [travelerCount, setTravelerCount] = useState("4");
  const [travelerPrice, setTravelerPrice] = useState("1286");
  const [selfTravels, setSelfTravels] = useState(false);
  const [costPerTraveler, setCostPerTraveler] = useState("1120.43");
  const [shareSaving, setShareSaving] = useState(false);
  const [cedeCommission, setCedeCommission] = useState(false);
  const [requestedCession, setRequestedCession] = useState("0");

  const result = useMemo(() => {
    const commissionTotal = amount(commission);
    const people = Math.max(1, Math.floor(Number(travelerCount) || 1));
    const price = amount(travelerPrice);
    const cost = amount(costPerTraveler);
    const requested = amount(requestedCession);
    const others = selfTravels ? Math.max(0, people - 1) : people;
    const gross = roundEuro(commissionTotal * 0.8);
    const ownCostPlusOne = selfTravels ? roundEuro(cost * 1.01) : 0;
    const potentialSaving = selfTravels ? Math.max(0, roundEuro(price - ownCostPlusOne)) : 0;
    const sharing = selfTravels && shareSaving && people > 1;
    const savingEach = sharing ? potentialSaving / people : 0;
    const sharedPrice = sharing ? price - savingEach : price;
    const ownPrice = selfTravels ? (sharing ? sharedPrice : ownCostPlusOne) : null;
    const othersPriceBeforeCession = sharedPrice;
    const cessionActive = !selfTravels || (cedeCommission && others > 0);
    const maxCession = cessionActive ? Math.min(gross, roundEuro(othersPriceBeforeCession * others)) : 0;
    const ceded = roundEuro(Math.min(requested, maxCession));
    const netCommission = roundEuro(gross - ceded);
    const cessionEach = others > 0 ? ceded / others : 0;
    const otherFinalPrice = others > 0 ? Math.max(0, roundEuro(othersPriceBeforeCession - cessionEach)) : null;
    const totalCollected = selfTravels
      ? roundEuro((ownPrice ?? 0) + othersPriceBeforeCession * others - ceded)
      : roundEuro(othersPriceBeforeCession * others - ceded);
    return {
      people, others, gross, ownCostPlusOne, ownPrice, potentialSaving, savingEach, sharing,
      sharedPrice, ceded, netCommission, cessionEach, otherFinalPrice, totalCollected,
      maxCession, cessionActive,
    };
  }, [commission, travelerCount, travelerPrice, selfTravels, costPerTraveler, shareSaving, cedeCommission, requestedCession]);

  const cessionVisible = !selfTravels || (cedeCommission && result.others > 0);
  const sharingVisible = selfTravels && shareSaving && result.people > 1;

  return (
    <div className="tf-calc">
      <header className="tf-calc-intro">
        <p className="tf-calc-eyebrow">Área de consultoria</p>
        <h1>Calculadora de comissão</h1>
        <p>Introduz os valores da viagem e define quanto da tua comissão queres ceder aos viajantes.</p>
      </header>
      <div className="tf-calc-grid">
        <section className="tf-calc-card" aria-labelledby="trip-data-heading">
          <div className="tf-calc-section-title"><span>01</span><h2 id="trip-data-heading">Dados da viagem</h2></div>
          <div className="tf-calc-field">
            <label htmlFor="total-commission">Comissão total da viagem <span>euros</span></label>
            <input id="total-commission" type="number" min="0" step="0.01" value={commission} onChange={(event) => setCommission(event.target.value)} />
            <small>Soma das comissões dos elementos vendidos.</small>
          </div>
          <div className="tf-calc-fields-two">
            <div className="tf-calc-field"><label htmlFor="traveler-count">Número de viajantes</label><input id="traveler-count" type="number" min="1" step="1" value={travelerCount} onChange={(event) => setTravelerCount(event.target.value)} /></div>
            <div className="tf-calc-field"><label htmlFor="traveler-price">Preço por viajante <span>euros</span></label><input id="traveler-price" type="number" min="0" step="0.01" value={travelerPrice} onChange={(event) => setTravelerPrice(event.target.value)} /></div>
          </div>
          <label className="tf-calc-toggle"><input type="checkbox" checked={selfTravels} onChange={(event) => setSelfTravels(event.target.checked)} /><span><strong>Também vou nesta viagem</strong><small>Ativa o auto-consumo e indica o teu custo por viajante.</small></span></label>
          {selfTravels && <div className="tf-calc-nested">
            <div className="tf-calc-field"><label htmlFor="cost-per-traveler">Custo por viajante <span>euros</span></label><input id="cost-per-traveler" type="number" min="0" step="0.01" value={costPerTraveler} onChange={(event) => setCostPerTraveler(event.target.value)} /><small>O teu preço é o custo acrescido de 1%.</small></div>
            <label className="tf-calc-toggle"><input type="checkbox" checked={shareSaving} onChange={(event) => setShareSaving(event.target.checked)} /><span><strong>Distribuir a poupança de auto-consumo por todos?</strong><small>Divide a poupança igualmente pelo grupo. Esta opção é independente da cedência da comissão.</small></span></label>
            {result.people === 1 && <small className="tf-calc-help">És a única pessoa viajante, por isso não há poupança a repartir pelo grupo.</small>}
          </div>}
          <hr />
          <div className="tf-calc-section-title"><span>02</span><h2>Cedência da comissão</h2></div>
          {selfTravels && <label className="tf-calc-toggle tf-calc-toggle-spaced"><input type="checkbox" checked={cedeCommission} disabled={result.others === 0} onChange={(event) => setCedeCommission(event.target.checked)} /><span><strong>Queres ceder parte da comissão aos outros passageiros?</strong><small>Esta decisão não altera a partilha da poupança de auto-consumo.</small></span></label>}
          {cessionVisible && <div className="tf-calc-cession">
            <div className="tf-calc-field"><label htmlFor="commission-cession">Montante total a ceder <span>euros</span></label><div className="tf-calc-amount"><input id="commission-cession" type="number" min="0" max={result.maxCession} step="0.01" value={requestedCession} onChange={(event) => setRequestedCession(event.target.value)} /><span>€</span></div><small>Este valor será dividido igualmente pelos {selfTravels ? "restantes " : ""}viajantes.</small>{amount(requestedCession) > result.maxCession && <p className="tf-calc-warning" role="status">A cedência foi limitada ao máximo disponível: {formatEuro(result.maxCession)}.</p>}</div>
          </div>}
          {!cessionVisible && selfTravels && result.others > 0 && <p className="tf-calc-muted">A comissão não será cedida. Podes ativar essa decisão sem alterar a partilha do benefício de auto-consumo.</p>}
        </section>

        <aside className="tf-calc-card tf-calc-result" aria-labelledby="trip-summary-heading">
          <div className="tf-calc-summary-head"><div className="tf-calc-section-title"><span>03</span><h2 id="trip-summary-heading">Resumo da viagem</h2></div><p>{selfTravels ? "Auto-consumo · também viajas" : "Sem auto-consumo"}</p></div>
          <div className="tf-calc-hero"><span>A tua comissão depois da cedência</span><output>{formatEuro(result.netCommission)}</output><small>Valor líquido estimado</small></div>
          <div className="tf-calc-breakdown">
            <div><span>Comissão antes da cedência</span><strong>{formatEuro(result.gross)}</strong></div>
            <div><span>Comissão cedida</span><strong>{formatEuro(result.ceded)}</strong></div>
            {selfTravels && <div><span>{sharingVisible ? "O teu preço com partilha" : "Preço da tua viagem"}</span><strong>{formatEuro(result.ownPrice ?? 0)}</strong></div>}
            {sharingVisible && <><div><span>Poupança de auto-consumo por passageiro</span><strong>{formatEuro(result.savingEach)}</strong></div><div><span>Preço por passageiro após partilha</span><strong>{formatEuro(result.sharedPrice)}</strong></div></>}
            <div><span>Preço de cada outro passageiro</span><strong>{result.otherFinalPrice === null ? "—" : formatEuro(result.otherFinalPrice)}</strong></div>
            <div className="tf-calc-total"><span>Total cobrado na viagem</span><strong>{formatEuro(result.totalCollected)}</strong></div>
          </div>
          <div className="tf-calc-cession-result"><span>Cedência da comissão por passageiro</span><strong>{result.others ? formatEuro(result.cessionEach) : "Sem passageiros restantes"}</strong></div>
          <p className="tf-calc-note">{selfTravels
            ? (sharingVisible
              ? `A tua poupança de auto-consumo (${formatEuro(result.potentialSaving)}) é repartida igualmente pelos ${result.people} passageiros. A cedência da comissão é calculada à parte.`
              : "O teu preço é custo + 1%. Os outros passageiros mantêm o preço completo, salvo qualquer cedência da comissão que escolhas.")
            : "Sem auto-consumo, a comissão antes da cedência corresponde a 80% da comissão total. O montante escolhido é repartido igualmente pelos passageiros."}</p>
        </aside>
      </div>
      <p className="tf-calc-device-note">Os valores são calculados neste dispositivo e não são enviados para nenhum serviço.</p>
      <style jsx>{`
        .tf-calc{max-width:1120px;margin:0 auto;padding:26px 20px 64px;color:#374151}
        .tf-calc-intro{margin-bottom:26px}.tf-calc-eyebrow{margin:0;color:#ea580c;font-size:12px;font-weight:750;letter-spacing:.14em;text-transform:uppercase}
        .tf-calc-intro h1{margin:6px 0 8px;color:#1a1a1a;font-size:clamp(30px,4vw,42px);line-height:1.1;letter-spacing:-.045em}.tf-calc-intro>p:last-child{margin:0;color:#6b7280;max-width:620px}
        .tf-calc-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(340px,.95fr);gap:22px;align-items:start}
        .tf-calc-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:25px;box-shadow:0 18px 48px rgba(31,41,55,.08)}
        .tf-calc-section-title{display:flex;align-items:center;gap:12px;margin-bottom:20px}.tf-calc-section-title>span{width:31px;height:31px;display:grid;place-items:center;border-radius:10px;background:#fff7ed;color:#ea580c;font-size:14px;font-weight:800}.tf-calc-section-title h2{margin:0;color:#1a1a1a;font-size:18px;letter-spacing:-.02em}
        .tf-calc-field{margin:0 0 17px}.tf-calc-field label{display:flex;justify-content:space-between;gap:10px;margin-bottom:7px;color:#1a1a1a;font-size:14px;font-weight:700}.tf-calc-field label span{color:#6b7280;font-size:12px;font-weight:500}
        .tf-calc-field input{width:100%;height:48px;border:1px solid #d1d5db;border-radius:11px;background:#fff;padding:0 13px;color:#1a1a1a;font:inherit;font-variant-numeric:tabular-nums}.tf-calc-field input:focus{outline:none;border-color:#f97316;box-shadow:0 0 0 4px #f973161c}.tf-calc-field small,.tf-calc-help{display:block;margin-top:5px;color:#6b7280;font-size:12px;line-height:1.45}
        .tf-calc-fields-two{display:grid;grid-template-columns:1fr 1fr;gap:13px}.tf-calc-toggle{display:flex;align-items:center;gap:12px;padding:14px 15px;background:#fffaf5;border:1px solid #fed7aa;border-radius:13px;cursor:pointer}.tf-calc-toggle input{width:19px;height:19px;margin:0;accent-color:#f97316;flex:none}.tf-calc-toggle strong{display:block;color:#1a1a1a;font-size:14px}.tf-calc-toggle small{display:block;margin-top:2px;color:#6b7280;font-size:12px;line-height:1.4}.tf-calc-toggle input:disabled{cursor:not-allowed}.tf-calc-nested{margin-top:15px}.tf-calc-nested .tf-calc-field{margin-bottom:14px}
        .tf-calc hr{border:0;border-top:1px solid #f0f1f2;margin:20px 0}.tf-calc-toggle-spaced{margin-bottom:14px}.tf-calc-cession{padding:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:15px}.tf-calc-cession .tf-calc-field{margin:0}.tf-calc-amount{position:relative}.tf-calc-amount input{padding-right:48px}.tf-calc-amount>span{position:absolute;right:15px;top:12px;color:#6b7280;font-weight:700}.tf-calc-warning{margin:8px 2px 0;color:#9a3412;font-size:12px}.tf-calc-muted{color:#6b7280;font-size:13px;line-height:1.5}
        .tf-calc-result{position:sticky;top:20px;overflow:hidden}.tf-calc-summary-head{margin-bottom:15px}.tf-calc-summary-head .tf-calc-section-title{margin-bottom:0}.tf-calc-summary-head>p{margin:4px 0 0;color:#6b7280;font-size:13px}
        .tf-calc-hero{border-radius:17px;padding:19px 20px;color:#fff;background:linear-gradient(125deg,#f97316,#f59e0b);box-shadow:0 12px 26px #f973162b}.tf-calc-hero>span,.tf-calc-hero small{display:block;color:#fff5e9;font-size:12px}.tf-calc-hero output{display:block;margin-top:4px;font-size:clamp(32px,4vw,42px);line-height:1.12;font-weight:800;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.tf-calc-hero small{margin-top:5px}
        .tf-calc-breakdown{margin-top:17px}.tf-calc-breakdown>div{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid #f0f1f2;font-size:13px}.tf-calc-breakdown>div:last-child{border:0}.tf-calc-breakdown span{color:#6b7280}.tf-calc-breakdown strong{color:#1a1a1a;text-align:right;font-variant-numeric:tabular-nums}.tf-calc-breakdown .tf-calc-total strong{color:#ea580c}
        .tf-calc-cession-result{display:flex;justify-content:space-between;gap:12px;margin-top:15px;padding:12px 13px;background:#f9fafb;border-radius:12px;font-size:13px}.tf-calc-cession-result span{color:#6b7280}.tf-calc-cession-result strong{text-align:right;color:#1a1a1a}.tf-calc-note,.tf-calc-device-note{color:#6b7280;font-size:12px;line-height:1.5}.tf-calc-note{margin:15px 0 0}.tf-calc-device-note{text-align:center;margin:25px 0 0;color:#9ca3af}
        @media(max-width:820px){.tf-calc-grid{grid-template-columns:1fr}.tf-calc-result{position:static;order:-1}}@media(max-width:520px){.tf-calc{padding:24px 14px 50px}.tf-calc-card{padding:19px;border-radius:17px}.tf-calc-fields-two{grid-template-columns:1fr;gap:0}.tf-calc-intro h1{font-size:32px}}
      `}</style>
    </div>
  );
}
