# Travel Frontiers CRM — setup inicial

Este branch contém o formulário público e uma ferramenta de CRM dentro do Studio existente em `/admin`. O CRM ainda não está pronto para produção: falta criar/configurar o projeto Supabase Free, aplicar a migração, configurar SMTP e proteção contra abuso.

## 1. Supabase

1. Criar um projeto Supabase no plano Free, sem adicionar recursos pagos.
2. No SQL Editor do projeto, aplicar `supabase/migrations/202611080001_crm_foundation.sql`.
3. Em **Settings → API Keys**, copiar a Project URL, a chave `sb_publishable_...` e a chave `sb_secret_...` para as variáveis indicadas em `.env.example`.
4. `SUPABASE_SECRET_KEY` fica apenas no servidor. As rotas CRM só usam esta chave depois de validar a sessão Google do Studio; nunca a colocar no browser nem no GitHub.
5. O formulário público usa a chave anon e a política RLS permite apenas criar leads; não permite ler nem alterar os registos.
6. Confirmar no painel de utilização que base de dados, armazenamento e tráfego estão dentro das quotas Free. Não ativar upgrade automático.

## 2. Notificação Roundcube/SMTP

A notificação usa SMTP do email empresarial, não automação de cliques ou aceitação. Configurar no ambiente de execução:

- `CRM_SMTP_HOST`, `CRM_SMTP_PORT` e `CRM_SMTP_SECURE` conforme os dados fornecidos pela GupiTravel;
- `CRM_SMTP_USER=tiago.ferreira@gupitravel.pt` e a respetiva palavra-passe/app password como segredo; a notificação automática é enviada apenas para ti, sem CC para a agência;
- `CRM_NOTIFICATION_TO=tiago.ferreira@gupitravel.pt`;

O formulário não precisa de credenciais SMTP no browser. Quando o SMTP falha, o pedido permanece guardado no Supabase e a resposta indica que a notificação está pendente; até existir painel CRM, o pedido pode ser consultado no Supabase Studio.

## 3. Admin e CRM

- O acesso mantém-se numa única área Admin (`/admin`), usando o login Google existente do Sanity Studio, sem segundo login no CRM.
- Utilizador autorizado para o CRM: `tf.travel.frontiers@gmail.com`. As rotas confirmam este email através do endpoint autenticado `/users/me` do projeto Sanity antes de consultar ou alterar dados.
- No Studio, `CRM` abre o pipeline e `Promoções` continua a abrir os documentos de promoção. A calculadora e restantes ferramentas existentes mantêm-se.
- O browser envia o token de sessão do Studio ao servidor. A chave Supabase de serviço nunca sai do servidor.
- O CRM não usa Supabase Auth nesta fase. Não criar registos de utilizador Supabase para aceder à ferramenta.
- O pipeline permite pesquisar pedidos, rever dados, alterar a fase comercial, guardar notas internas, agendar o próximo contacto e registar o motivo quando um pedido é perdido. Seguimentos aparecem no Dashboard e no calendário.
- O Dashboard é a página inicial do CRM e mostra contagens de pedidos e viagens, distribuição do pipeline, pedidos recentes, tarefas/marcos próximos, partidas e alertas de validade documental.
- O CRM tem duas vistas principais: **Comercial** (resumo, Kanban e clientes) e **Operacional** (viagens/checklist e calendário). O **Kanban comercial** tem uma coluna por fase; podes mover pedidos arrastando os cartões ou escolhendo a fase no próprio cartão.
- Pedidos marcados como “Ganho” podem ser convertidos uma única vez em viagem operacional.
- Cada viagem começa com três tarefas editáveis: enviar email com a mensagem para o quarto, fazer check-in e perguntar se está tudo bem. Podes alterar, apagar, adicionar e definir prazos.
- A vista Calendário apresenta partidas, regressos e prazos das tarefas.
- Na secção **Clientes**, podes registar documentos com tipo, número/ID e data de validade; podes atualizar estes dados. O dashboard do pipeline alerta sobre documentos vencidos ou que expiram nos próximos 30 dias. Os alertas não mostram o número/ID.

## 4. Endpoints e interface

- Formulário público: `/{lang}/pedido` (por exemplo, `/pt/pedido`).
- API de submissão: `POST /api/trip-requests`.
- Idiomas disponíveis: português, inglês e francês; o idioma selecionado fica no registo do pedido e é incluído na notificação.
- Pessoas: selecionar adultos e crianças; por defeito são 2 adultos e aparecem seletores de idade obrigatórios apenas para as crianças indicadas.
- Orçamento aproximado por pessoa: escolha obrigatória entre seis opções traduzidas.
- Campo de detalhes com o rótulo “Mais detalhes” e a frase de orientação traduzida.
- Acesso ao formulário pelo botão das páginas de promoção; não foi acrescentada opção ao menu público principal.
- Gestão de leads, viagens e checklist disponível na ferramenta CRM dentro do Studio existente.

## 5. Orçamentos PDF e criação de viagens

- O objetivo da leitura dos orçamentos é extrair os dados da proposta/reserva para preencher a viagem e a checklist, associando-os ao cliente ou pedido correto. Não é apenas guardar o PDF.
- A extração deve ficar em revisão até confirmares os campos; só depois da tua confirmação cria ou atualiza a viagem.
- A leitura de PDF sugere operador, referência, destino, datas, adultos/crianças, preço/moeda, voos e alojamentos quando consegue identificá-los; os segmentos são revistos antes de serem guardados na viagem. O parser reconhece blocos de itinerário com companhia, número de voo, aeroportos e datas mesmo quando estes aparecem em linhas separadas. Continua heurístico e precisa de validação com documentos de operadores diferentes; preço, condições e campos ambíguos devem ser revistos.

## 6. Antes de produção

- As migrações `202611080004_crm_trip_import_fields.sql` e `202611080005_crm_lead_followups.sql` foram aplicadas no Supabase; validar PDF e extração com amostras aprovadas sem inserir dados pessoais no Git.
- Ligar o Google Drive com OAuth autorizado para arquivo de PDFs/documentos. A aplicação ainda não faz upload nem guarda links no Drive.
- Adicionar proteção robusta contra spam e limitação de pedidos antes de divulgar o formulário.
- Definir política de retenção e texto de privacidade final com a agência.
- Configurar domínio/ambiente e confirmar que a notificação de teste chega apenas à caixa de Tiago.
- Definir exportação/recuperação da base de dados antes de guardar dados reais de forma permanente.

## Registo manual de clientes e viagens

- A secção **Clientes** permite criar um cliente sem inventar um pedido no pipeline. Nome é obrigatório; email, telefone, idioma e notas internas são editáveis no registo inicial.
- A secção **Viagens e checklist** permite criar uma viagem diretamente para qualquer cliente. Cada viagem recebe a checklist mínima editável.
- Um cliente pode ter várias viagens. Pedidos do formulário continuam no pipeline e, ao converter um pedido ganho, o CRM associa-o ao cliente correspondente pelo email.
- A migração `supabase/migrations/202611080002_crm_clients_and_manual_trips.sql` cria a tabela de clientes, associa os registos existentes e permite viagens sem pedido associado. Foi aplicada no projeto Supabase Travel Frontiers CRM.
- A migração `supabase/migrations/202611080003_crm_client_documents.sql` foi aplicada no projeto Supabase Travel Frontiers CRM; ativa o registo protegido de tipo, número/ID e validade, sem carregar imagens/cópias do documento.
- As migrações `202611080004_crm_trip_import_fields.sql` (campos de viagem e serviços/reservas) e `202611080005_crm_lead_followups.sql` (próximo contacto e motivo de perda) foram também aplicadas.

