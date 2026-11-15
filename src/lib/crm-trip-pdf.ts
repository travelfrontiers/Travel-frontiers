import { bookingTextFields, type BookingDetails } from "./crm-booking-details";

export type TripPdfService = {
  service_type: "flight" | "accommodation" | "activity" | "transfer" | "insurance" | "other";
  title: string;
  provider: string;
  reference: string;
  starts_on: string;
  ends_on: string;
  details: string;
  booking?: BookingDetails;
};

export type TripPdfFields = {
  reference: string;
  destination: string;
  departure_date: string;
  return_date: string;
  adults: string;
  children_count: string;
  total_amount: string;
  currency: string;
  operator: string;
  trip_notes: string;
  services: TripPdfService[];
};

const monthNumber: Record<string, string> = {
  january: "01", janvier: "01", janv: "01", february: "02", feb: "02", février: "02", fevrier: "02", févr: "02", march: "03", mars: "03", april: "04", apr: "04", avril: "04", avr: "04", may: "05", june: "06", juin: "06", july: "07", juillet: "07", august: "08", aug: "08", août: "08", aout: "08", september: "09", sep: "09", sept: "09", septembre: "09", october: "10", oct: "10", octobre: "10", november: "11", novembre: "11", december: "12", dec: "12", décembre: "12", decembre: "12", déc: "12",
  janeiro: "01", jan: "01", fevereiro: "02", fev: "02", março: "03", marco: "03", mar: "03",
  abril: "04", abr: "04", maio: "05", mai: "05", junho: "06", jun: "06", julho: "07", jul: "07",
  agosto: "08", ago: "08", setembro: "09", set: "09", outubro: "10", out: "10", novembro: "11", nov: "11", dezembro: "12", dez: "12",
};

const monthExpression = "janvier|janv\\.?|septembre|janeiro|jan\\.?|fevereiro|fev\\.?|março|marco|mar\\.?|abril|abr\\.?|maio|mai\\.?|junho|jun\\.?|julho|jul\\.?|agosto|ago\\.?|setembro|set\\.?|outubro|out\\.?|novembro|nov\\.?|dezembro|dez\\.?|january|jan\\.?|february|feb\\.?|février|fevrier|févr\\.?|fev\\.?|march|mars|mar\\.?|april|apr\\.?|avril|avr\\.?|may|mai|june|jun\\.?|juin|july|jul\\.?|juillet|august|aug\\.?|août|aout|september|sept\\.?|sep\\.?|october|oct\\.?|octobre|oct\\.?|november|nov\\.?|novembre|nov\\.?|december|dec\\.?|décembre|decembre|déc\\.?|dez\\.?";

function parsePtDate(day: string, month: string, year: string) {
  const monthValue = monthNumber[month.toLocaleLowerCase("pt-PT").replace(/\.$/, "")];
  if (!monthValue) return "";
  const date = `${year}-${monthValue}-${day.padStart(2, "0")}`;
  return isValidDateOnly(date) ? date : "";
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function extractDateRange(text: string) {
  const departureLabeled = extractLabeledDate(text, /(?:data de )?(?:partida|sa[ií]da|in[ií]cio|departure|outbound|d[ée]part)\b/i);
  const returnLabeled = extractLabeledDate(text, /(?:data de )?(?:regresso|retorno|volta|chegada|return|inbound|retour)\b/i);
  if (departureLabeled && returnLabeled && returnLabeled >= departureLabeled) {
    return { departure_date: departureLabeled, return_date: returnLabeled };
  }
  const itineraryRange = extractItineraryDateRange(text);
  if (itineraryRange.departure_date && itineraryRange.return_date) return itineraryRange;
  const monthExpr = monthExpression;
  const rangeSeparator = "(?:-|–|—|→|\\u2192|\\u27a1|[\\uE000-\\uF8FF]|a|até)";
  const longRange = new RegExp(`(\\d{1,2})\\s+(?:de\\s+)?(${monthExpr})\\s+(?:de\\s+)?(\\d{4})\\s*${rangeSeparator}\\s*(\\d{1,2})\\s+(?:de\\s+)?(${monthExpr})\\s+(?:de\\s+)?(\\d{4})`, "i").exec(text);
  if (longRange) return { departure_date: parsePtDate(longRange[1], longRange[2], longRange[3]), return_date: parsePtDate(longRange[4], longRange[5], longRange[6]) };

  const numericRange = new RegExp("(\\d{1,2})[/.](\\d{1,2})[/.](\\d{4})\\s*" + rangeSeparator + "\\s*(\\d{1,2})[/.](\\d{1,2})[/.](\\d{4})", "i").exec(text);
  if (numericRange) {
    const date = (day: string, month: string, year: string) => `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const departure_date = date(numericRange[1], numericRange[2], numericRange[3]);
    const return_date = date(numericRange[4], numericRange[5], numericRange[6]);
    return { departure_date: isValidDateOnly(departure_date) ? departure_date : "", return_date: isValidDateOnly(return_date) ? return_date : "" };
  }
  return { departure_date: "", return_date: "" };
}

function cleanDestination(value: string) {
  return value
    .replace(/\s+(?:servi[cç]os?|alojamentos?|transportes?|regime|data de partida|data de regresso)\b.*$/i, "")
    .replace(/\s*[|•].*$/, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:–—-]+|[\s,;|–—-]+$/g, "")
    .trim()
    .slice(0, 240);
}

function extractDestination(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const label = /^(?:destino(?:s)?(?:\s+(?:da\s+viagem|pretendido))?|destination|localidade|circuito)\s*[:\-–—]?\s*(.*)$/i;
  for (let index = 0; index < lines.length; index += 1) {
    const match = label.exec(lines[index]);
    if (!match) continue;
    const inline = cleanDestination(match[1]);
    if (inline.length > 1 && !/^(?:destino|por definir|a definir|n\/?a)$/i.test(inline)) return inline;
    const next = lines.slice(index + 1, index + 4).find((line) => line.length > 1 && !label.test(line) && !/^(?:refer[eê]ncia|data|pre[cç]o|total|viajantes?)\b/i.test(line));
    if (next) return cleanDestination(next);
  }

  // Read stop descriptions wherever the itinerary places them. Supplier and
  // quote documents often put destination, nights, and hotel on one narrative line.
  const itineraryStops: string[] = [];
  for (const line of lines) {
    const stop = /^(.{2,100}?)\s*[—–-]\s*\d{1,2}\s*(?:noites?|nights?|d[ií]as?|days?)\s*:/i.exec(line);
    if (!stop) continue;
    const place = cleanDestination(stop[1].replace(/,\s*[^,]+$/, ""));
    if (place && !itineraryStops.some((item) => item.toLocaleLowerCase("pt-PT") === place.toLocaleLowerCase("pt-PT"))) itineraryStops.push(place);
  }
  if (itineraryStops.length) return itineraryStops.join(", ").slice(0, 240);

  const titleDestination = /(?:sua|your)\s+viagem\s+(?:para|to)\s+([^\r\n:]{2,120})/i.exec(text)?.[1];
  if (titleDestination) return cleanDestination(titleDestination);

  const itineraryIndex = lines.findIndex((line) => /itiner[aá]rio|roteiro|destinos? inclu[ií]dos|journey|itinerary/i.test(line));
  const sectionLines = itineraryIndex >= 0 ? lines.slice(itineraryIndex + 1, itineraryIndex + 24) : lines;
  const countries = new Set([
    "portugal", "italia", "itália", "espanha", "franca", "frança", "grecia", "grécia", "alemanha", "irlanda", "reino unido", "inglaterra",
    "paises baixos", "países baixos", "belgica", "bélgica", "suica", "suíça", "austria", "áustria", "croacia", "croácia", "turquia", "marrocos",
    "egito", "tunisia", "tunísia", "cabo verde", "brasil", "estados unidos", "canada", "canadá", "mexico", "méxico", "tailandia", "tailândia",
    "japao", "japão", "france", "italy", "spain", "greece", "germany", "ireland", "united kingdom", "netherlands", "belgium", "switzerland",
    "croatia", "turkey", "morocco", "egypt", "cape verde", "brazil", "united states", "mexico", "thailand", "japan",
  ]);
  const destinations: string[] = [];
  for (let index = 0; index < sectionLines.length; index += 1) {
    const current = sectionLines[index];
    if (countries.has(current.toLocaleLowerCase("pt-PT")) && index > 0 && /^[\p{L}][\p{L} .'-]{1,60}$/u.test(sectionLines[index - 1])) destinations.push(sectionLines[index - 1]);
    const pair = /^([\p{L}][\p{L} .'-]{1,60})\s*[,–—-]\s*([\p{L}][\p{L} .'-]{2,50})$/u.exec(current);
    if (pair && countries.has(pair[2].toLocaleLowerCase("pt-PT"))) destinations.push(pair[1]);
  }
  const unique = destinations.filter((destination, index) => index === 0 || destination.toLocaleLowerCase("pt-PT") !== destinations[index - 1].toLocaleLowerCase("pt-PT"));
  if (unique.length > 2 && unique[0].toLocaleLowerCase("pt-PT") === unique.at(-1)?.toLocaleLowerCase("pt-PT")) return unique.slice(1, -1).join(", ");
  if (unique.length > 1) return unique.join(", ");
  return unique[0] || "";
}

function extractOperator(text: string) {
  const labeled = /(?:operador|fornecedor|operator|supplier)\s*[:\-]\s*([^\r\n]{2,100})/i.exec(text)?.[1];
  if (labeled) return labeled.split(/\s{2,}|\s+(?:refer[eê]ncia|destino|data|pre[cç]o)\s*:/i)[0]?.trim().slice(0, 160) || "";
  const knownOperators = ["Soltour", "Travelplan", "TUI", "Newblue", "Iberojet", "W2M", "World2Meet", "Viajes El Corte Inglés", "Abreu", "Kuoni", "Jumbo Tours", "Catai"];
  return knownOperators.find((operator) => new RegExp(`\\b${operator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) || "";
}

function extractPassengerCount(text: string, kind: "adults" | "children") {
  const terms = kind === "adults" ? "adultos?|ADT" : "crian[cç]as?|children|CHD";
  const before = new RegExp(`(\\d{1,2})\\s*(?:${terms})\\b`, "i").exec(text)?.[1];
  const after = new RegExp(`(?:${terms})\\s*[:\\-]\\s*(\\d{1,2})`, "i").exec(text)?.[1];
  return before || after || "";
}

function extractPrice(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.replace(/\p{Co}/gu, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const totalHeading = /^(?:(?:pre[cç]o|valor|importe|montante|price|amount|cost|prix)\s+total|grand\s+total|total(?:\s+(?:da\s+viagem|da\s+reserva|del\s+viaje|du\s+voyage|package|trip|booking|price|amount|cost|a\s+pagar|due))?|valor\s+final)\b/i;
  const spacedTotal = /^(?:p\s+r\s+e\s+[cç]\s+o|v\s+a\s+l\s+o\s+r|p\s+r\s+i\s+c\s+e|i\s+m\s+p\s+o\s+r\s+t\s+e)?\s*t\s+o\s+t\s+a\s+l\b/i;
  const genericHeading = /^(?:pre[cç]o|valor|importe|montante|price|amount|cost|prix)\b/i;
  const money = /^(?:(EUR|USD|GBP|[€$£])\s*)?([0-9]+(?:[., '\u00a0][0-9]+)*)\s*(EUR|USD|GBP|[€$£])?$/i;
  const readAmount = (value: string, requireCurrency = false) => {
    const match = money.exec(value.trim());
    if (!match || (requireCurrency && !match[1] && !match[3])) return null;
    const raw = match[2].replace(/[\s'\u00a0]/g, "");
    const decimal = raw.search(/[.,]\d{1,2}$/);
    const normalized = decimal < 0 ? raw.replace(/[.,]/g, "") :
      raw.slice(0, decimal).replace(/[.,]/g, "") + "." + raw.slice(decimal + 1);
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount > 9999999999.99) return null;
    const token = (match[1] || match[3] || "EUR").toUpperCase();
    return { amount: normalized, currency: token === "$" || token === "USD" ? "USD" : token === "£" || token === "GBP" ? "GBP" : "EUR" };
  };

  // Match a total on its label's line or in the immediately following cell.
  const perPerson = /^(?:por\s+(?:pessoa|adulto|crian[cç]a)|per\s+(?:person|adult|child)|par\s+(?:personne|adulte|enfant))\b/i;
  for (const heading of [[totalHeading, spacedTotal], [genericHeading]]) {
    for (const [index, line] of lines.entries()) {
      const label = heading.map(pattern => pattern.exec(line)?.[0]).find(Boolean);
      if (!label) continue;
      const value = line.slice(label.length).replace(/^\s*[:–—-]\s*|^\s+/, "").trim();
      if (heading[0] === genericHeading && perPerson.test(lines[index + (value ? 1 : 2)] || "")) continue;
      const price = readAmount(value || lines[index + 1] || "");
      if (price) return price;
    }
  }

  // Some builders omit the labels. Only suggest a package total when the
  // two amounts are nearby and the passenger count corroborates the total.
  const passengers = Number(extractPassengerCount(text, "adults")) + Number(extractPassengerCount(text, "children"));
  const amounts = lines.slice(0, 45).flatMap((line, index) => {
    const price = readAmount(line, true);
    return price ? [{ ...price, index }] : [];
  });
  if (passengers > 1) {
    const totals = amounts.filter(total => amounts.some(unit =>
      total.index > unit.index && total.index - unit.index <= 5 && unit.currency === total.currency &&
      Number(total.amount) > Number(unit.amount) &&
      Math.abs(Number(unit.amount) * passengers - Number(total.amount)) <= Math.max(2, passengers)));
    const [total] = totals;
    if (total && totals.every(candidate => candidate.amount === total.amount && candidate.currency === total.currency)) {
      return { amount: total.amount, currency: total.currency };
    }
  }
  return { amount: "", currency: "EUR" };
}

function extractLabeledDate(text: string, label: RegExp) {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    if (!label.test(lines[index])) continue;
    const date = extractSingleDate(lines[index]) || extractSingleDate(lines[index + 1] || "");
    if (date) return date;
  }
  return "";
}

function extractSingleDate(text: string) {
  const iso = /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/.exec(text);
  if (iso) {
    const value = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    return isValidDateOnly(value) ? value : "";
  }
  const numeric = /(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(text);
  if (numeric) {
    const value = `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
    return isValidDateOnly(value) ? value : "";
  }
  const monthExpr = monthExpression;
  const long = new RegExp(`(\\d{1,2})\\s+(?:de\\s+)?(${monthExpr})\\s+(?:de\\s+)?(\\d{4})`, "i").exec(text);
  return long ? parsePtDate(long[1], long[2], long[3]) : "";
}

function extractDateBounds(text: string) {
  const monthExpr = monthExpression;
  const dates: string[] = [];
  const longDate = new RegExp(`(\\d{1,2})\\s+(?:de\\s+)?(${monthExpr})\\s+(?:de\\s+)?(\\d{4})`, "gi");
  for (const match of text.matchAll(longDate)) {
    const value = parsePtDate(match[1], match[2], match[3]);
    if (value) dates.push(value);
  }
  const numericDate = /(?<!\d)(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?!\d)/g;
  for (const match of text.matchAll(numericDate)) {
    const value = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    if (isValidDateOnly(value)) dates.push(value);
  }
  const isoDate = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
  for (const match of text.matchAll(isoDate)) if (isValidDateOnly(match[0])) dates.push(match[0]);
  if (!dates.length) return { departure_date: "", return_date: "" };
  const ordered = dates.sort();
  return { departure_date: ordered[0], return_date: ordered.at(-1) || ordered[0] };
}

// PDF table cells may be emitted separately from the accommodation on the same row.
const dateCellPattern = new RegExp(
  `(?<!\\d)(?:\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}[/.]\\d{1,2}[/.]\\d{4}|\\d{1,2}\\s+(?:de\\s+)?(?:${monthExpression})\\s+(?:de\\s+)?\\d{4})(?!\\d)`,
  "gi",
);

function dateCells(line: string) {
  const cells = line.match(dateCellPattern) || [];
  const remainder = line.replace(dateCellPattern, "").replace(/\b(?:a|at[eé]|to|au)\b/gi, "");
  if (!cells.length || /[^\s\p{Co},;|→➜➝–—-]/u.test(remainder)) return [];
  const dates = cells.map(extractSingleDate);
  return dates.every(Boolean) ? dates : [];
}

function precedingStayDates(lines: string[], index: number) {
  const last = dateCells(lines[index - 1] ?? "");
  if (last.length === 2) return last[0] < last[1] ? last : [];
  if (last.length !== 1) return [];
  const first = dateCells(lines[index - 2] ?? "");
  return first.length === 1 && first[0] < last[0] ? [first[0], last[0]] : [];
}

function extractItineraryDateRange(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const start = lines.findIndex((line) => /^(?:itiner[aá]rio|roteiro|itinerary|travel itinerary)\b/i.test(line));
  if (start < 0) return { departure_date: "", return_date: "" };
  const end = lines.findIndex((line, index) => index > start && /^(?:descri[cç][aã]o da viagem|resumo da viagem|trip description|travel summary|payment|terms and conditions)\b/i.test(line));
  const section = lines.slice(start, end > start ? end : Math.min(lines.length, start + 80)).join(" ");
  const bounds = extractDateBounds(section);
  return bounds.departure_date && bounds.return_date ? bounds : { departure_date: "", return_date: "" };
}

const serviceName = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "")
  .toLocaleLowerCase("pt-PT").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function mergeHotelMentions(services: TripPdfService[]): TripPdfService[] {
  const entries = services.map((service, position) => ({ service, position }));
  const result: typeof entries = [];
  const hotelName = (title: string) => serviceName(title).replace(/\s+hotels$/, "");
  const compatible = (first: string, second: string) => !first || !second || first === second;
  const dated = (service: TripPdfService) => Boolean(service.starts_on || service.ends_on);
  // Place dated stays first so an undated mention cannot join two separate stays.
  for (const entry of entries.sort((a, b) => Number(dated(b.service)) - Number(dated(a.service)))) {
    const { service } = entry;
    const name = hotelName(service.title);
    const sameHotel = result.filter(({service: item}) => hotelName(item.title) === name &&
      compatible(item.starts_on, service.starts_on) && compatible(item.ends_on, service.ends_on) &&
      compatible(item.reference, service.reference));
    if (sameHotel.length > 1 && !dated(service)) continue;
    if (sameHotel.length !== 1) {
      result.push(entry);
      continue;
    }
    const { service: existing } = sameHotel[0];
    existing.starts_on ||= service.starts_on;
    existing.ends_on ||= service.ends_on;
    existing.reference ||= service.reference;
    existing.provider ||= service.provider;
    existing.booking = { ...service.booking, ...existing.booking };
  }
  return result.sort((a, b) => a.position - b.position).map(item => item.service);
}

function extractTravelServices(text: string): TripPdfService[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[\t ]+/g, " ").trim()).filter(Boolean);
  const services: TripPdfService[] = [];
  let inFlightSection = false;
  let inHotelSection = false;
  const add = (candidate: TripPdfService) => {
    if (candidate.title.length > 2 && !services.some(service =>
      service.service_type === candidate.service_type && serviceName(service.title) === serviceName(candidate.title) &&
      service.starts_on === candidate.starts_on && service.ends_on === candidate.ends_on && service.reference === candidate.reference
    )) services.push(candidate);
  };
  const heading = /^(?:voos?|flights?|segmentos?\s+a[eé]reos?|a[eé]reos?)\s*[:\-–—]?$/i;
  const hotelHeading = /^(?:hot[eé]is?|alojamento|accommodation|hotel details?)\s*[:\-–—]?$/i;
  const sectionEnd = /^(?:hot[eé]is?|alojamento|accommodation|itiner[aá]rio|roteiro|pre[cç]o|valor|total|condi[cç][oõ]es|observa[cç][oõ]es|passageiros|viajantes?)\b/i;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (heading.test(line)) { inFlightSection = true; inHotelSection = false; continue; }
    if (hotelHeading.test(line)) { inHotelSection = true; inFlightSection = false; continue; }
    if (sectionEnd.test(line) && !/^(?:voo|flight|hotel|alojamento|accommodation)\b/i.test(line)) { inFlightSection = false; inHotelSection = false; }

    const next = lines[index + 1] || "";
    const combined = `${line} ${next}`.replace(/([\p{L}]{3,})para\b/giu, "$1 para").trim();
    if (/^sem\s+o\s+transporte\s+selecionado\b/i.test(line)) continue;
    const flightCode = /\b([A-Z]{2,3})\s?(\d{2,4})\b/.exec(line)?.[0]?.replace(/\s/g, "") || "";
    const route = /\b([A-Z]{3})\s*(?:-|–|—|→|para|to)\s*([A-Z]{3})\b/i.exec(combined);
    const transportRoute = /(?:transporte|transportation|flight|voo)[^\r\n]{0,100}?(?:de|from|entre)\s+(.{2,90}?)\s+(?:para|a|to|e)\s+(.{2,90}?)(?:[.;]|$)/i.exec(combined);
    const airportRoute = /(?:aeroporto|airport|\([A-Z]{3}\))/i.test(combined);
    const explicitTransportLine = /^(?:transporte|transportation|flight|voo)\s*:/i.test(line);
    const hasFlightSignal = /\b(voo|flight|embarque|departure|airline|companhia a[eé]rea|n[uú]mero\s+do\s+voo)\b/i.test(line) || Boolean(flightCode && route) || inFlightSection && (Boolean(flightCode) || Boolean(route)) || explicitTransportLine && Boolean(transportRoute && airportRoute);
    if (hasFlightSignal) {
      const nearbyText = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 2)).join(" ");
      const nearbyRange = extractDateRange(nearbyText);
      const dateText = extractSingleDate(line) || (flightCode || route ? extractSingleDate(next) : "") || nearbyRange.return_date || extractSingleDate(nearbyText);
      const airportCodes = [...combined.matchAll(/\(([A-Z]{3})\)/g)].map((match) => match[1]);
      const tidyAirport = (value: string) => cleanDestination(value.replace(/\b(?:international|intl|airport|aeroporto|internacional)\b/gi, "").replace(/\s+/g, " "));
      const routeLabel = route ? `${route[1].toUpperCase()} → ${route[2].toUpperCase()}` : airportCodes.length > 1 ? `${airportCodes[0]} → ${airportCodes[1]}` : transportRoute ? `${tidyAirport(transportRoute[1])}${airportCodes.length === 1 ? ` (${airportCodes[0]})` : ""} → ${tidyAirport(transportRoute[2])}` : "";
      const titleBits = [flightCode ? `Voo ${flightCode}` : "Transporte aéreo", routeLabel].filter(Boolean);
      const provider = /\b(TAP(?: Air Portugal)?|Iberia|Air Europa|Ryanair|easyJet|Lufthansa|Vueling|Air France|KLM|British Airways|Wizz Air|Transavia|Iberojet)\b/i.exec(combined)?.[1] || "";
      const booking: BookingDetails = {};
      if (flightCode) booking.flight_number = flightCode;
      if (route) { booking.origin = route[1].toUpperCase(); booking.destination_airport = route[2].toUpperCase(); }
      add({ service_type: "flight", title: titleBits.join(" · ") || line.slice(0, 240), provider, reference: flightCode, starts_on: dateText, ends_on: "", details: combined.slice(0, 1000), booking });
    }

    const hotelMatch = /(?:hot[eé]l|alojamento|acomoda[cç][aã]o|accommodation|hospedagem|estadia|resort|hostel|property)\s*[:\-–—]\s*(.{3,180})/i.exec(line)
      || /(?:alojamento|acomoda[cç][aã]o|hospedagem|estadia)\s+(?:no|na|em|at)\s+(.{3,180}?)(?:[,.;]|$)/i.exec(line);
    const hotelMetadata = /^(?:check[- ]?in|check[- ]?out|entrada|sa[ií]da|noites?|cidade|city|destino|destination|regime|board|meal plan|quarto|tipo de quarto|room|e-?mail|telefone|phone|tel\.?|refer[eê]ncia|localizador|booking reference|operador|fornecedor|provider|supplier)\b/i;
    const isHotelLine = !hotelMetadata.test(line) && (Boolean(hotelMatch) || inHotelSection && !sectionEnd.test(line) && !dateCells(line).length);
    if (isHotelLine) {
      const rawName = hotelMatch?.[1] || line;
      let title = rawName.replace(/^\s*(?:no|na|em|at)\s+/i, "").replace(/\s+(?:check[- ]?in|check[- ]?out|entrada|sa[ií]da|regime|refei[cç][oõ]es?)\b.*$/i, "").replace(/[,;].*$|\.\s.*$/, "").trim();
      const following = lines.slice(index + 1, index + 3);
      const checkIn = /^(?:check[- ]?in|entrada)\b/i;
      const checkOut = /^(?:check[- ]?out|sa[ií]da)\b/i;
      const bounds = extractDateBounds(line);
      const inlineStart = bounds.departure_date || extractSingleDate(following.find(value => checkIn.test(value)) ?? "");
      const inlineEnd = (bounds.return_date !== bounds.departure_date ? bounds.return_date : "") ||
        extractSingleDate(following.find(value => checkOut.test(value)) ?? "");
      const wrapped = hotelMatch && !inlineStart && !inlineEnd ? precedingStayDates(lines, index) : [];
      const start = inlineStart || wrapped[0] || "";
      const end = inlineEnd || wrapped[1] || "";
      const datePrefix = extractDateBounds(line.slice(0, hotelMatch?.index ?? 0));
      if (start && end && start < end && (wrapped.length || datePrefix.departure_date !== datePrefix.return_date)) {
        const nights = (Date.parse(end) - Date.parse(start)) / 86400000;
        title = title.replace(new RegExp(`\\s+${nights}(?:\\s+(?:noites?|nights?))?$`, "i"), "");
      }
      const serviceContext = lines.slice(Math.max(0, index - (wrapped.length && dateCells(lines[index - 1]).length === 1 ? 2 : 1)), index + 3).join(" ");
      const hotelBlock = lines.slice(index + 1, index + 12).filter((_, offset, followingLines) =>
        !followingLines.slice(0, offset + 1).some(item => /^(?:hotel|alojamento|accommodation|voo|flight|total)\s*[:–—-]/i.test(item)));
      const booking: BookingDetails = {};
      const metadata = [
        ["city", /^(?:cidade|city)\s*:\s*(.+)$/i],
        ["destination", /^(?:destino|destination)\s*:\s*(.+)$/i],
        ["room", /^(?:quarto|tipo de quarto|room(?: type)?)\s*:\s*(.+)$/i],
        ["board", /^(?:regime|meal plan|board(?: basis)?)\s*:\s*(.+)$/i],
        ["email", /^(?:e-?mail(?: do hotel)?)\s*:\s*([^\s@]+@[^\s@]+\.[^\s@]+)$/i],
        ["phone", /^(?:telefone|phone|tel\.?)\s*:\s*(\+?[0-9][0-9 ().-]{2,49})$/i],
      ] as const;
      for (const [key, pattern] of metadata) {
        const value = hotelBlock.map(item => pattern.exec(item)?.[1]).find(Boolean);
        if (value) booking[key] = value.trim().slice(0, bookingTextFields[key]);
      }
      const provider = hotelBlock.map(item => /^(?:operador|fornecedor|supplier|provider)\s*:\s*(.+)$/i.exec(item)?.[1]).find(Boolean) || "";
      const reference = hotelBlock.map(item => /^(?:localizador|refer[eê]ncia|booking reference)\s+(?:do hotel|hotel)\s*[:#-]\s*([A-Z0-9][A-Z0-9/-]{2,})$/i.exec(item)?.[1]).find(Boolean) || "";
      add({ service_type: "accommodation", title: title.slice(0, 240), provider: provider.slice(0, 160), reference: reference.slice(0, 100), starts_on: start, ends_on: end, details: serviceContext.slice(0, 1000), booking });
    }
  }

  // Detailed itineraries often put the carrier and flight number on a heading,
  // with origin, destination and dates on the following lines. Read each block
  // up to the next flight heading instead of requiring all fields on one line.
  const flightHeading = /^([\p{L}\p{N}][\p{L}\p{N} .&'()]{1,60}?)\s*[-–—]\s*([A-Z]{2,3})\s?(\d{2,4})\s*$/u;
  const headings = lines.flatMap((line, index) => {
    const match = flightHeading.exec(line);
    return match ? [{ index, provider: match[1].trim(), reference: `${match[2]} ${match[3]}`, code: `${match[2]}${match[3]}` }] : [];
  });
  const detailedFlights: TripPdfService[] = headings.map((heading, index) => {
    const end = Math.min(headings[index + 1]?.index ?? lines.length, heading.index + 12);
    const segmentLines = lines.slice(heading.index + 1, end);
    const boundary = segmentLines.findIndex(line => /^(?:hotel|alojamento|accommodation|total|condi[cç][oõ]es)\b/i.test(line));
    const scoped = (boundary < 0 ? segmentLines : segmentLines.slice(0, boundary)).filter(line => !/^bagagem\b/i.test(line));
    const block = [lines[heading.index], ...scoped].join(" ");
    const airportLines = scoped.flatMap(line => {
      const code = /\(([A-Z]{3})\)/.exec(line)?.[1];
      return code ? [{ code, date: extractSingleDate(line), time: /\b(?:[01]\d|2[0-3]):[0-5]\d\b/.exec(line)?.[0] }] : [];
    });
    const [from, to] = airportLines;
    const dates = extractDateBounds(block);
    const route = from && to ? `${from.code} → ${to.code}` : "";
    const departureZone = scoped.map(line => /^(?:fuso da partida|departure time zone)\s*:\s*([A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+|UTC)\s*$/i.exec(line)?.[1]).find(Boolean);
    const arrivalZone = scoped.map(line => /^(?:fuso da chegada|arrival time zone)\s*:\s*([A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+|UTC)\s*$/i.exec(line)?.[1]).find(Boolean);
    const pnr = scoped.map(line => /^(?:PNR|localizador (?:do voo|a[eé]reo)|airline booking reference)\s*[:#-]\s*([A-Z0-9][A-Z0-9/-]{3,24})\s*$/i.exec(line)?.[1]).find(Boolean);
    return {
      service_type: "flight",
      title: [heading.reference, route].filter(Boolean).join(" · "),
      provider: heading.provider,
      reference: heading.reference,
      starts_on: from?.date || dates.departure_date,
      ends_on: to?.date || (dates.return_date !== dates.departure_date ? dates.return_date : ""),
      details: block.slice(0, 1000),
      booking: Object.fromEntries(Object.entries({ flight_number: heading.reference, origin: from?.code,
        destination_airport: to?.code, departure_time: from?.time, arrival_time: to?.time, departure_zone: departureZone, arrival_zone: arrivalZone, pnr }).filter(([, value]) => value)),
    };
  });
  const flightCode = (value: string) => value.replace(/\s/g, "").toUpperCase();
  const flights = services.filter(service => service.service_type === "flight" &&
    (!detailedFlights.length ? Boolean(service.reference || service.title.includes(" → ")) : (service.reference && !detailedFlights.some(flight =>
      flightCode(flight.reference) === flightCode(service.reference) &&
      (!service.starts_on || !flight.starts_on || flight.starts_on === service.starts_on))))
  );
  flights.push(...detailedFlights.filter((flight, index) => !detailedFlights.slice(0, index).some(previous =>
    flightCode(previous.reference) === flightCode(flight.reference) &&
    serviceName(previous.title) === serviceName(flight.title) &&
    previous.starts_on === flight.starts_on && previous.ends_on === flight.ends_on
  )));
  return [...flights, ...mergeHotelMentions(services.filter(service => service.service_type === "accommodation"))].slice(0, 40);
}

export function extractTripFieldsFromPdfText(text: string): TripPdfFields {
  const cleanText = text.replace(/\u00a0/g, " ");
  const labeledReference = /^(?:localizador(?: principal| da viagem)?|refer[eê]ncia(?: da viagem| da reserva)?|booking reference|reserva)\s*[:#-]\s*([A-Z0-9][A-Z0-9/-]{3,24})\s*$/im.exec(cleanText)?.[1];
  const reference = labeledReference || "";
  const adults = extractPassengerCount(cleanText, "adults");
  const children = extractPassengerCount(cleanText, "children");
  const dates = extractDateRange(cleanText);
  const services = extractTravelServices(cleanText);
  const flightDates = [...new Set(services.filter((service) => service.service_type === "flight").flatMap((service) => [service.starts_on, service.ends_on]).filter(isValidDateOnly))].sort();
  const price = extractPrice(cleanText);
  return {
    reference,
    destination: extractDestination(cleanText),
    departure_date: dates.departure_date || flightDates[0] || "",
    return_date: dates.return_date || flightDates.at(-1) || "",
    adults,
    children_count: children,
    total_amount: price.amount,
    currency: price.currency,
    operator: extractOperator(cleanText),
    trip_notes: "",
    services,
  };
}
