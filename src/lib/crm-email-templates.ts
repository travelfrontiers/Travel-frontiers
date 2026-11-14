export const emailScopes = ["lead", "proposal", "trip"] as const;
export type EmailScope = typeof emailScopes[number];
export const emailLanguages = { pt: "Português", en: "English", fr: "Français" } as const;
export type EmailLanguage = keyof typeof emailLanguages;
export const emailTemplateKeys = ["received", "research", "quote", "follow_up", "booking", "before_trip", "during_trip", "after_trip", "document_renewal"] as const;
export type EmailTemplateKey = typeof emailTemplateKeys[number];
export const emailTemplateBodyLimit = 16000;
export type EmailAttachmentRole = "quote" | "fin" | "terms" | "other";

export const emailAttachmentLabels: Record<EmailAttachmentRole, string> = {
  quote: "PDF do orçamento", fin: "FIN", terms: "Condições gerais de venda", other: "Outro documento",
};

type Template = {
  label: string;
  scopes: readonly EmailScope[];
  required?: readonly EmailAttachmentRole[];
  copy: Record<EmailLanguage, readonly [subject: string, body: string]>;
};

export const emailTemplates: Record<EmailTemplateKey, Template> = {
  received: {
    label: "Receção do pedido e dados em falta", scopes: ["lead"],
    copy: {
      pt: ["Recebi o teu pedido de viagem", "Obrigado pelo teu pedido de viagem para {{destino}}. Estou a analisar os dados que partilhaste. Para avançar, preciso de confirmar {{dados_em_falta}}. Podes responder a este email com a informação."],
      en: ["I’ve received your travel request", "Thank you for your travel request for {{destino}}. I’m reviewing the details you shared. To get started, I need to confirm {{dados_em_falta}}. You can reply to this email with the information."],
      fr: ["J’ai reçu ta demande de voyage", "Merci pour ta demande de voyage pour {{destino}}. J’examine les informations reçues. Pour avancer, j’ai besoin de confirmer {{dados_em_falta}}. Tu peux me répondre par e-mail."],
    },
  },
  research: {
    label: "Pré-orçamento · atualização da pesquisa", scopes: ["lead", "proposal"],
    copy: {
      pt: ["Atualização sobre a tua viagem a {{destino}}", "Estou a preparar as opções para {{destino}}. {{atualizacao}}. Se as tuas preferências ou datas mudaram, diz-me por resposta a este email."],
      en: ["An update on your trip to {{destino}}", "I’m preparing options for {{destino}}. {{atualizacao}}. If your preferences or dates have changed, please let me know by replying to this email."],
      fr: ["Des nouvelles de ton voyage à {{destino}}", "Je prépare les options pour {{destino}}. {{atualizacao}}. Si tes préférences ou tes dates ont changé, réponds à cet e-mail pour me le dire."],
    },
  },
  quote: {
    label: "Antes da reserva · enviar orçamento", scopes: ["proposal"],
    required: ["quote", "fin", "terms"],
    copy: {
      pt: ["Proposta de viagem para {{destino}} · versão {{versao}}", "Segue em anexo a proposta para {{destino}}, no período {{periodo}}.\n\nValor total: {{valor}}. Desconto: {{desconto}}.\nValidade: {{validade}}.\nPagamento: {{condicoes_pagamento}}.\nCancelamento: {{cancelamento}}.\nSeguro incluído e opção de seguro adicional: {{seguro}}.\nAlojamento e regime: {{hotel_regime}}.\nDocumentação necessária: {{documentacao}}.\nComparência no aeroporto: {{aeroporto}}.\nProteção de dados: {{privacidade}}.\n\nJunto envio a FIN e as condições gerais de venda. Para aceitares, responde a este email a indicar que leste e aceitas a proposta desta versão e os documentos anexos."],
      en: ["Travel proposal for {{destino}} · version {{versao}}", "Please find attached the proposal for {{destino}} for {{periodo}}.\n\nTotal: {{valor}}. Discount: {{desconto}}.\nValid until: {{validade}}.\nPayment: {{condicoes_pagamento}}.\nCancellation: {{cancelamento}}.\nIncluded and optional insurance: {{seguro}}.\nAccommodation and board: {{hotel_regime}}.\nRequired documents: {{documentacao}}.\nAirport arrival: {{aeroporto}}.\nData protection: {{privacidade}}.\n\nThe standard information form and general terms are attached. To accept, please reply confirming that you have read and accept this version of the proposal and its attachments."],
      fr: ["Proposition de voyage à {{destino}} · version {{versao}}", "Voici en pièce jointe la proposition pour {{destino}}, pour la période {{periodo}}.\n\nMontant total : {{valor}}. Remise : {{desconto}}.\nValidité : {{validade}}.\nPaiement : {{condicoes_pagamento}}.\nAnnulation : {{cancelamento}}.\nAssurance incluse et option supplémentaire : {{seguro}}.\nHébergement et pension : {{hotel_regime}}.\nDocuments nécessaires : {{documentacao}}.\nArrivée à l’aéroport : {{aeroporto}}.\nProtection des données : {{privacidade}}.\n\nLe formulaire d’information standard et les conditions générales sont joints. Pour accepter, réponds à cet e-mail en confirmant que tu as lu et accepté cette version de la proposition et les pièces jointes."],
    },
  },
  follow_up: {
    label: "Pós-orçamento · seguimento", scopes: ["proposal"],
    copy: {
      pt: ["Seguimento da proposta para {{destino}}", "Queria saber se já tiveste oportunidade de ver a proposta para {{destino}}. Se tiveres dúvidas ou quiseres alterar algum detalhe, responde a este email e vemos as opções."],
      en: ["Following up on your proposal for {{destino}}", "Have you had a chance to look at the proposal for {{destino}}? If you have questions or would like to change anything, reply to this email and we can review the options."],
      fr: ["Suivi de la proposition pour {{destino}}", "As-tu eu l’occasion de consulter la proposition pour {{destino}} ? Si tu as des questions ou souhaites modifier un détail, réponds à cet e-mail et nous regarderons les options."],
    },
  },
  booking: {
    label: "Após a reserva · confirmação", scopes: ["trip"],
    copy: {
      pt: ["Confirmação da reserva · {{destino}}", "A tua reserva para {{destino}}, no período {{periodo}}, está confirmada.\nReferência: {{referencia}}.\nValor total: {{valor}}. Desconto: {{desconto}}.\nRecebido: {{pago}}. Saldo: {{saldo}}. Prazo: {{prazo}}.\nCancelamento: {{cancelamento}}.\nSeguro contratado: {{seguro}}.\nHotel e regime: {{hotel_regime}}.\nProteção de dados: {{privacidade}}.\n\nA previsão para o envio da documentação final é cerca de sete dias antes da partida. Responde a este email a confirmar que recebeste e verificaste os dados e a informação da reserva."],
      en: ["Booking confirmation · {{destino}}", "Your booking for {{destino}}, for {{periodo}}, is confirmed.\nReference: {{referencia}}.\nTotal: {{valor}}. Discount: {{desconto}}.\nReceived: {{pago}}. Balance: {{saldo}}. Due date: {{prazo}}.\nCancellation: {{cancelamento}}.\nInsurance booked: {{seguro}}.\nHotel and board: {{hotel_regime}}.\nData protection: {{privacidade}}.\n\nI expect to send the final travel documents around seven days before departure. Please reply to confirm that you received and checked the booking information."],
      fr: ["Confirmation de réservation · {{destino}}", "Ta réservation pour {{destino}}, pour la période {{periodo}}, est confirmée.\nRéférence : {{referencia}}.\nTotal : {{valor}}. Remise : {{desconto}}.\nReçu : {{pago}}. Solde : {{saldo}}. Échéance : {{prazo}}.\nAnnulation : {{cancelamento}}.\nAssurance souscrite : {{seguro}}.\nHôtel et pension : {{hotel_regime}}.\nProtection des données : {{privacidade}}.\n\nL’envoi des documents définitifs est prévu environ sept jours avant le départ. Réponds à cet e-mail pour confirmer leur réception et la vérification des informations de réservation."],
    },
  },
  before_trip: {
    label: "Pré-viagem · documentos e lembretes", scopes: ["trip"],
    copy: {
      pt: ["Antes da partida para {{destino}}", "A tua viagem para {{destino}} está a aproximar-se.\nPartida: {{partida}}.\nDocumentos e informações úteis: {{documentacao}}.\nCheck-in e comparência no aeroporto: {{aeroporto}}.\n\nConfirma se está tudo em ordem e responde se precisares de ajuda."],
      en: ["Before you leave for {{destino}}", "Your trip to {{destino}} is coming up.\nDeparture: {{partida}}.\nTravel documents and useful information: {{documentacao}}.\nCheck-in and airport arrival: {{aeroporto}}.\n\nPlease check everything is in order and reply if you need help."],
      fr: ["Avant ton départ pour {{destino}}", "Ton voyage à {{destino}} approche.\nDépart : {{partida}}.\nDocuments de voyage et informations utiles : {{documentacao}}.\nEnregistrement et arrivée à l’aéroport : {{aeroporto}}.\n\nVérifie que tout est en ordre et réponds-moi si tu as besoin d’aide."],
    },
  },
  during_trip: {
    label: "Durante a viagem · acompanhamento", scopes: ["trip"],
    copy: {
      pt: ["Como está a correr a viagem a {{destino}}?", "Queria confirmar que está tudo a correr bem em {{destino}}. Se precisares de alguma coisa, responde a este email."],
      en: ["How is your trip to {{destino}} going?", "I wanted to check that everything is going well in {{destino}}. If you need anything, please reply to this email."],
      fr: ["Comment se passe ton voyage à {{destino}} ?", "Je voulais m’assurer que tout se passe bien à {{destino}}. Si tu as besoin de quelque chose, réponds-moi par e-mail."],
    },
  },
  after_trip: {
    label: "Pós-viagem · agradecimento", scopes: ["trip"],
    copy: {
      pt: ["Como correu a tua viagem a {{destino}}?", "Obrigado por viajares com a Travel Frontiers. Gostava de saber como correu a viagem a {{destino}} e se há algo que possamos melhorar. Podes responder diretamente a este email."],
      en: ["How was your trip to {{destino}}?", "Thank you for travelling with Travel Frontiers. I’d love to hear about your trip to {{destino}} and anything we could improve. You can reply directly to this email."],
      fr: ["Comment s’est passé ton voyage à {{destino}} ?", "Merci d’avoir voyagé avec Travel Frontiers. J’aimerais savoir comment s’est passé ton voyage à {{destino}} et ce que nous pouvons améliorer. Tu peux répondre directement à cet e-mail."],
    },
  },
  document_renewal: {
    label: "Automático · renovação de documento", scopes: [],
    copy: {
      pt: ["Lembrete de renovação do teu documento · Travel Frontiers", "O documento registado na tua ficha ({{tipo_documento}}) termina a sua validade em {{validade}}. Recomendo que inicies a renovação com antecedência junto da entidade emissora, para teres tempo de receber o novo documento antes de viajar.\n\nSe já pediste a renovação, podes ignorar este lembrete. Quando tiveres o novo documento, responde a este email para combinarmos a atualização da ficha em segurança."],
      en: ["A reminder to renew your travel document · Travel Frontiers", "The document on your Travel Frontiers record ({{tipo_documento}}) expires on {{validade}}. I recommend starting the renewal with the issuing authority early so you have time to receive the new document before travelling.\n\nIf you have already applied for renewal, you can disregard this reminder. Once you receive the new document, please reply so we can arrange a secure update to your record."],
      fr: ["Rappel de renouvellement de ton document · Travel Frontiers", "Le document enregistré dans ton dossier ({{tipo_documento}}) expire le {{validade}}. Je te conseille de commencer les démarches auprès de l’autorité compétente suffisamment tôt pour recevoir le nouveau document avant de voyager.\n\nSi tu as déjà demandé le renouvellement, tu peux ignorer ce rappel. Dès réception du nouveau document, réponds à cet e-mail afin que nous puissions mettre à jour ton dossier en toute sécurité."],
    },
  },
};

export function baseEmailTemplate(key: EmailTemplateKey, language: EmailLanguage) {
  const [subject, body] = emailTemplates[key].copy[language];
  const greeting = { pt: "Olá", en: "Hi", fr: "Bonjour" }[language];
  const signoff = (key === "document_renewal" ? { pt: "Com os melhores cumprimentos", en: "Kind regards", fr: "Cordialement" }
    : { pt: "Um abraço", en: "Best wishes", fr: "À bientôt" })[language];
  return { subject, body: `${greeting} {{cliente}},\n\n${body}\n\n${signoff},\nTiago Ferreira\nTravel Frontiers` };
}

export function fillEmailTemplate(text: string, fields: Record<string, string>) {
  return text.replace(/\{\{([a-z_]+)\}\}/g, (match, key: string) => fields[key]?.trim() || match);
}

export function missingEmailFields(text: string) {
  return [...new Set([...text.matchAll(/\{\{([^{}\n]+)\}\}/g)].map(match => match[1]))];
}
