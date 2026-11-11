"use client";

import { useState } from "react";
import { officeInput } from "@/lib/crm-office-types";

type Traveler = { id: string; full_name: string; email: string | null };

const searchKey = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-PT").trim();

export default function TripClientSelect({ clients, selectedIds = [], id }: {
  clients: Traveler[];
  selectedIds?: string[];
  id?: string;
}) {
  const [selected, setSelected] = useState(selectedIds);
  const [search, setSearch] = useState("");
  const query = searchKey(search);
  const matches = (client: Traveler) => searchKey(`${client.full_name} ${client.email ?? ""}`).includes(query);
  const selectedClients = clients.filter(client => selected.includes(client.id));

  return <fieldset id={id} className="scroll-mt-16 space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4 sm:col-span-2">
    <legend className="px-2 text-base font-semibold">Escolher clientes *</legend>
    {clients.length === 0 ? <p className="text-sm text-slate-600">Cria uma ficha na secção Clientes para poderes associá-la à viagem.</p> : <>
      <label className="block space-y-1 text-sm font-medium">Pesquisar clientes
        <input type="search" className={officeInput} value={search} onChange={event => setSearch(event.currentTarget.value)} placeholder="Nome ou email" />
      </label>
      <p role="status" className="text-sm text-slate-600">{selectedClients.length
        ? `Selecionados (${selectedClients.length}): ${selectedClients.map(client => client.full_name).join(", ")}`
        : "Nenhum cliente selecionado. Assinala quem vai viajar."}</p>
      <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
        {clients.map(client => {
          const checked = selected.includes(client.id);
          const visible = matches(client);
          return <label key={client.id} className={
            `${visible ? "flex" : "hidden"} cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${checked ? "border-orange-300 bg-orange-50" : "border-slate-300 bg-white"}`
          }>
            <input type="checkbox" name="client_ids" value={client.id} checked={checked}
              onChange={event => {
                const add = event.currentTarget.checked;
                setSelected(current => add ? [...current, client.id] : current.filter(id => id !== client.id));
              }}
              className="size-5 shrink-0 appearance-auto accent-orange-800" />
            <span className="min-w-0 break-words font-semibold">
              {client.full_name}
              {client.email && <span className="block text-xs font-normal text-slate-600">{client.email}</span>}
            </span>
          </label>;
        })}
      </div>
      {!clients.some(matches) && <p className="text-sm text-slate-600">Sem resultados para esta pesquisa.</p>}
    </>}
  </fieldset>;
}
