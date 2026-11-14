# Travel Frontiers CRM — Briefing de evolução UX, operação e conciliação de comissões

**Data:** 14-11-2026  
**Estado:** especificação para o agente; a implementação ainda não está autorizada por este documento para publicar em produção.  
**Repositório:** travelfrontiers/Travel-frontiers  
**Branch de briefing:** feat/crm-ux-and-commission-control (partiu da main)  
**Contexto:** análise de uma demonstração em vídeo de outro CRM de viagens e decisões do proprietário do Travel Frontiers CRM. O vídeo serve de inspiração para fluxo e organização, não como sistema a copiar. As funcionalidades atuais mais avançadas devem ser preservadas.

## 0. Instruções imediatas ao agente

1. Ler este documento na íntegra, o `TRAVEL_FRONTIERS_CRM_PLAN.md`, `GUIA_UTILIZADOR_CRM.md`, `CRM_DELIVERY_STATUS.md`, `CRM_AUDIT.md` e **inspecionar o código mais recente da main** antes de propor alterações.
2. Fazer um inventário de funcionalidades **existentes / incompletas / a desenvolver**, distinguindo o que os documentos afirmam do que o código realmente suporta.
3. Apresentar primeiro um plano de implementação por PRs pequenos (com alterações previstas ao modelo de dados, regressões a testar, riscos e critérios de aceitação). Pode implementar em branch própria depois de definido o plano, **sem remover funcionalidades**.
4. Fazer alterações incrementais. Não fazer refactor massivo sem necessidade. Preservar compatibilidade de dados, migrações Supabase, identidades e documentos. Não usar dados reais de clientes nos testes.
5. Não modificar ou fazer deploy da main/produção, não enviar emails reais, não executar ações financeiras reais, não apagar dados/ficheiros nem reconfigurar credenciais sem autorização expressa do proprietário.
6. Registar em cada PR o que foi alterado, o que foi testado, o que continua pendente, e mostrar capturas ou previews da interface (desktop e iPhone).
7. Usar português de Portugal na interface, marca Travel Frontiers e identificação da Gupitravel onde aplicável.

## 1. Objetivo principal

Manter **todas as capacidades atuais**, reorganizando a navegação e os percursos para privilegiar uma operação simples, centrada na **ficha única da viagem**. Uma vez aceite um orçamento, o utilizador deve gerir serviços, passageiros, documentação, pagamentos, comissão, comunicações, tarefas e alertas na mesma ficha, sem saltar continuamente entre ecrãs.

O atual CRM já tem pipeline Kanban, clientes, viagens/serviços, propostas versionadas, modelos de email, leitura de documentos, Google Drive, calendário, tarefas, pagamentos e calculadora de comissões. Esta evolução não é um novo CRM nem uma substituição do sistema.

## 2. Prioridades funcionais decididas

**São intocáveis, salvo melhoria sem regressão:**
- Alertas no dashboard, calendário e contexto da ficha, com ligação à ação correspondente.
- Emails **pré-contratação** (enviar orçamento, FIN, condições gerais e anexos) e **pós-contratação** (confirmação e documentos contratuais) enviados **dentro do CRM**, com templates editáveis, revisão humana, pré-visualização, destinatários, anexos, histórico e respostas sincronizadas.
- Emails e comunicações pré-viagem, check-in e pós-viagem; manter a possibilidade de templates PT/EN/FR.
- OCR de passaporte/Cartão de Cidadão, revisão e confirmação de campos; importação de orçamentos PDF (PDF textual, com proposta de aperfeiçoamento para digitalizados quando viável e seguro); Google Drive e associação à viagem/cliente.
- Múltiplos viajantes por viagem, propostas com versões e registo explícito da aceitação por resposta do cliente, atividades/histórico, Kanban e checklists com os automatismos existentes.
- Calculadora da comissão com regras atuais `tf-commission-v2`, incluindo autoconsumo, partilha de poupança e cedência de comissão. **Não alterar fórmulas sem casos de teste contra o ficheiro de referência ou aprovação explícita.**
- Acesso autenticado atual, permissões, isolamento dos dados e identidade de marca.

**Exclusão explícita:** NÃO implementar o segmento final do vídeo com processo de **levantamento/pedido de pagamento de comissões**, emissão de documentos fiscais/recibos, ou submissões desse processo à agência. Quer-se controlar o valor a receber e a regularização; não executar o levantamento.

## 3. Arquitetura de navegação e UX (P1)

Reduzir o menu principal visível a:
1. **Início** — dashboard de trabalho.
2. **Pedidos** — pipeline comercial, Kanban, filtros, criação de pedido e propostas.
3. **Viagens** — lista central operacional (preferencialmente tabela em desktop, cartões úteis em mobile).
4. **Clientes** — pesquisa, dados, documentação e histórico.
5. **Comissões** — visão financeira global e reconciliação.

Manter as restantes funções acessíveis via secundário/contextual: **Calendário**, **Modelos de email**, **Propostas**, **Histórico**, **Templates/checklists**, **Duplicados**, **Configurações**. Não esconder fluxos críticos por trás de navegação pouco visível.

### Início
- Dashboard orientado a ações: novos pedidos, propostas à espera de resposta, follow-ups vencidos, tarefas por concluir, voos com check-in próximo, documentos a vencer, pagamentos vencidos/a vencer, clientes prestes a partir/regressar, comissões pendentes e discrepâncias de valores.
- Mostrar apenas informação real e relevante; não inventar valores nem tratar um alerta criado como um email enviado.
- Todos os cartões de alerta são clicáveis e abrem a ficha/ação correta, com filtros.
- Preservar os modos claro/escuro.

### Viagens
- Lista com procura e filtros por cliente, destino, operador, localizador, datas, estado, pagamentos e comissão; ordenação.
- Colunas essenciais: cliente/responsável, destino, datas, operador principal, referência/localizador, estado, total, saldo de cliente, comissão prevista, comissão recebida, comissão por regularizar, ações.
- Em desktop, apresentação compacta em tabela; em iPhone, cartões responsivos com as ações essenciais acessíveis sem hover.
- Na ficha da viagem: separadores **Resumo | Serviços | Pagamentos | Documentos | Tarefas | Comunicações e Alertas | Comissão**.
- Manter ligações rápidas à ficha do cliente, à proposta e à origem comercial, sem duplicar dados.

### Pedidos e propostas
- Kanban comercial continua central para oportunidades **antes da reserva**, com follow-ups, versões do orçamento, notificações e passagem à viagem quando houver aceitação.
- Não transformar automaticamente um orçamento enviado em reserva confirmada. Manter confirmação manual da aceitação por escrito e histórico da versão aceite.

## 4. Email e alertas — critérios de regressão obrigatórios (P1)

Os fluxos abaixo têm de continuar acessíveis e funcionar da nova ficha:
1. **Pedido / preparação** — receber e acompanhar o pedido, próximo contacto.
2. **Pré-contratação** — gerar e rever email com orçamento, FIN, condições gerais e anexos; enviar pelo mecanismo de email do CRM; atualizar estado e guardar histórico.
3. **Aceitação** — sincronizar/ver resposta, confirmação manual da aceitação; criar/ligar viagem sem duplicados.
4. **Pós-contratação** — confirmar a reserva e enviar documentação contratual/da viagem com revisão.
5. **Pré-viagem / durante / pós-viagem** — vouchers, check-in, informações práticas, agradecimento e feedback, com templates adequados.

Condições:
- **Não enviar automaticamente** comunicações com efeitos contratuais/financeiros. Preparação e lembretes podem ser automáticos; envio exige revisão e confirmação explícita.
- Preservar modelos editáveis, idiomas PT/EN/FR, anexos do Google Drive/dispositivo e seleção de destinatários.
- Preservar o mecanismo de email existente (Roundcube / integração já configurada); não trocar serviço sem análise e autorização.
- Guardar estado de **rascunho / enviado / erro / resposta** quando suportado; não afirmar envio concluído antes da confirmação.
- Alertas: follow-up, validade da proposta, documentos vencidos/a vencer, prestações, check-in, tarefas associadas ao voo e viagem, comissões em falta. Alertas de check-in preservam os prazos atuais; melhorias à precisão temporal (fuso e hora do voo) devem ser propostas e testadas separadamente.
- Fazer testes de regressão automatizados e validação manual assistida, sem emails reais de teste.

## 5. Serviços de viagem e informação financeira (P1/P2)

Já existem serviços ligados à viagem e tipos como voo, alojamento, atividade, transfer e seguro. Expandir com cuidado o modelo para permitir, **por serviço**:
- Operador/fornecedor, referência/localizador, datas, descrição e estado.
- Preço de venda, preço líquido/custo (se conhecido), moeda e fundamento/origem do valor.
- Comissão contratada/estimada associada ao serviço quando conhecida, metodologia de cálculo e eventual ajuste/desconto, sem somar duas vezes ao total geral.
- Regras explícitas para valores por pessoa vs por reserva e para tarifas com comissão incluída vs markup, pois não são equivalentes.
- OCR/importação: identificar e propor o preenchimento dos serviços a partir do orçamento; exigir revisão antes de gravar; marcar campos ausentes, ambíguos ou não extraídos; nunca inventar custos/preços.
- Permitir serviços adicionais sem destruir associação às propostas ou aos viajantes. Garantir segurança de alterações e manutenção do histórico.

Propor claramente como se obtém o total da viagem e como se concilia com o valor contratado, evitando efeitos indiretos da calculadora de comissão sobre o total da reserva sem confirmação.

## 6. NOVO: Controlo e conciliação das comissões (P1)

A calculadora existente estima a comissão; o módulo financeiro atual regista comissão recebida e saldo. O novo âmbito é dar visibilidade distinta a:
- **Comissão prevista**: estimativa calculada segundo a regra aplicável e inputs aprovados.
- **Comissão confirmada pela agência**: valor que a agência declara reconhecer/dever, manualmente ou por documento importado.
- **Comissão recebida**: soma dos movimentos efetivamente confirmados, líquidos de estornos/devoluções.
- **Por regularizar**: diferença entre prevista, confirmada e recebida, com discriminação do motivo e sem tratar disputas como pagamentos.
- **Divergência de cálculo**: comissão prevista menos confirmada; pode existir mesmo quando a confirmada já está totalmente paga.

Exemplo fictício: prevista 240 €, confirmada 220 €, recebida 180 € → diferença prevista/confirmada 20 €, confirmado por receber 40 €, total face ao previsto 60 €. Não confundir estes montantes.

### Funcionalidades propostas
- Vista consolidada filtrável por período, viagem, cliente, operador, localizador, estado, por receber e divergências; drill-down até ao serviço e ao documento de origem.
- Estados **por calcular / a confirmar / confirmada / parcialmente recebida / recebida / divergência / regularizada**, com transições auditáveis.
- Registo da data e referência de confirmação pela agência; origem/evidência (ex.: PDF ou Excel associado no Drive); notas e motivo da diferença.
- Pagamentos parciais, estornos e correções explícitas; preservar imutabilidade de movimentos já conciliados, preferindo movimento corretivo e histórico em vez de apagar sem rasto.
- Possibilidade futura de importar mapas de comissões (PDF/CSV/XLSX) e comparar registos por localizador + operador + datas + montante. Começar por uma proposta de parser e revisão humana: **nunca considerar match incerto como confirmado**.
- Alertas de comissões em aberto ou com discrepância; evitar notificações repetitivas e falsos positivos.
- Não implementar levantamentos, pedidos à agência, recibos nem ações financeiras reais.

**Moedas:** a calculadora atual é em EUR; não misturar moedas na soma global. Separar por moeda ou explicitar conversão com taxa/dia/fonte; sem conversões fictícias.

## 7. Alterações na ficha financeira e documentos (P2)

- Pagamentos do cliente: manter preço total, sinal, prestações, prazos, reembolsos, saldo, comprovativos e responsável pela confirmação.
- Organizar ações de adicionar/editar pagamento de forma simples e utilizável em mobile.
- Mostrar a ficha financeira a partir da viagem e a lista agregada a partir de Comissões ou alertas.
- Documentos do cliente e viagem: manter OCR, Drive, checklist documental e validade.
- Histórico auditável de mudanças relevantes, especialmente valores financeiros e emails enviados.

## 8. Segurança e integridade

- Supabase: migrações aditivas e compatíveis, constraints de montantes, transações para alterações relacionadas, permissões/RLS auditadas, prevenção de duplicados e conflitos de versão.
- Proteger preços de custo, comissões e documentos pessoais: não expor ao formulário público ou a páginas externas.
- Não guardar ficheiros pessoais reais no Git; usar fixtures artificiais. Não criar contas/serviços pagos ou alterar alojamento sem decisão.
- Em ficheiros OCR, manter revisão humana, não atribuir alta confiança a campos ilegíveis.
- Não quebrar a origem e a integridade dos dados existentes, nem apagar registos financeiros para simplificar a migração.
- Manter identidade Travel Frontiers + Gupitravel onde legal/comercialmente necessário.

## 9. Plano de entrega recomendado (PRs incrementais)

**PR 1 — UX/navegação e viagem:** novos menus; dashboard de ação; lista de viagens responsiva; ficha com separadores e atalhos. **Sem alterar contratos de API desnecessariamente.** Regressão de todos os fluxos existentes.

**PR 2 — Comunicações e alertas na ficha:** reunir email/alertas da viagem; preservar envios pré/pós-contratação, anexos, templates, histórico, sincronização de respostas e calendário. Confirmar no mobile. Testes com transporte email simulado.

**PR 3 — Finanças por serviço:** schema aditivo, forms, cálculo de totais, importação/revisão, validadores, rastreio de origem, compatibilidade com propostas e importação de PDF.

**PR 4 — Conciliação de comissões:** schema/serviço/API, vista global, confirmações, pagamentos parciais, divergências, evidências, filtros e alertas. Regra `tf-commission-v2` intacta. Ficheiros de importação de extratos só depois de definições/testes com amostras anonimizadas.

Em cada PR: testes unitários, testes de API/SQL onde se justificar, build, validação de acessibilidade e comparação visual desktop/iPhone. Preferir UI simples e feedback explícito de sucesso/erro.

## 10. Critérios de aceitação finais

- [ ] O agente comprova que não desapareceu nenhuma função da navegação antiga; existe rota clara ou migração UX para cada uma.
- [ ] Do pedido à proposta enviada, resposta recebida, aceitação manual e viagem confirmada, o fluxo funciona sem copiar dados manualmente nem duplicar viagens.
- [ ] Emails pré e pós-contratação podem ser compostos, revistos e enviados pelo CRM com anexos, e o histórico/repostas permanece acessível.
- [ ] Alertas de tarefas, documentos, check-in, pagamentos e seguimentos aparecem e abrem o contexto adequado.
- [ ] OCR de documentos de identidade e importação de orçamentos continuam operacionais e exigem revisão dos dados lidos.
- [ ] Viajar com múltiplos serviços e múltiplos viajantes mantém relações e histórico consistentes.
- [ ] Comissões prevista, confirmada e recebida são exibidas **separadamente**; pagamento parcial, divergência, estorno e regularização funcionam corretamente.
- [ ] Não existe qualquer fluxo de levantamento de comissões ou emissão fiscal.
- [ ] Dados antigos e calculadoras atuais continuam corretos; testes incluem casos de autoconsumo e cessão.
- [ ] Interface utilizável no iPhone (não depender de hover) e em desktop; temas claro/escuro preservados.
- [ ] Nenhum envio real, deploy em produção ou alteração destrutiva ocorre sem autorização.

## 11. Evidência e referências no repositório

Consultar, pelo menos:
- `src/components/crm-studio-tool.tsx` — navegação, dashboard, pedidos, viagens e vista principal.
- `src/components/crm-payments.tsx`, `src/lib/crm-finance.ts`, `src/lib/commission.ts` — pagamentos e regra de comissão.
- `src/components/crm-proposals.tsx` — versões de proposta e fluxo comercial.
- `src/components/crm-email-panel.tsx`, `src/lib/crm-email-templates.ts` — comunicação.
- `src/components/crm-document-scanner.tsx`, `src/lib/crm-trip-pdf.ts` — OCR e orçamentos.
- `src/lib/crm-trip-services.ts` e migrações `supabase/migrations/` — modelo de serviços/financeiro.
- `GUIA_UTILIZADOR_CRM.md` — fluxos já disponibilizados.
- `CRM_DELIVERY_STATUS.md` — estado declarado; verificar sempre contra o código atualizado.

## 12. Entrega inicial que espero do agente

Antes de tocar em produção: apresentar uma tabela **Existente / Alterar / Criar / Preservar / Risco**, desenho simples da navegação e ficha de viagem, diagrama dos estados de comissão e plano de PRs com testes. Depois trabalhar por etapas e produzir links para os PRs. Distinguir claramente **implementado**, **testado localmente** e **validado em produção**.
