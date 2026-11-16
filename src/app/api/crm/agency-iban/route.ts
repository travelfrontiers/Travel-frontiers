import { isAuthorizedStudioUser } from "@/lib/crm-api";
import { privateJson } from "@/lib/crm-office-api";

export async function GET(request: Request) {
  if (!await isAuthorizedStudioUser(request)) {
    return privateJson({ error: "A sessão já não está disponível. Atualiza o CRM." }, 401);
  }
  const iban = process.env.CRM_GUPITRAVEL_IBAN?.trim();
  if (!iban || !/^PT[0-9]{23}$/.test(iban.replaceAll(" ", ""))) {
    return privateJson({ error: "O IBAN da GupiTravel está indisponível." }, 503);
  }
  return privateJson({ iban });
}
