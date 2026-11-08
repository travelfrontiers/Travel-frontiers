# Revisão do CRM Travel Frontiers
Data: 8 de novembro de 2026

## Âmbito e evidência
Revisão do componente CRM, de todas as rotas em src/app/api/crm, do leitor de PDF, das migrações 001–009 e do plano funcional. Identidade visual comparada com style.css e com os logótipos existentes.
A revisão é de código e de testes isolados com dados sintéticos. Não é uma certificação de segurança nem uma validação integral com dados reais.
Produção: /admin/crm apresentou o login do Sanity; /api/crm/clients devolveu “Acesso não autorizado” sem sessão. A ficha autenticada não foi percorrida neste navegador, que não tinha sessão iniciada.

## Corrigido nesta revisão
- Concluir um check-in automático deixava o cliente reenviar título e prazo e convertia due_at para as 12h UTC. A API agora só altera completed nas tarefas ligadas a voos.
- A API permitia eliminar diretamente lembretes automáticos, apesar de a interface os apresentar como geridos pelo voo. Agora devolve 409; o voo continua a gerir o lembrete.
- Datas de tarefas só tinham verificação de formato; datas impossíveis agora são rejeitadas.
- Criar, editar ou apagar um serviço atualizava apenas a lista de serviços local. A checklist e os alertas podiam ficar desatualizados até recarregar. Agora os dados das viagens são novamente lidos após a alteração.
- Viagens canceladas continuavam na agenda. Agora são excluídas dessa agenda.
- O leitor de PDFs reconhecia termos de meses EN/FR na expressão regular, mas o mapa de conversão só cobria português. Foram acrescentados os meses EN/FR, o formato sem “de” e os rótulos Départ/Retour.

## Visual implementado
- Alternância claro/escuro com preferência guardada no navegador e preferência inicial do sistema.
- Logótipo existente, laranja/dourado e cabeçalho de destaque em carvão, alinhados com Travel Frontiers.
- Superfícies, formulários, cartões, modais e cores de estado adaptados ao modo escuro, com estilos limitados ao CRM.
- Foco visível por teclado e respeito pela preferência de movimento reduzido.

## Correções ainda necessárias, por prioridade
### Alta — lembretes 48 horas exatas
Evidência: crm_trip_services.starts_on é date; o trigger crm_sync_flight_checkin_task subtrai dois dias à meia-noite em Europe/Lisbon.
Impacto: o prazo não corresponde a 48 horas antes da hora real de cada voo. O título atual pode sugerir maior precisão do que os dados permitem.
Correção: guardar partida com hora e fuso do aeroporto, preservar esses dados na importação e calcular due_at em UTC. Depois validar voos com escalas e mudanças de fuso/horário de verão. Também distinguir um aviso no dashboard de uma notificação enviada; atualmente é uma tarefa, não um envio agendado.

### Alta — gravação da viagem em duas operações
Evidência: PATCH /api/crm/trips/[id] grava os campos e só depois chama crm_set_trip_clients.
Impacto: falhar a segunda chamada deixa a viagem parcialmente atualizada.
Correção: uma função PostgreSQL transacional deve validar e guardar campos e clientes em conjunto.

### Alta — formulário público e abuso
Evidência: há honeypot, mas não há limitação de frequência no handler público; anon tem permissão de INSERT em crm_leads através de uma política RLS.
Impacto: é possível gerar submissões em massa e consumir armazenamento/envios de email, inclusive contornando o formulário.
Correção: decidir uma proteção gratuita compatível com o alojamento; concentrar a escrita no servidor, rever os privilégios públicos e acrescentar deduplicação/idempotência sem bloquear pedidos legítimos.

### Alta — OCR de PDFs digitalizados em produção
Evidência: OCR depende de executáveis pdftoppm/tesseract, não fornecidos por package.json nem configurados no repositório para a Vercel.
Impacto: PDFs com imagem podem não ser lidos no alojamento atual. A presença desses programas no Mac não os disponibiliza à Vercel.
Correção: disponibilizar um processamento local autorizado ou um runtime com OCR, com estados de erro e fila observável. Não ativar serviços pagos sem nova decisão.

### Alta — documento de cliente versionado
Evidência: a árvore Git atual contém ICG-132625.pdf, e o plano já regista este problema.
Correção: avaliar o conteúdo e o acesso ao repositório; remover o ficheiro e, se necessário, limpar o histórico num procedimento controlado. Não foi apagado ou reescrito histórico nesta tarefa.

### Média — documentação incompleta
Evidência: documentos têm POST/PATCH; não há DELETE individual. A ficha de cliente não permite remover só um documento.
Correção: adicionar remoção individual com confirmação, sem obrigar a apagar o cliente.

### Média — limites de leitura
Evidência: as rotas GET consultam tabelas completas sem paginação explícita.
Impacto: ao ultrapassar o limite de linhas de resposta configurado no Supabase, cartões e totais podem ficar incompletos; o browser também carrega toda a documentação.
Correção: paginação, filtros no servidor e contagens agregadas para o dashboard.

### Média — eliminação de cliente e histórico
Evidência: a eliminação anonimiza leads associados e remove a ficha/documentos; viagens e notas operacionais são preservadas.
Impacto: notas livres e detalhes de serviços podem continuar a conter nomes ou outros dados pessoais. Não há auditoria de alterações nem recuperação pelo CRM.
Correção: desenhar retenção, exportação e tratamento das notas antes de prometer eliminação integral de dados pessoais; decidir se deve haver arquivo/recuperação. A eliminação atual é definitiva e requer confirmação na interface.

### Média — qualidade e revisão de extração PDF
A extração continua heurística. Não existem pontuações de confiança nem comparação lado a lado com o PDF; formatos novos, totais alternativos, moedas e condições podem exigir correção humana.
Correção: conjunto representativo de amostras sintéticas/anonimizadas por operador e indicadores de campos ambíguos. Manter a revisão antes de criar a viagem.

## Funcionalidades do plano ainda pendentes
- Integração Google Drive: arquivo de PDFs/documentos, pastas e ligações com permissões restritas.
- Histórico de alterações e atividade por cliente/oportunidade.
- Propostas/versionamento, pagamentos e prazos operacionais mais completos.
- Email/IMAP e templates pré/pós-orçamento e pré/pós-viagem; fora desta revisão. A notificação interna do formulário é um fluxo diferente.
- Calendário atual é uma lista cronológica; não existe grelha mensal/semanal interativa.
- Recordações/notificações externas agendadas: a checklist não equivale a um serviço de envio.

## Verificações executadas
- Teste isolado do handler de tarefas com dependências de rede simuladas: completar tarefa automática só grava completed; DELETE de tarefa automática devolve 409; data 31/02 é rejeitada.
- Extração de datas naturais de partida/regresso com amostras sintéticas PT, EN e FR: resultados esperados.
- Releitura do fluxo dos seis orçamentos após a correção anterior.
- Verificação sem sessão em produção: login exigido e dados de clientes recusados.
- Não foram criados clientes, pedidos, viagens, documentos nem emails reais durante estes testes.
- Fluxos autenticados, permissões Drive, execução real do OCR na Vercel e precisão de 48h com fusos não estão validados integralmente.
