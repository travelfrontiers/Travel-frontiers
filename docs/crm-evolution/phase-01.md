# Evolução do CRM · Fase 1

Comparação feita com a `main` em `2324826` a partir do [briefing de evolução do CRM](https://github.com/travelfrontiers/Travel-frontiers/blob/feat/crm-ux-and-commission-control/CRM_EVOLUTION_AGENT_BRIEF.md).

| Área | O que já existe na `main` | Trabalho de evolução |
| --- | --- | --- |
| Operação comercial | Pedidos manuais e via formulário, clientes, detecção e fusão de duplicados, propostas com versões e conversão para viagem | Acesso direto a partir do menu e da ficha de viagem |
| Gestão da viagem | Serviços, associação de viajantes, OCR no navegador, importação de orçamentos PDF e documentos Google Drive | Ficha única nesta fase. Valores por serviço e reconciliação financeira na fase 3 |
| Tarefas e comunicação | Calendário, checklists por modelo, tarefas de voo, lembretes, emails pré e pós-contratação, modelos editáveis, anexos e histórico SMTP/IMAP | Acessos por viagem nesta fase. Consolidação dos avisos e ações de comunicação na fase 2 |
| Pagamentos | Total da reserva, prestações, recibos, reembolsos e alertas de vencimento | Ficha de pagamentos dentro da viagem e ligação direta a partir dos alertas nesta fase |
| Comissões | Calculadora, autoconsumo, estimativa por viagem e recebimentos | Visão por viagem nesta fase. Confirmação da agência, comprovativos e reconciliação na fase 4 |

## Navegação entregue

- Menu principal — Início, Pedidos, Viagens, Clientes e Comissões.
- Ferramentas — Calendário, Propostas, Modelos de email, Histórico, Templates e checklists, Duplicados e Pagamentos.
- Ficha de viagem — Resumo, Serviços, Pagamentos, Documentos, Tarefas, Comunicações e Alertas, Comissão. As propostas, o histórico e as fichas dos viajantes podem ser abertos a partir da viagem.

## Fases seguintes

2. **Comunicações e alertas.** Consolidar pendências e histórico por viagem. Validar os eventos e os envios com relógio e transporte simulados. Preservar a proteção contra duplicações e os estados de entrega incerta.
3. **Financeiro por serviço.** Registar custos e preços por serviço e preservar o histórico de valores por viagem. Apresentar totais por moeda e assinalar diferenças para revisão, com migração aditiva.
4. **Controlo e reconciliação de comissões.** Separar estimativa, valor confirmado pela agência e recebimentos líquidos. Associar períodos, movimentos e comprovativos. Avaliar o formato de importação com uma amostra anonimizada antes de implementar o leitor.

O percurso de comissão proposto é Por calcular → A confirmar → Confirmada → Parcialmente recebida → Recebida. A divergência pode ser assinalada em paralelo com o estado de recebimento. A regularização exige registo explícito e comprovativo. Um estorno pode reabrir a diferença. A comparar por moeda, a diferença face à estimativa é a estimativa menos o valor confirmado, e o saldo por receber é o confirmado menos o recebido líquido. A fase 1 apresenta apenas a diferença face à estimativa com os valores disponíveis hoje.

## Riscos e verificações

- A navegação tem de preservar pedidos manuais, edição de propostas, documentos e formulários começados antes de mudar de separador.
- Prestação vencida, prazo de check-in e validade documental têm origens e datas distintas. Validar em Europe/Lisbon, incluindo mudanças de hora, antes de alterar os automatismos.
- Tem de ser possível representar viagens antigas com dados financeiros incompletos. Um valor desconhecido aparece como `—`. A diferença face à estimativa e o saldo do cliente têm rótulos distintos.
- As verificações desta fase usam dados fictícios. As capturas foram obtidas no Chromium, em desktop e com dimensão de iPhone 13. Os testes de email simulam o transporte.

[Lista de viagens em desktop](lista-desktop.jpg) · [Pagamentos na ficha em ecrã móvel](pagamentos-mobile.jpg)
