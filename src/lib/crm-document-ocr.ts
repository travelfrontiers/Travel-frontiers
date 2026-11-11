export type IdentityDocumentType = "passport" | "identity_card";
export type DocumentReading = {
  document_type: IdentityDocumentType | null;
  full_name: string;
  birth_date: string;
  expires_on: string;
  document_number: string;
};

export const identityFieldLabels = {
  document_type: "tipo", document_number: "número/ID", full_name: "nome completo",
  birth_date: "data de nascimento", expires_on: "validade",
} satisfies Record<keyof DocumentReading, string>;
const identityFields = Object.keys(identityFieldLabels) as (keyof DocumentReading)[];

export function missingIdentityFields(reading: DocumentReading) {
  return identityFields.filter(field => !reading[field]).map(field => identityFieldLabels[field]);
}

const emptyReading: DocumentReading = {
  document_type: null, full_name: "", birth_date: "", expires_on: "", document_number: "",
};
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
const nameKey = (text: string) => fold(text).replace(/[^A-Z]/g, "");
const nameCase = (text: string) => text.toLocaleLowerCase("pt-PT").replace(/(^|[\s'-])\p{L}/gu, letter => letter.toLocaleUpperCase("pt-PT"));

function realDate(year: number, month: number, day: number) {
  const value = String(year).padStart(4, "0") + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  const parsed = new Date(value + "T00:00:00Z");
  return year >= 1850 && year <= 2200 && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
}

// ICAO Doc 9303, TD1 (identity cards) and TD3 (passports).
function checked(value: string, check: string) {
  if (!/^[A-Z0-9<]+$/.test(value) || !/^\d$/.test(check)) return false;
  const weights = [7, 3, 1];
  const sum = [...value].reduce((total, character, index) => {
    const digit = character === "<" ? 0 : /\d/.test(character) ? Number(character) : character.charCodeAt(0) - 55;
    return total + digit * weights[index % 3];
  }, 0);
  return sum % 10 === Number(check);
}

const numericOcr = (value: string) => value.replace(/[OQ]/g, "0").replace(/[IL]/g, "1").replace(/Z/g, "2").replace(/S/g, "5").replace(/B/g, "8");

function mrzDate(value: string, digit: string, today: string, birth: boolean) {
  const digits = numericOcr(value);
  if (!/^\d{6}$/.test(digits) || !checked(digits, numericOcr(digit))) return "";
  const nowYear = Number(today.slice(0, 4));
  const shortYear = Number(digits.slice(0, 2));
  let year = Math.floor(nowYear / 100) * 100 + shortYear;
  if (birth) {
    if (realDate(year, Number(digits.slice(2, 4)), Number(digits.slice(4))) > today) year -= 100;
  } else {
    if (year > nowYear + 25) year -= 100;
    if (year < nowYear - 74) year += 100;
  }
  return realDate(year, Number(digits.slice(2, 4)), Number(digits.slice(4)));
}

function mrzName(value: string) {
  const [surnames, given = ""] = value.split(/<{2,}/, 2);
  const parts = [given, surnames].map(part => part.replace(/<+/g, " ").trim());
  if (!parts.every(part => /^[A-Z]+(?: [A-Z]+)*$/.test(part))) return "";
  return nameCase(parts.join(" "));
}

function readMrz(text: string, today: string): DocumentReading[] {
  const rows = text.split(/\r?\n/).map(line => fold(line).replace(/[«»]/g, "<<").replace(/[›‹>]/g, "<").replace(/\s+/g, ""));
  const candidates: DocumentReading[] = [];
  for (let index = 0; index < rows.length - 1; index++) {
    const first = rows[index], second = rows[index + 1];
    // The fields we read end at the expiry check digit. OCR noise in the
    // optional data after that point must not discard validated fields.
    const passportFields = second.slice(0, 28);
    if (/^P[A-Z<][A-Z]{3}[A-Z<]+$/.test(first) && first.length >= 15 && first.length <= 46 &&
        /^[A-Z0-9<]{10}[A-Z<]{3}[A-Z0-9]{7}[MFX<][A-Z0-9]{7}$/.test(passportFields)) {
      const birth = mrzDate(second.slice(13, 19), second[19], today, true);
      const expiry = mrzDate(second.slice(21, 27), second[27], today, false);
      const number = second.slice(0, 9);
      if (birth || expiry) candidates.push({
        document_type: "passport", full_name: mrzName(first.slice(5)), birth_date: birth, expires_on: expiry,
        document_number: checked(number, numericOcr(second[9])) ? number.replace(/<+$/g, "") : "",
      });
    }
    if (/^I[A-Z<]PRT[A-Z0-9<]+$/.test(first) && first.length >= 15 && first.length <= 32 &&
        /^[A-Z0-9<]{18,32}$/.test(second) && /PRT/.test(second.slice(15, 18))) {
      const birth = mrzDate(second.slice(0, 6), second[6], today, true);
      const expiry = mrzDate(second.slice(8, 14), second[14], today, false);
      const number = first.slice(5, 14);
      if (birth || expiry) candidates.push({
        document_type: "identity_card", full_name: mrzName(rows[index + 2] || ""), birth_date: birth, expires_on: expiry,
        document_number: checked(number, numericOcr(first[14])) ? number.replace(/<+$/g, "") : "",
      });
    }
  }
  return candidates;
}

const months: Record<string, number> = {
  JAN:1, FEV:2, FEB:2, MAR:3, ABR:4, APR:4, MAI:5, MAY:5, JUN:6,
  JUL:7, AGO:8, AUG:8, SET:9, SEP:9, OUT:10, OCT:10, NOV:11, DEZ:12, DEC:12,
};
function printedDate(line: string) {
  const normalized = fold(line);
  const iso = normalized.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return realDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const numeric = normalized.match(/\b(\d{1,2})[\s./-]+(\d{1,2})[\s./-]+(\d{4})\b/);
  if (numeric) return realDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  const named = normalized.match(/\b(\d{1,2})[\s./-]+([A-Z]{3})(?:\s*\/\s*([A-Z]{3}))?[\s./-]+(\d{4})\b/);
  return named ? realDate(Number(named[4]), months[named[2]] || months[named[3]], Number(named[1])) : "";
}

const birthLabel = /\b(?:DATA DE NASCIMENTO|DATE OF BIRTH|NASCIMENTO|NAISSANCE|BIRTH)\b/;
const expiryLabel = /\b(?:DATA DE VALIDADE|VALIDADE|DATE OF EXPIRY|EXPIRY DATE|EXPIRATION DATE|VALIDO ATE|VALID UNTIL|EXPIRY|EXPIRATION|VALIDITE)\b/;
const fieldLabel = /\b(?:NOME|NAME|NAMES|APELIDOS|SURNAME|SURNAMES|NOM|SEXO|SEX|ISSUE|EMISSAO|VALIDADE|EXPIRY|NASCIMENTO|BIRTH|NACIONALIDADE|NATIONALITY|DOCUMENTO|DOCUMENT)\b/;
function labelledDate(lines: string[], label: RegExp) {
  for (let index = 0; index < lines.length; index++) {
    if (!label.test(fold(lines[index]))) continue;
    const onLabel = printedDate(lines[index]);
    if (onLabel) return onLabel;
    for (const following of lines.slice(index + 1, index + 3)) {
      if (fieldLabel.test(fold(following))) break;
      const value = printedDate(following);
      if (value) return value;
    }
  }
  return "";
}
function labelledName(lines: string[], label: RegExp) {
  for (let index = 0; index < lines.length; index++) {
    const match = fold(lines[index]).match(label);
    if (!match || match.index === undefined) continue;
    const inline = lines[index].slice(match.index + match[0].length).replace(/^\s*[:|–-]\s*/, "").trim();
    for (const candidate of [inline, lines[index + 1]?.trim() || ""]) {
      if (candidate.length >= 2 && candidate.length <= 160 && /^[\p{L}][\p{L}\p{M} '-]+$/u.test(candidate) &&
          !fieldLabel.test(fold(candidate))) return nameCase(candidate);
    }
  }
  return "";
}

const numberLabel = /(?:\b(?:NUMERO|N(?:\.?\s*[º°O])?)\.?\s*(?:D[EO]\s+)?(?:DOCUMENTO|PASSAPORTE|CARTAO)\b|\b(?:DOCUMENT|PASSPORT)\s+(?:NUMBER|NO\.?|N[°º]|#))/g;
function printedDocumentNumber(lines: string[]) {
  const found = new Set<string>();
  for (let index = 0; index < lines.length; index++) {
    const line = fold(lines[index]);
    const label = [...line.matchAll(numberLabel)].at(-1);
    if (!label || label.index === undefined) continue;
    const tail = line.slice(label.index + label[0].length).replace(/^[\s:|/–-]+/, "");
    const value = tail || fold(lines[index + 1] || "");
    if (printedDate(value) || !/^[A-Z0-9]+(?:[ -][A-Z0-9]+){0,3}$/.test(value)) continue;
    const number = value.replace(/ /g, "");
    if (/^(?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{4,19}$/.test(number)) found.add(number);
  }
  return found.size === 1 ? [...found][0] : "";
}

export function readIdentityPage(scans: string[], today: string): DocumentReading {
  const verified = scans.flatMap(scan => readMrz(scan, today));
  const fingerprints = new Set(verified.filter(reading => reading.document_number).map(reading => reading.document_type + ":" + reading.document_number));
  if (fingerprints.size > 1) throw new Error("Foram lidos documentos diferentes. Escolhe apenas as páginas ou faces do mesmo documento.");
  const lines = scans.flatMap(scan => scan.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
  const normalized = fold(lines.join("\n"));
  const result = { ...emptyReading };
  for (const candidate of verified) {
    result.document_type ||= candidate.document_type;
    result.full_name ||= candidate.full_name;
    result.birth_date ||= candidate.birth_date;
    result.expires_on ||= candidate.expires_on;
    result.document_number ||= candidate.document_number;
  }
  if (/\bCARTAO\s+DE\s+CIDADAO\b/.test(normalized) && /\b(PASSAPORTE|PASSPORT|PASSEPORT)\b/.test(normalized)) {
    throw new Error("Foram encontrados tipos de documento diferentes. Lê um documento de cada vez.");
  }
  if (!result.document_type) {
    if (/\bCARTAO\s+DE\s+CIDADAO\b/.test(normalized)) result.document_type = "identity_card";
    else if (/\b(PASSAPORTE|PASSPORT|PASSEPORT)\b/.test(normalized)) result.document_type = "passport";
  }
  result.document_number ||= printedDocumentNumber(lines);
  const printedBirth = labelledDate(lines, birthLabel);
  const printedExpiry = labelledDate(lines, expiryLabel);
  // A matching full printed year resolves the century ambiguity in the MRZ.
  if (printedBirth && printedBirth <= today && (!result.birth_date || printedBirth.slice(2) === result.birth_date.slice(2))) result.birth_date = printedBirth;
  if (printedExpiry && (!result.expires_on || printedExpiry.slice(2) === result.expires_on.slice(2))) result.expires_on = printedExpiry;
  const surname = labelledName(lines, /\b(?:APELIDOS?|SURNAMES?|NOM DE FAMILLE)\b/);
  const given = labelledName(lines, /\b(?:NOME\(S\)|NOMES?|GIVEN NAMES?|PRENOMS?)\b/);
  const printedName = labelledName(lines, /\b(?:NOME COMPLETO|FULL NAME|NOM COMPLET)\b/) || (given && surname ? given + " " + surname : "");
  const coverSurname = result.document_type === "passport" ? labelledName(lines, /^\[01\]/) : "";
  const coverGiven = coverSurname ? labelledName(lines, /^\[02\]/) : "";
  const coverName = coverGiven ? coverGiven + " " + coverSurname : "";
  const visibleName = coverName && result.full_name && nameKey(coverName) === nameKey(result.full_name) ? coverName : printedName;
  if (visibleName && (!result.full_name || nameKey(visibleName) === nameKey(result.full_name))) result.full_name = visibleName;
  if (result.birth_date && result.expires_on && result.expires_on < result.birth_date) result.expires_on = "";
  return result;
}

export function combineIdentityPages(pages: DocumentReading[]): DocumentReading {
  const [first, second] = [...pages].sort((a, b) =>
    identityFields.filter(field => b[field]).length - identityFields.filter(field => a[field]).length);
  if (!first) return { ...emptyReading };
  if (!second || identityFields.every(field => !second[field])) return first;
  const namesMatch = Boolean(first.full_name && second.full_name && nameKey(first.full_name) === nameKey(second.full_name));
  const numbersMatch = Boolean(first.document_number && first.document_number === second.document_number);
  const conflicts = identityFields.some(field =>
    first[field] && second[field] && (field === "full_name" ? !namesMatch : first[field] !== second[field]));
  if (conflicts) throw new Error("As páginas têm dados diferentes. Escolhe apenas as faces do mesmo documento.");
  // Without evidence that the pages match, keep the most complete reading on its own.
  if (!numbersMatch && !(namesMatch && first.birth_date && first.birth_date === second.birth_date)) return first;
  return {
    document_type: first.document_type || second.document_type,
    document_number: first.document_number || second.document_number,
    full_name: first.full_name || second.full_name,
    birth_date: first.birth_date || second.birth_date,
    expires_on: first.expires_on || second.expires_on,
  };
}
