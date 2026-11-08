"use client";

import { FormEvent, useState } from "react";
import type { Locale } from "@/i18n/dictionaries";

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20";
const budgetIds = ["under_500", "500_1000", "1000_1500", "1500_2000", "over_2000", "undecided"] as const;

function nextDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(year, month - 1, day + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

const copy = {
  pt: {
    fullName: "Nome completo", email: "Email", emailInvalid: "Introduz um endereço de email válido.", dateOrder: "A data de regresso tem de ser posterior à data de partida.", phone: "Telefone", destination: "Destino ou ideia de viagem", destinationHint: "Ex.: Japão, praia com crianças ou estou aberto a sugestões",
    departure: "Data de partida", returning: "Data de regresso", flexible: "Tenho flexibilidade nas datas", dateRule: "Indica as datas de partida e regresso ou assinala que tens flexibilidade.", travelers: "Quantas pessoas vão viajar? *", adults: "Adultos *", children: "Crianças", selectAge: "Seleciona a idade", adult: "adulto", adultsPlural: "adultos", year: "ano", years: "anos",
    budgetTitle: "Qual é o orçamento aproximado por pessoa? *", budgetHint: "Considera o valor aproximado que tens disponível por pessoa para a viagem.",
    budgets: ["Até 500 €", "500 € – 1.000 €", "1.000 € – 1.500 €", "1.500 € – 2.000 €", "Mais de 2.000 €", "Ainda não defini"],
    style: "Estilo de viagem", styleHint: "Praia, circuito, cidade…", details: "Mais detalhes", detailsHint: "Partilha todas as preferências ou requisitos importantes para a tua viagem",
    privacy: "Li a", privacyLink: "informação de privacidade", privacyEnd: "e autorizo a utilização dos dados para responder a este pedido. *", send: "Enviar pedido", sending: "A enviar…", sent: "Obrigado. Recebi o teu pedido e entrarei em contacto contigo.", pending: "O pedido ficou registado, mas a notificação por email ainda não está configurada.", failed: "Não foi possível enviar o pedido. Tenta novamente mais tarde.", invalid: "Revê os campos obrigatórios e tenta novamente.",
  },
  en: {
    fullName: "Full name", email: "Email", emailInvalid: "Enter a valid email address.", dateOrder: "The return date must be after the departure date.", phone: "Phone", destination: "Destination or trip idea", destinationHint: "E.g. Japan, a beach trip with children, or I’m open to suggestions",
    departure: "Departure date", returning: "Return date", flexible: "My dates are flexible", dateRule: "Enter departure and return dates, or select that your dates are flexible.", travelers: "How many people are travelling? *", adults: "Adults *", children: "Children", selectAge: "Select age", adult: "adult", adultsPlural: "adults", year: "year", years: "years",
    budgetTitle: "What is your approximate budget per person? *", budgetHint: "Consider the approximate amount you have available per person for this trip.",
    budgets: ["Up to €500", "€500 – €1,000", "€1,000 – €1,500", "€1,500 – €2,000", "Over €2,000", "I haven’t decided yet"],
    style: "Travel style", styleHint: "Beach, touring, city break…", details: "More details", detailsHint: "Share any preferences or important requirements for your trip",
    privacy: "I have read the", privacyLink: "privacy information", privacyEnd: "and consent to the use of my data to respond to this request. *", send: "Send request", sending: "Sending…", sent: "Thank you. Your request has been received and I’ll be in touch.", pending: "Your request was recorded, but email notifications are not configured yet.", failed: "We couldn’t send your request. Please try again later.", invalid: "Please review the required fields and try again.",
  },
  fr: {
    fullName: "Nom complet", email: "E-mail", emailInvalid: "Saisissez une adresse e-mail valide.", dateOrder: "La date de retour doit être postérieure à la date de départ.", phone: "Téléphone", destination: "Destination ou idée de voyage", destinationHint: "Ex. : Japon, séjour balnéaire avec enfants ou ouvert(e) aux suggestions",
    departure: "Date de départ", returning: "Date de retour", flexible: "Mes dates sont flexibles", dateRule: "Indiquez les dates de départ et de retour, ou sélectionnez l’option de flexibilité.", travelers: "Combien de personnes voyagent ? *", adults: "Adultes *", children: "Enfants", selectAge: "Sélectionnez l’âge", adult: "adulte", adultsPlural: "adultes", year: "an", years: "ans",
    budgetTitle: "Quel est le budget approximatif par personne ? *", budgetHint: "Indiquez le montant approximatif disponible par personne pour le voyage.",
    budgets: ["Jusqu’à 500 €", "500 € – 1 000 €", "1 000 € – 1 500 €", "1 500 € – 2 000 €", "Plus de 2 000 €", "Je n’ai pas encore décidé"],
    style: "Style de voyage", styleHint: "Plage, circuit, ville…", details: "Plus de détails", detailsHint: "Partagez vos préférences ou toute exigence importante pour votre voyage",
    privacy: "J’ai lu les", privacyLink: "informations de confidentialité", privacyEnd: "et j’autorise l’utilisation de mes données pour répondre à cette demande. *", send: "Envoyer la demande", sending: "Envoi…", sent: "Merci. Votre demande a bien été reçue et je vous contacterai.", pending: "Votre demande a été enregistrée, mais les notifications par e-mail ne sont pas encore configurées.", failed: "Impossible d’envoyer la demande. Veuillez réessayer plus tard.", invalid: "Vérifiez les champs obligatoires et réessayez.",
  },
} satisfies Record<Locale, { [key: string]: string | string[] }>;

type Props = { lang: Locale };

export default function TripRequestForm({ lang }: Props) {
  const t = copy[lang];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [childrenCount, setChildrenCount] = useState(0);
  const [dateFlexible, setDateFlexible] = useState(false);
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const returnDateInvalid = Boolean(departureDate && returnDate && returnDate <= departureDate);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const childrenAges = Array.from({ length: childrenCount }, (_, index) => Number(data.get(`child_age_${index + 1}`)));
    const payload = {
      language: lang,
      full_name: data.get("full_name"), email: data.get("email"), phone: data.get("phone"),
      destination: data.get("destination"), departure_date: data.get("departure_date"),
      return_date: data.get("return_date"), date_flexible: data.get("date_flexible") === "on",
      adults: Number(data.get("adults")), children_ages: childrenAges,
      travel_style: data.get("travel_style"), budget: data.get("budget"), notes: data.get("notes"),
      consent_privacy: data.get("consent_privacy") === "on", website: data.get("website"),
    };

    try {
      const response = await fetch("/api/trip-requests", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === "invalid_request" ? t.invalid : t.failed);
      form.reset();
      setChildrenCount(0);
      setDateFlexible(false);
      setEmail("");
      setEmailTouched(false);
      setDepartureDate("");
      setReturnDate("");
      setMessage(result.notificationPending ? t.pending : t.sent);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-slate-800">{t.fullName} *<input className={inputClass} name="full_name" autoComplete="name" required minLength={2} maxLength={160} /></label>
        <label className="space-y-2 text-sm font-medium text-slate-800">{t.email} *<input className={`${inputClass} ${emailTouched && email.length > 0 && !emailValid ? "border-red-600 focus:border-red-600 focus:ring-red-600/20" : ""}`} name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}" value={email} aria-invalid={emailTouched && email.length > 0 && !emailValid} onChange={(event) => setEmail(event.target.value)} onBlur={() => setEmailTouched(true)} /></label>
        {emailTouched && email.length > 0 && !emailValid && <p role="alert" className="-mt-4 text-sm text-red-700">{t.emailInvalid}</p>}
        <label className="space-y-2 text-sm font-medium text-slate-800">{t.phone}<input className={inputClass} name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
        <label className="space-y-2 text-sm font-medium text-slate-800">{t.destination} *<input className={inputClass} name="destination" maxLength={240} placeholder={t.destinationHint} required /></label>
        <label className="space-y-2 text-sm font-medium text-slate-800">{t.departure}{dateFlexible ? "" : " *"}<input className={inputClass} name="departure_date" type="date" value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} required={!dateFlexible} /></label>
        <label className="space-y-2 text-sm font-medium text-slate-800">{t.returning}{dateFlexible ? "" : " *"}<input className={inputClass} name="return_date" type="date" value={returnDate} min={departureDate ? nextDate(departureDate) : undefined} onChange={(event) => setReturnDate(event.target.value)} required={!dateFlexible} /></label>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-3 text-sm text-slate-700"><input name="date_flexible" type="checkbox" checked={dateFlexible} onChange={(event) => setDateFlexible(event.target.checked)} className="size-4 accent-teal-800" />{t.flexible}</label>
        <p className="text-sm text-slate-500">{t.dateRule}</p>
        {returnDateInvalid && <p role="alert" className="text-sm text-red-700">{t.dateOrder}</p>}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-slate-900">{t.travelers}</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-800">{t.adults}
            <select className={inputClass} name="adults" required defaultValue="2">
              {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} {count === 1 ? t.adult : t.adultsPlural}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-800">{t.children}
            <select className={inputClass} value={childrenCount} onChange={(event) => setChildrenCount(Number(event.target.value))}>
              {Array.from({ length: 13 }, (_, count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
        </div>
        {childrenCount > 0 && <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: childrenCount }, (_, index) => <label key={index} className="space-y-2 text-sm font-medium text-slate-800">{lang === "pt" ? `Idade da criança ${index + 1}` : lang === "en" ? `Child ${index + 1} age` : `Âge de l’enfant ${index + 1}`} *
            <select className={inputClass} name={`child_age_${index + 1}`} required defaultValue="">
              <option value="" disabled>{t.selectAge}</option>
              {Array.from({ length: 18 }, (_, age) => <option key={age} value={age}>{age} {age === 1 ? t.year : t.years}</option>)}
            </select>
          </label>)}
        </div>}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-slate-900">{t.budgetTitle}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {budgetIds.map((id, index) => <label key={id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 transition hover:border-teal-700 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50">
            <input className="size-4 accent-teal-800" type="radio" name="budget" value={id} required />
            <span>{t.budgets[index]}</span>
          </label>)}
        </div>
        <p className="text-sm text-slate-500">{t.budgetHint}</p>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-slate-800">{t.style}<input className={inputClass} name="travel_style" maxLength={120} placeholder={t.styleHint} /></label>
        <label className="space-y-2 text-sm font-medium text-slate-800">{t.details}<textarea className={inputClass} name="notes" rows={4} maxLength={4000} placeholder={t.detailsHint} /></label>
      </div>
      <label className="hidden" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700"><input name="consent_privacy" type="checkbox" required className="mt-1 size-4 accent-teal-800" /><span>{t.privacy} <a href="https://www.travelfrontiers.pt/privacy.html" target="_blank" rel="noreferrer" className="underline">{t.privacyLink}</a> {t.privacyEnd}</span></label>
      {message && <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-800">{message}</p>}
      <button className="rounded-full bg-teal-800 px-7 py-3 font-semibold text-white transition hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy}>{busy ? t.sending : t.send}</button>
    </form>
  );
}
