# Travel Frontiers CRM — configuração e manutenção

Atualizado em **20 de novembro de 2026**. O CRM está publicado em `https://promo.travelfrontiers.pt/admin/crm`, dentro do Studio existente. O [guia de utilização](GUIA_UTILIZADOR_CRM.md) descreve o funcionamento para o utilizador. Este documento reúne a configuração necessária para manter ou instalar o serviço.

## 1. Supabase

1. Criar um projeto Supabase no plano Free, sem adicionar recursos pagos.
2. Numa instalação nova, aplicar os ficheiros de `supabase/migrations/` por ordem do nome. Numa instalação existente, aplicar apenas os que faltam. A migração mais recente é `202611180029_crm_manual_commission.sql`. As migrações 028 e 029 foram aplicadas em produção antes da publicação do respetivo código.
3. Configurar no ambiente do servidor a Project URL e a chave de serviço usadas por `supabaseAdminConfig` em `src/lib/crm-api.ts`. As variáveis sensíveis são geridas no ambiente de execução.
4. `SUPABASE_SECRET_KEY` fica apenas no servidor. As rotas CRM só usam esta chave depois de validar a sessão Google do Studio; nunca a colocar no browser nem no GitHub.
5. A submissão do formulário passa pelo servidor. A escrita pública direta na tabela de pedidos foi bloqueada. A API aplica limitação de pedidos e controlo de duplicação.
6. Confirmar no painel de utilização que base de dados, armazenamento e tráfego estão dentro das quotas Free. Não ativar upgrade automático.

## 2. Notificação Roundcube/SMTP

A notificação usa SMTP do email empresarial, não automação de cliques ou aceitação. Configurar no ambiente de execução:

- `CRM_SMTP_HOST`, `CRM_SMTP_PORT` e `CRM_SMTP_SECURE` conforme os dados fornecidos pela GupiTravel;
- `CRM_SMTP_USER=tiago.ferreira@gupitravel.pt` e a respetiva palavra-passe/app password como segredo; a notificação automática é enviada apenas para ti, sem CC para a agência;
- `CRM_NOTIFICATION_TO=tiago.ferreira@gupitravel.pt`;

O formulário envia a submissão ao servidor. Quando o SMTP falha, o pedido permanece guardado no Supabase e a resposta indica que a notificação está pendente. Os pedidos podem ser consultados no CRM.

O painel de email usa SMTP para envio e IMAP para sincronizar respostas do Roundcube. A ligação é verificada no próprio painel. A assinatura, os links padrão da FIN e das condições e o modelo pré-contratual devem ser conferidos no rascunho. A cópia para `geral@gupitravel.pt` depende da seleção explícita no envio.

## 3. Admin e CRM

- O acesso mantém-se numa única área Admin (`/admin`), usando o login Google existente do Sanity Studio, sem segundo login no CRM.
- Utilizador autorizado para o CRM: `tf.travel.frontiers@gmail.com`. As rotas confirmam este email através do endpoint autenticado `/users/me` do projeto Sanity antes de consultar ou alterar dados.
- No Studio, `CRM` abre o pipeline e `Promoções` continua a abrir os documentos de promoção. A calculadora e restantes ferramentas existentes mantêm-se.
- O browser envia o token de sessão do Studio ao servidor. A chave Supabase de serviço nunca sai do servidor.
- O CRM não usa Supabase Auth nesta fase. Não criar registos de utilizador Supabase para aceder à ferramenta.
- O pipeline permite pesquisar pedidos, rever dados, alterar a fase comercial, guardar notas internas, agendar o próximo contacto e registar o motivo quando um pedido é perdido. Seguimentos aparecem no Dashboard e no calendário.
- O Dashboard é a página inicial do CRM e mostra contagens de pedidos e viagens, distribuição do pipeline, pedidos recentes, tarefas/marcos próximos, partidas e alertas de validade documental.
- O menu principal tem **Início**, **Pedidos**, **Viagens**, **Clientes** e **Comissões**. As ferramentas incluem calendário, propostas, modelos de email, histórico, templates e checklists, duplicados e pagamentos. Em **Viagens**, o Kanban abre recolhido e permite expandir cada cartão ou todos. O topo tem atalhos Airmet, Cotur e Gupi, além do botão de copiar IBAN.
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

## 6. Manutenção e verificações

- A ligação Google Drive permite guardar ficheiros e escolher documentos existentes nas fichas. O consentimento Google é solicitado no uso da integração.
- A proteção do formulário é aplicada no servidor. Revê as quotas Free e os limites da aplicação ao aumentar o volume de utilização.
- Confirma a política de retenção, a privacidade e a recuperação da base com a agência. A conclusão dessas decisões exige validação própria.
- Depois de uma alteração, verifica o build de produção, o acesso ao CRM e o percurso afetado.
- As baterias SQL em `supabase/tests/` usam dados sintéticos dentro de transações terminadas por `rollback`. Os testes JavaScript estão em `scripts/check-*.cjs`.

### Fórmula e ajustes de comissão

- `src/lib/commission.ts` é a fórmula partilhada pela calculadora e pela API. A versão atual é `tf-commission-v3`, com consumo próprio calculado pelo net × 101%.
- A migração `202611170028_crm_own_consumption_markup.sql` permite guardar a versão atual e mantém a leitura dos cálculos anteriores. O utilizador revê e grava novamente os cálculos antigos.
- A migração `202611180029_crm_manual_commission.sql` acrescenta o valor manual, o motivo e a função `crm_set_manual_commission`. A função valida versão, montante e motivo e atualiza a previsão sob bloqueio transacional.
- A comissão manual substitui a estimativa da calculadora antes da dedução dos descontos a clientes. As vistas financeiras reutilizam esse valor no Kanban, na carteira e na reconciliação. O cálculo guardado permanece disponível para reposição.
- O teste `supabase/tests/crm_manual_commission_regression.sql` cobre gravação sem calculadora, conflito de versões, motivo, valor zero, descontos e reposição. Foi executado em produção com dados sintéticos e rollback.
- O saldo por pagar sem prazo é calculado a partir do saldo real menos o valor ainda por pagar das prestações. Reservas liquidadas dispensam a criação de um plano.

## Registo manual de clientes e viagens

- A secção **Clientes** permite criar um cliente sem inventar um pedido no pipeline. Nome é obrigatório; email, telefone, idioma e notas internas são editáveis no registo inicial.
- A secção **Viagens e checklist** permite criar uma viagem diretamente para qualquer cliente. Cada viagem recebe a checklist mínima editável.
- Um cliente pode ter várias viagens. Pedidos do formulário continuam no pipeline e, ao converter um pedido ganho, o CRM associa-o ao cliente correspondente pelo email.
- A migração `supabase/migrations/202611080002_crm_clients_and_manual_trips.sql` cria a tabela de clientes, associa os registos existentes e permite viagens sem pedido associado. Foi aplicada no projeto Supabase Travel Frontiers CRM.
- A migração `supabase/migrations/202611080003_crm_client_documents.sql` foi aplicada no projeto Supabase Travel Frontiers CRM; ativa o registo protegido de tipo, número/ID e validade, sem carregar imagens/cópias do documento.
- As migrações `202611080004_crm_trip_import_fields.sql` (campos de viagem e serviços/reservas) e `202611080005_crm_lead_followups.sql` (próximo contacto e motivo de perda) foram também aplicadas.

