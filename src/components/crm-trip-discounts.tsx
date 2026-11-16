import { useState, type FormEvent } from "react";
import { roundEuro } from "@/lib/commission";
import { formatMoney, formatFinanceDate, tripDiscountKinds, type FinanceDetail, type TripDiscount } from "@/lib/crm-finance";
import { officeButton, officeInput, officeSecondary } from "@/lib/crm-office-types";

type DiscountValues = {
  kind: TripDiscount["kind"]; amount: string; charge_commission: boolean; included_in_total: boolean;
  notes: string; source_schedule_id: string; source_receipt_id: string;
};

export function CrmTripDiscounts({ detail, busy, onSave, onReverse }: {
  detail: FinanceDetail; busy: boolean; onSave: (values: DiscountValues) => Promise<void>; onReverse: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TripDiscount["kind"]>("participant");
  const [amount, setAmount] = useState("");
  const { summary, commission, schedule, receipts } = detail;
  const discounts = detail.discounts || [];
  const { currency } = summary;
  const estimatedSaving = currency === "EUR" && commission?.inputs.selfTravels && commission.result.ownPrice !== null
    ? roundEuro(commission.inputs.travelerPrice - commission.result.ownPrice) : 0;
  const matchingSchedule = schedule.filter(item => item.amount === Number(amount));
  const matchingReceipts = receipts.filter(item => item.kind === "customer_payment" && item.amount >= Number(amount));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const priceTreatment = data.get("price_treatment");
    if (priceTreatment !== "deduct" && priceTreatment !== "included") return;
    const sourceSchedule = String(data.get("source_schedule_id") || "");
    const sourceReceipt = String(data.get("source_receipt_id") || "");
    if ((sourceSchedule || sourceReceipt) && !window.confirm(
      "Confirmas que o valor selecionado foi lançado como desconto? A prestação selecionada será retirada e o recebimento selecionado será reduzido nesse montante."
    )) return;
    try {
      await onSave({
        kind, amount, charge_commission: kind === "customer" && data.get("charge_commission") === "commission",
        included_in_total: priceTreatment === "included", notes: String(data.get("notes") || ""),
        source_schedule_id: sourceSchedule, source_receipt_id: sourceReceipt,
      });
      setOpen(false);
      setAmount("");
    } catch { /* The financial panel displays the server error. */ }
  }

  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-bold">Descontos</h3>
        <p className="text-sm text-slate-600">Os descontos deduzidos ao total abatem ao valor a pagar e às últimas prestações.</p>
      </div>
      <button type="button" className={officeSecondary + " min-h-11"} disabled={busy || summary.total_amount === null}
        aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Fechar formulário" : "Registar desconto"}</button>
    </div>
    <dl className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
      <div><dt>Desconto de participante</dt><dd className="font-semibold">{formatMoney(summary.participant_discount ?? 0, currency)}</dd></div>
      <div><dt>Descontos a clientes</dt><dd className="font-semibold">{formatMoney(summary.customer_discount ?? 0, currency)}</dd></div>
      <div><dt>Total a cobrar após descontos</dt><dd className="font-semibold">{formatMoney(summary.payable_total ?? summary.total_amount, currency)}</dd></div>
    </dl>
    {open && <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
      <label className="text-sm">Tipo de desconto<select className={officeInput} value={kind}
        onChange={event => setKind(event.target.value as TripDiscount["kind"])}>
        <option value="participant">Desconto de participante (consumo próprio)</option>
        <option value="customer">{tripDiscountKinds.customer}</option>
      </select></label>
      <label className="text-sm">Valor ({currency})<input type="number" className={officeInput} value={amount}
        onChange={event => setAmount(event.target.value)} required min="0.01" max="9999999999.99" step="0.01" /></label>
      {kind === "participant" && estimatedSaving > 0 && <div className="sm:col-span-2">
        <button type="button" className={officeSecondary} onClick={() => setAmount(estimatedSaving.toFixed(2))}>
          Usar o meu desconto da calculadora · {formatMoney(estimatedSaving, currency)}
        </button>
      </div>}
      {kind === "customer" && <label className="text-sm">Efeito na comissão<select name="charge_commission" className={officeInput} required defaultValue="">
        <option value="" disabled>Escolher efeito</option>
        <option value="none">Reduz apenas o valor a pagar</option>
        <option value="commission">Deduz também à minha comissão prevista</option>
      </select><span className="mt-1 block text-sm text-slate-600">Deduz à comissão se o valor ainda não estiver incluído na cedência da calculadora.</span></label>}
      <label className="text-sm sm:col-span-2">Como aplicar o desconto ao preço da reserva?
        <select name="price_treatment" className={officeInput + " appearance-auto"} required defaultValue="">
          <option value="" disabled>Escolher como aplicar</option>
          <option value="deduct">Abater ao total da reserva</option>
          <option value="included">O total da reserva já inclui o desconto</option>
        </select>
        <span className="mt-1 block text-slate-600">Se os {formatMoney(summary.total_amount, currency)} registados são o preço original, escolhe «Abater ao total da reserva».</span>
      </label>
      <label className="text-sm sm:col-span-2">Observações<textarea name="notes" rows={2} maxLength={2000} className={officeInput} /></label>
      <details className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
        <summary className="cursor-pointer text-sm font-semibold">Corrigir um desconto registado como prestação ou recebimento</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Prestação que corresponde ao desconto<select name="source_schedule_id" className={officeInput} key={amount}>
            <option value="">Nenhuma</option>
            {Number(amount) > 0 && matchingSchedule.map(item => <option key={item.id} value={item.id}>
              {item.label} · {formatMoney(item.amount,currency)} · {formatFinanceDate(item.due_on)}
            </option>)}
          </select></label>
          <label className="text-sm">Recebimento onde o desconto foi incluído<select name="source_receipt_id" className={officeInput} key={amount}>
            <option value="">Nenhum</option>
            {Number(amount) > 0 && matchingReceipts.map(item => <option key={item.id} value={item.id}>
              {formatFinanceDate(item.paid_on)} · {formatMoney(item.amount,currency)}{item.reference ? " · "+item.reference : ""}
            </option>)}
          </select></label>
        </div>
      </details>
      <button type="submit" disabled={busy} className={officeButton + " min-h-11 justify-self-start"}>Guardar desconto</button>
    </form>}
    {discounts.length > 0 && <ul className="divide-y divide-slate-200">{discounts.map(item => <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
      <div>
        <p className="font-semibold">{tripDiscountKinds[item.kind]} · {formatMoney(item.amount,currency)}</p>
        <p className="text-sm text-slate-600">{item.included_in_total ? "Já refletido no preço da reserva" : "Abatido ao total"}
          {item.charge_commission && " · Deduzido à comissão prevista"}
          {(item.source_receipt_id || item.source_schedule_id) && " · Reclassificado"}</p>
        {item.notes && <p className="whitespace-pre-wrap text-sm">{item.notes}</p>}
      </div>
      <button type="button" className={officeSecondary} disabled={busy} onClick={() => onReverse(item.id)}>Anular desconto</button>
    </li>)}</ul>}
  </section>;
}
