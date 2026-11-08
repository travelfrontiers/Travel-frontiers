# Estado funcional do CRM — 8 de novembro de 2026

## Entrega operacional desta fase
- Gravação atómica de viagem e clientes na função crm_update_trip; falhar qualquer validação/associação reverte toda a transação.
- Eliminação individual dos registos de documentação do cliente (tipo, ID e validade), protegida pelo acesso Admin e confirmação.
- Formulário com até 5 pedidos/hora e 15/dia por ligação e 250/dia no total; repetição exata até 10 minutos não cria outro pedido nem outro email. IP guardado apenas como HMAC com segredo do servidor. Estes limites não substituem proteção completa contra ataques distribuídos.
- INSERT público em crm_leads removido depois da nova rota estar publicada. A escrita fica no servidor, através da função protegida.
- Lembretes de check-in: tarefa dois dias antes, dashboard e email diário às 09h UTC (a execução do plano atual pode ocorrer dentro dessa hora). Só tarefas por concluir, voos ainda não passados e viagens ativas. Lease para evitar envios simultâneos; marcador de envio evita repetições normais. Uma falha após o SMTP aceitar e antes da confirmação na base pode causar repetição.
- Drive: guardar PDF/JPG/PNG até 20 MB por ficheiro, abrir ficheiros associados e retirar ligações, em clientes e viagens. O limite de 20 MB é da aplicação e não compra espaço adicional no Google Drive. A importação de texto PDF mantém o seu limite próprio de 4 MB.
- Cliente OAuth criado no projeto Google existente; Drive API já ativa, apenas conta autorizada e domínio de produção. O primeiro envio pede consentimento Google. Como usa acesso temporário no navegador, poderá pedir nova autorização quando expirar. Sem armazenamento de tokens de acesso/refresh no CRM.
- Não foi ativada faturação, OCR, NAS nem modificado o PDF existente no Git.

## Matriz face ao plano inicial
| Área | Estado | O que falta |
|---|---|---|
| Admin Google único, CRM/Promoções | Implementado | Melhorias de navegação e sessão conforme uso real |
| Formulário PT/EN/FR | Implementado para campos atuais | Campos candidatos adicionais do plano (aeroporto/origem, duração, alojamento/regime e regras por tipo de viagem) continuam por fechar/implementar |
| Clientes e documentação | Implementado | Exportação, política de retenção, deteção/fusão assistida de duplicados e histórico de atividade |
| Leads e Kanban comercial | Implementado básico | Filtros/ordenação avançados, histórico de alterações, proposta/versionamento ligado à oportunidade e próximos passos mais estruturados |
| Viagens operacionais | Implementado básico | Modelo próprio para pagamentos/prazos/condições e associação mais completa entre proposta, reserva e versão final da viagem |
| Tarefas/checklists | Implementado básico | Templates reutilizáveis editáveis por tipo de viagem e automatismos pré/durante/pós-viagem além do check-in |
| Dashboard | Implementado básico e visual | Indicadores comerciais baseados em propostas/valores reais, filtros e acessos diretos com contexto da ficha |
| Calendário | Lista cronológica | Grelha mensal/semanal, filtros e navegação direta para a ficha/tarefa |
| Importação PDF | Assistida com revisão humana | Revisão lado a lado; indicadores de campos ausentes/ambíguos; cobertura e persistência estruturada de regime, condições, inclusões/exclusões, duração, validade e segmentos completos |
| Google Drive | Integração por ficha | Associar ficheiros já existentes via Picker e gerir versões; o envio atual cria ficheiros novos |
| Emails | Notificação do formulário e lembretes internos | IMAP, histórico, templates editáveis aprovados, envio assistido e comunicações pré/pós-orçamento e pré/pós-viagem |
| Histórico e dados | Parcial | Auditoria de alterações, exportação/retificação/eliminação integral de dados pessoais em notas livres, retenção e paginação/agregações do servidor |

## Critérios de conclusão ainda não atingidos
A existência de cartões, Kanban e formulários não equivale a todo o CRM planeado. Ainda faltam as ligações entre propostas, versões, comunicação, histórico e operação com menos trabalho manual. A aceitação do cliente continua por resposta manual ao email, conforme decidido.

## Ordem sugerida para concluir o CRM
1. Propostas e ficha de oportunidade completas: versões do orçamento, ligação a cliente/viagem/Drive, valores, validade, condições e seguimento.
2. Ficha de viagem com templates/checklists reutilizáveis e automatismos para os marcos acordados.
3. Revisão do PDF lado a lado e cobertura dos campos comuns que ainda faltam.
4. Calendário mensal/semanal e filtros com navegação para a ficha certa.
5. Histórico de atividade, pesquisa/filtros e tratamento de duplicados.
6. Emails/IMAP e templates aprovados, sempre com revisão humana nos envios ao cliente.
7. Exportação, retenção, auditoria e paginação antes de aumentar o volume de dados.

## Validação
Testes isolados dos handlers com dependências de rede simuladas: apenas uma chamada RPC para guardar viagem; cliente inexistente devolve erro sem outro PATCH; remoção de documento/404; resposta 429; hash do IP; duplicado não envia email; pedido novo notifica; cron rejeita cabeçalho forjado; Drive exige sessão CRM. Sem envio real de emails nem dados reais.
A migração 010 foi aplicada e os testes SQL transacionais passaram: gravação atómica, associações, eliminação individual, metadados Drive, deduplicação, limite horário, lease de lembretes e reagendamento de voo. Todos os dados sintéticos foram revertidos. O build de preview do código foi concluído com estado READY. A migração 011 é aplicada após confirmar a publicação da nova rota em produção. O consentimento Google ocorre na primeira operação do utilizador; não se deve assumir que um upload real foi testado sem esse passo.

Os testes de handlers podem ser repetidos com `node scripts/check-crm-operations.cjs`, com as dependências de desenvolvimento instaladas; usam rede simulada e não enviam emails reais.

## Implementação dos pontos 1, 2, 4 e 5
- Propostas: versões de valor/validade/condições/inclusões/exclusões/notas e documento Drive, ligadas ao pedido, cliente e viagem; concorrência protegida por versão esperada. Aceitação registada manualmente com nota da resposta do cliente. Conversão idempotente para viagem.
- Checklists: templates por tipo de viagem, aplicação manual ou automática; prazos relativos à partida/regresso; tarefas pré/durante/pós. Conclusões, remoções e ajustes manuais são preservados; opção para retomar o automatismo. Check-in mantém as regras e o alerta por email existentes.
- Calendário mensal/semanal: partidas, regressos, tarefas, próximos contactos, validade documental e de propostas; filtros por tipo/cliente/pesquisa/conclusão e abertura da ficha certa.
- Histórico: alterações de clientes, pedidos, propostas, viagens, tarefas, serviços e documentação, e notas manuais por ficha. Captura começa nesta migração; não inventa um histórico anterior. Guarda nomes dos campos alterados e estados, sem cópias de valores pessoais ou número do documento.
- Duplicados: candidatos por nome, email ou telefone normalizado, até 100 pares por consulta. Junção só após revisão de duas fichas, escolha dos dados finais e confirmação explícita; associações são transferidas numa transação.
- Filtros: fase e seguimento de pedidos; idioma/documentação/viagens dos clientes; destino/referência/operador/cliente/estado/tipo/datas de viagens; propostas e histórico com paginação própria.
- Os novos ecrãs respeitam os temas claro/escuro e a identidade Travel Frontiers. Mantém-se o mesmo acesso Admin, sem uma nova conta ou serviço pago.

### Validação desta fase
- Regressões isoladas em `scripts/check-crm-office.cjs`: autorização, validações, conflito de versões, proteção dos lembretes de voo, preservação da hora ao concluir tarefas, alterações manuais, calendário com todos os viajantes e mudança de hora.
- Testes de base de dados em `supabase/tests/crm_office_regression.sql`, sempre com BEGIN/ROLLBACK e dados fictícios: versões, aceitação manual, conversão, checklists, junção de fichas, cascatas e permissões.
- Aplicar a migração 012 antes de publicar as rotas novas. A grelha de calendário usa consultas por intervalo, sem depender da lista de viagens carregada no navegador.

### Restante trabalho do plano
- Ponto 3: revisão PDF lado a lado, identificação de campos ausentes/ambíguos e cobertura estruturada dos campos comuns ainda em falta.
- Emails/IMAP, templates editáveis aprovados e comunicações assistidas pré/pós-orçamento e viagem.
- Pagamentos, parcelas/prazos e condições da reserva como modelo próprio; a validade comercial da proposta não substitui esses prazos.
- Seleção de ficheiros Drive já existentes via Picker; atualmente os ficheiros são enviados pela ficha e podem ser associados à proposta.
- Indicadores financeiros/comerciais avançados no dashboard; exportação, retenção e eliminação integral de dados pessoais em notas.
- Paginação/agregação completa das listas antigas antes de aumentar o volume de dados. Os novos módulos já paginam histórico/propostas e consultam o calendário por intervalo.
