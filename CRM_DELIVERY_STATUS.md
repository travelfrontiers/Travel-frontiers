# Estado funcional do CRM — 8 de novembro de 2026

## Pontos 1, 2, 4 e 5
1. **Propostas e versões**: proposta ligada a cliente, oportunidade/pedido, viagem e documento no Drive. Cada versão guarda título, valor total/moeda, validade, destino/datas, operador, condições, inclusões/exclusões e notas. Versões anteriores preservadas e consulta por versão. Escritas concorrentes rejeitadas pela versão esperada. Estado comercial e nota da aceitação manual por resposta ao email; sem botão público de aceitação. Uma proposta aceite cria/abre uma viagem de forma idempotente. Uma nova versão não altera automaticamente uma viagem já existente.
2. **Templates/checklists**: modelos editáveis por tipo de viagem, aplicação manual ou automática e tarefas antes/durante/depois. Prazos relativos à partida ou regresso; reagendamento quando mudam as datas. Preserva conclusões, ajustes manuais e tarefas removidas; permite retomar o automatismo num item ajustado. Desativar modelos/itens impede novas aplicações sem eliminar tarefas já criadas. Check-in por voo mantém a tarefa dois dias antes e o alerta por email existente.
4. **Calendário visual**: vistas mensal e semanal; partidas, regressos, tarefas, próximos contactos, validade documental e validade das propostas. Filtros por cliente, tipo, texto e conclusão. Cada evento abre a ficha e, numa tarefa, foca o item correspondente. Consultas por intervalo com paginação interna, independentes da lista antiga carregada no navegador. Datas de tarefas em Europe/Lisbon.
5. **Histórico e dados**: registos de criação/alteração/eliminação em clientes, pedidos, propostas/versões, viagens, tarefas, serviços e documentação; notas manuais por ficha. Histórico começa na migração 012, sem inventar eventos anteriores. Guarda nomes dos campos e estados, sem copiar valores pessoais antigos ou números de documentos. Duplicados por nome/email/telefone normalizado, até 100 candidatos; escolha manual de duas fichas, revisão dos dados finais e confirmação explícita. Junção transacional transfere pedidos, viagens, documentação, Drive, propostas e histórico.

## Navegação e filtros
- Mesmo Admin Google e opções CRM/Promoções do Studio; sem criar uma segunda conta.
- Comercial: resumo, Kanban, clientes, propostas, histórico e duplicados.
- Operacional: viagens/checklists, calendário e templates.
- Pedidos: pesquisa, fase, próximo contacto e ordenação.
- Clientes: pesquisa, idioma, documentação a renovar, viagens associadas e ordenação.
- Viagens: pesquisa por destino/cliente/operador/referência, estado, tipo, cliente, intervalo de partida e ordenação.
- Propostas e histórico: filtros e paginação próprios.
- Novos ecrãs respeitam os temas claro/escuro e identidade Travel Frontiers.

## Base operacional já entregue
- Formulário PT/EN/FR com validação de email/datas/destino, orçamento obrigatório, crianças/idades, flexibilidade e confirmação de receção.
- Proteção gratuita da submissão: 5 pedidos/hora e 15/dia por ligação, 250/dia no total; repetição exata até 10 minutos não gera novo pedido/email. IP apenas como HMAC no servidor. Não equivale a proteção total contra ataques distribuídos.
- Notificações do formulário só para Tiago; gravação no servidor com INSERT público direto bloqueado.
- Clientes e viagens manuais, edição/eliminação, vários clientes por viagem, conversão do pedido sem transcrição manual e documentação individual com tipo/ID/validade.
- Gravação atómica da viagem e associações; falhar uma associação reverte tudo.
- Importação de PDF textual com revisão humana e serviços/voos associados.
- Dashboard visual e alertas de documentação/checklists/seguimentos.
- Lembretes de check-in por email diário às 09h UTC (pode executar dentro dessa hora no plano atual); apenas por concluir, voos futuros e viagens ativas. Lease evita envios simultâneos. Uma falha após aceitação pelo SMTP e antes da confirmação na base pode causar repetição.
- Drive: PDF/JPG/PNG até 20 MB, documentos por cliente/viagem e associação à versão da proposta. Credencial temporária no navegador com consentimento Google; tokens não guardados na base. Remover ligação no CRM não apaga o original no Drive. Não foi ativada faturação.
- A importação de orçamentos lê a camada de texto dos PDFs.

## Validação
- `node scripts/check-crm-office.cjs`: autorização nas cinco novas APIs; datas/mudança de hora/ano bissexto; validações e conflito entre versões; confirmação para junção; IDs dos itens; preservação de hora e automatismos ao concluir tarefas; proteção de tarefas de voo; eliminação por RPC; calendário para todos os viajantes; filtro de histórico por ficha. Rede simulada, sem emails reais.
- `supabase/tests/crm_office_regression.sql`: executado no Supabase com resultado PASS e ROLLBACK. Testou versões imutáveis/conflitos/aceitação/conversão, associação de viajantes, checklists sem duplicação/reagendamento/ajustes/conclusões/remoção, junção de fichas com todas as ligações, cascatas e privacidade/permissões.
- Migração 012 aplicada. Build de preview do conjunto de funcionalidades: READY. Alterações de apresentação finais verificadas com TypeScript local.
- Testes anteriores de formulário, gravação atómica, Drive e cron: `scripts/check-crm-operations.cjs`.
- A autorização Google para um upload real mantém-se como ação do utilizador no primeiro envio; não se deve assumir esse consentimento por estes testes.

## O que ainda falta no plano
- **Ponto 3**: revisão do PDF lado a lado; indicadores de campos ausentes/ambíguos; cobertura e persistência dos campos comuns ainda em falta.
- **Emails**: IMAP/histórico, templates editáveis aprovados, envio assistido e comunicações pré/pós-orçamento e pré/pós-viagem.
- **Reserva**: condições próprias e histórico de alterações da reserva. Os pagamentos e prazos das prestações estão disponíveis na ficha financeira.
- **Drive**: escolher ficheiros já existentes via Picker; atualmente os ficheiros entram pela ficha.
- **Dashboard**: indicadores financeiros/comerciais avançados baseados em propostas/valores reais.
- **Gestão de dados**: exportação, retenção, eliminação integral de informação pessoal em notas livres.
- Não considerar o CRM integralmente concluído enquanto estes blocos permanecerem pendentes.

## Verificação em Production
- Publicação da fase concluída com estado READY em Production, domínio promo.travelfrontiers.pt, após integração do PR #19.
- Sessão Google renovada com autorização do utilizador; dados reais do CRM voltaram a carregar sem o erro de credencial antigo.
- Ecrãs de propostas, histórico, duplicados e templates abertos no Admin publicado. Verificação visual identificou contraste a melhorar no texto secundário do tema escuro; corrigido juntamente com a seleção conjunta de documentos do cliente e viagem na proposta.

## Pagamentos, comissão e documentos — 10 de novembro de 2026

- Em **Vista operacional → Pagamentos e comissão**, cada viagem tem total da reserva, sinal, prestações, movimentos confirmados e saldo. Os recebimentos líquidos de reembolsos abatem às prestações por ordem de vencimento. O dashboard avisa de atrasos e prazos nos sete dias seguintes. O calendário liga à ficha financeira.
- Os movimentos permitem indicar quem confirmou o pagamento, o meio, a referência e o comprovativo no Drive. A comissão recebida e a estimativa têm saldos próprios. O cálculo reutiliza as regras da calculadora existente em euros. Guardar o cálculo permite confirmar expressamente a atualização do total da reserva.
- Em **Clientes → Documentação**, a leitura de passaporte e Cartão de Cidadão aceita até duas faces ou páginas em JPG, PNG, WebP ou PDF, com limite de 15 MB por ficheiro. O navegador sugere tipo, nome completo, nascimento, validade e número quando legível. A confirmação grava o documento e a identidade da ficha. O mesmo tipo e número na ficha atualizam o registo existente.
- O leitor corre no navegador, com bibliotecas e modelos servidos pelo próprio site. A gravação envia os campos revistos e o identificador da ficha.
- As migrações 013 e 014 incluem validações de saldos, permissões, versões para evitar gravações concorrentes e histórico sem copiar os valores dos documentos. A bateria SQL usa dados fictícios e reverte a transação de teste.
- Next.js 16.4.6 inclui as correções de segurança das versões anteriores. A compilação e os testes do CRM passaram com esta atualização.

## Arquivo, formulário e leitura de documentos — 11 de novembro de 2026

- Os pedidos arquivados saem do Kanban, dos indicadores ativos e dos lembretes de seguimento. Podem ser restaurados na fase anterior. Apagar exige confirmação e a base bloqueia pedidos ligados a propostas ou viagens.
- Arquivar uma viagem suspende os alertas operacionais. A ficha e os valores permanecem consultáveis em Pagamentos e comissão. Prestações, movimentos ou um cálculo de comissão impedem a eliminação da viagem.
- O formulário PT/EN/FR requer datas completas ou um período aproximado quando há flexibilidade. O período aparece no pedido do CRM e no aviso por email.
- A leitura de documentos analisa cada página e só combina dados quando consegue associar as duas faces. Os campos por ler aparecem vazios para revisão.
- As listas principais e respetivas relações são lidas por páginas com ordenação estável. A dependência transitiva basic-ftp foi atualizada para 6.2.6 na cadeia do get-uri.

## Ficha operacional das viagens — revisão de 15 de novembro de 2026

- A versão de referência já tinha lista de viagens, ficha com separadores, finanças por
  serviço, reconciliação de comissões e lembretes de documentação. A ficha evolui essa
  implementação. «Localizador» reutiliza o campo `reference` existente e aceita viagens
  sem código. As referências adicionais ficam na ficha, enquanto hotéis e voos guardam
  as referências próprias. Viajantes, documentos, histórico e comunicações continuam
  ligados às entidades existentes.
- Hotéis mostram contactos, noites, quarto, regime, confirmação, data da última
  confirmação, observações e ligação Drive. Voos mostram os segmentos por partida,
  datas e horas locais, fusos e PNR. Vários segmentos podem partilhar o mesmo PNR.
  Ligações de check-in são ativadas depois de confirmação manual do site oficial.
  O CRM não inicia contactos aos fornecedores.
- A abertura confirmada do check-in prevalece quando registada. Com data, hora e fuso
  de partida, a alternativa é uma estimativa de 48 horas decorridas. Sem esses dados,
  usa a estimativa existente de dois dias de calendário em Lisboa. Horas locais
  inexistentes são rejeitadas. Na hora repetida da mudança para o horário de inverno,
  aplica-se a interpretação padrão do PostgreSQL para o fuso indicado. A tarefa é
  preservada ao concluir, reagendar ou cancelar um voo. O envio por email conserva o
  agendamento diário e, por isso, pode seguir depois da hora de abertura.
- A leitura de PDFs textuais reutiliza o leitor e a revisão em propostas, criação de
  viagens e importação de serviços numa viagem existente. Um PDF pode ter campos
  ausentes, sobretudo fusos e referências por serviço. A importação mantém os campos
  operacionais já registados e só completa campos vazios nos serviços correspondentes.
  A confirmação manual da proposta e a criação ou associação da viagem decorrem na
  mesma transação. Os PDFs associados às versões das propostas aparecem na secção
  Documentos e conservam as permissões do Drive.
- O resumo lê a previsão, os recebimentos e a regularização da ficha financeira.
  Os movimentos, ajustes, prestações e fórmulas de autoconsumo/venda continuam nas
  rotinas financeiras existentes. A data do último recebimento usa os movimentos
  efetivos de comissão.
- A migração `202611150026_crm_operational_trip.sql` é aditiva para os registos existentes
  e deve preceder a publicação do código. Faz parte do PR de revisão. A base de
  produção e o domínio público ficam fora desta entrega. A bateria SQL usa dados
  sintéticos numa base PostgreSQL descartável e inclui o teste
  `supabase/tests/crm_operational_trip_regression.sql`.
