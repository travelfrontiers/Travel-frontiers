import { clientFieldLimits } from "@/lib/crm-client-fields";

export default function CrmClientBillingFields({
  inputClass, labelClass, nif, address,
}: {
  inputClass: string;
  labelClass: string;
  nif?: string | null;
  address?: string | null;
}) {
  return <>
    <label className={labelClass}>NIF
      <input name="nif" maxLength={clientFieldLimits.nif} defaultValue={nif ?? ""} className={inputClass} />
    </label>
    <label className={labelClass + " sm:col-span-2"}>Morada
      <textarea name="address" rows={2} maxLength={clientFieldLimits.address} autoComplete="street-address"
        defaultValue={address ?? ""} className={inputClass} />
    </label>
  </>;
}
