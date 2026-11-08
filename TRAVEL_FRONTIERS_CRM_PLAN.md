# Plano funcional e técnico — Travel Frontiers CRM

> Documento de referência para planear a evolução do CRM Travel Frontiers. Regista decisões partilhadas e propostas ainda sujeitas a validação. A criação deste plano não autoriza alterações à aplicação, integrações reais nem processamento de dados de clientes.

## 1. Objetivo e contexto

Criar, por fases, um CRM próprio para Tiago Ferreira, consultor de viagens com a marca **Travel Frontiers**, integrado na agência **GupiTravel**. O sistema deve apoiar o percurso desde o pedido inicial até ao acompanhamento após a viagem, sem confundir a fase comercial com a operação de uma viagem confirmada.

A interface e os materiais destinados ao cliente devem usar a identidade Travel Frontiers e aproveitar os elementos visuais existentes no repositório. A GupiTravel deve ser identificada como agência de integração quando necessário. O produto deve ser único e profissional; os formulários de referência servem apenas de inspiração, não de modelo a copiar.

## 2. Decisões confirmadas

- Travel Frontiers é a marca própria do consultor Tiago Ferreira, integrado na GupiTravel.
- O formulário de pedido/reserva deve ter imagem e identidade Travel Frontiers, com campos e regras condicionais definidos para o negócio.
- O formulário será desenhado à medida. Referências externas são apenas inspiração.
- O CRM deve acompanhar leads e o pipeline comercial, e as viagens confirmadas devem ter gestão operacional separada da fase comercial.
- Os orçamentos chegam da plataforma e de múltiplos operadores (incluindo Soltour). Os documentos variam, mas pretende-se extrair e normalizar os campos comuns, não criar uma integração exclusiva por operador.
- A extração de orçamentos deve incluir validação humana antes de os dados serem considerados finais ou usados em comunicações.
- A comunicação atual por email mantém-se. Nesta fase não haverá botão, link ou mecanismo automático de aceitação de orçamento: o cliente confirma respondendo manualmente ao email.
- Conta empresarial Roundcube disponível e acesso às configurações sob controlo do utilizador. O utilizador autorizou a integração SMTP/IMAP para o CRM; segredos e parâmetros ainda têm de ser configurados de forma segura.
- Remetente previsto: `tiago.ferreira@gupitravel.pt`; alertas internos de novos pedidos/orçamentos vão apenas para Tiago, sem CC para a agência. Emails enviados aos clientes podem seguir os templates contratuais aprovados pela agência.
- Google Drive será usado para documentos; GitHub para código.
- A arquitetura escolhida é Next.js e Supabase Free, sob condição de não ativar serviços pagos nem incorrer em custos adicionais.
- O CRM será usado apenas pelo Tiago.
- A área Admin deve manter um único acesso Google através do Sanity Studio existente (`tf.travel.frontiers@gmail.com`), com CRM e Promoções como ferramentas na mesma área; não criar um segundo login para o CRM.
- O Mac mini M4 (16 GB/512 GB) está disponível e já executa outros agentes; pode ser considerado para processamento local, respeitando recursos e isolamento. Não implementar backups ou NAS nesta fase.
- A implementação começou num branch separado; a aplicação principal não é alterada até revisão/integração.

## 3. Âmbito funcional proposto

### 3.1 Formulário de pedido/reserva

Criar um formulário próprio com identidade Travel Frontiers, responsivo e acessível. Deve recolher apenas a informação necessária para compreender o pedido e preparar uma proposta.

Campos candidatos (a confirmar): nome e contactos; destino/região ou flexibilidade; datas e flexibilidade; duração; número e idades dos viajantes quando necessário; tipo de viagem/experiências; origem ou aeroporto preferido; alojamento/regime; orçamento indicativo; observações; canal/origem do pedido; consentimentos e informação de privacidade aplicáveis.

As regras condicionais devem revelar apenas perguntas relevantes (por exemplo, idades quando há menores, detalhes de voo quando se pede pacote com voo, preferências de alojamento conforme o tipo de viagem). Deve haver validação de formato e obrigatoriedade, prevenção de submissões inválidas e confirmação clara após envio. Os campos finais, texto legal, retenção, proteção contra spam e comportamento após envio carecem de validação.

### 3.2 CRM, leads e pipeline comercial

Manter um registo por contacto e um ou mais pedidos/oportunidades associados, evitando duplicados quando possível. O pipeline deve permitir estados configuráveis, por exemplo:

O Dashboard do CRM deve ser a página inicial e resumir pedidos em curso e novos, distribuição por fase, pedidos recentes, viagens ativas e próximas partidas, tarefas com prazo e alertas de documentação vencida/a vencer. Os cartões devem abrir a área correspondente para ação; não inventar valores comerciais enquanto o modelo de dados não os suportar.

O pipeline comercial deve estar disponível como quadro Kanban horizontal, com uma coluna por fase. O utilizador pode abrir cada pedido e mudar a fase arrastando o cartão ou usando um controlo acessível dentro do cartão.

1. Novo pedido
2. A qualificar / informação em falta
3. Em pesquisa
4. Orçamento em preparação
5. Orçamento enviado
6. A aguardar resposta
7. Ganho / viagem confirmada
8. Perdido / sem seguimento

Guardar origem, datas de criação e atualização, responsável, notas, próximos passos e histórico de alterações/comunicações. Permitir pesquisa, filtros, ordenação e lembretes de seguimento. Registar motivos de perda de forma estruturada se isso for útil e proporcional. Os estados definitivos e métricas a acompanhar devem ser aprovados antes da construção.

### 3.3 Gestão de viagem confirmada

Após confirmação do cliente, criar ou converter a oportunidade numa viagem operacional ligada ao cliente, preservando o histórico comercial. Esta área deve ter datas, viajantes, destino, reservas/fornecedores, documentos e estado da viagem.

Disponibilizar tarefas e checklists configuráveis (por exemplo, documentos, pagamentos, bilhetes, vouchers e contactos úteis), responsáveis e prazos, mais calendário de marcos e partidas. Os exemplos são categorias a validar; não assumir tarefas obrigatórias universais. A viagem operacional deve ter permissões próprias e evitar expor dados sensíveis em vistas ou notificações desnecessárias.

### 3.4 Orçamentos PDF: ingestão e validação

O objetivo principal é evitar voltar a introduzir manualmente no CRM os dados de uma proposta/reserva e facilitar a criação da viagem operacional a partir do orçamento recebido. O PDF não deve ser tratado apenas como arquivo. Depois da extração e validação humana, os campos confirmados devem preencher a ficha de viagem e a checklist, associados ao cliente/pedido correto. Só criar ou atualizar a viagem após o utilizador rever e confirmar os dados.

Permitir anexar PDFs recebidos da plataforma ou de operadores diversos. Propor um fluxo de extração que:
- guarda o ficheiro original no Google Drive, com ligação e metadados no CRM;
- extrai texto e, quando necessário, aplica OCR a PDFs digitalizados;
- normaliza campos comuns, por exemplo operador/fornecedor, referência, destino, datas, duração, viajantes, voos, alojamento, regime, serviços incluídos/excluídos, preço, moeda, condições, validade e observações;
- associa os dados extraídos à oportunidade correta, com possibilidade de correção;
- prepara uma ficha de viagem preenchida com os dados comuns disponíveis no PDF (cliente, destino, datas, viajantes, referência e outros campos aplicáveis), para revisão e confirmação antes de guardar;
- assinala campos ausentes, ambiguidades e baixa confiança;
- apresenta o PDF e os valores extraídos lado a lado para revisão humana;
- só após aprovação grava/usa os valores normalizados e permite preparar a comunicação ao cliente.

Não assumir que todos os PDFs contêm todos os campos ou têm o mesmo formato. Definir dicionário de dados, regras de confiança, tratamento de tabelas/moedas/impostos, limites de ficheiro e formatos suportados antes da implementação. Não usar extração automatizada como confirmação de preço ou disponibilidade.

### 3.5 Email e modelos de comunicação

Usar Roundcube como interface de email existente e avaliar envio/consulta pelo servidor empresarial via SMTP/IMAP, apenas depois de confirmar suporte, autenticação, limites e autorização da agência. A configuração deve usar segredos protegidos no servidor e nunca expor credenciais no browser ou no repositório.

Identidade pretendida para alertas internos do CRM:
- De: Tiago Ferreira <tiago.ferreira@gupitravel.pt>
- Para: Tiago Ferreira <tiago.ferreira@gupitravel.pt>
- Sem CC para a GupiTravel.

Emails enviados aos clientes seguem os templates pré-contratuais aprovados pela agência, a validar antes de automatizar.

Preparar modelos editáveis para:
- receção do pedido e pedido de dados em falta;
- comunicação pré-orçamento / atualização de pesquisa;
- envio do orçamento, com instrução explícita de aceitação por resposta manual;
- seguimento após envio;
- confirmação da viagem;
- comunicações pré-viagem (documentos, prazos, lembretes e informação útil);
- acompanhamento durante a viagem, se aplicável;
- agradecimento e acompanhamento pós-viagem.

Modelos devem aceitar personalização, revisão antes de envio, registo do envio e associação ao cliente/oportunidade/viagem. A automatização de envio, sincronização de pastas, assinatura, cópias e arquivo dependem de validação técnica e da agência. Sem botão/link de aceitação nesta fase.

### 3.6 Documentos e serviços

- Google Drive: guardar PDFs de orçamentos e documentos de viagem, usando organização e permissões a definir. No CRM guardar metadados e referências seguras; evitar duplicação desnecessária.
- GitHub: manter código, histórico e documentação técnica. Nunca guardar credenciais, tokens, dados pessoais ou documentos de clientes no repositório.
- Supabase: base de dados PostgreSQL no plano Free. A autenticação permanece no Sanity Studio existente; o servidor valida o token do Studio e usa uma chave Supabase de serviço não pública para consultas CRM.
- Next.js (proposta): aplicação web para interface e lógica de servidor.
- Mac mini M4, 16 GB/512 GB: está disponível e já executa outros agentes; avaliar capacidade, isolamento e operação antes de executar serviços locais. Não implementar backups ou NAS nesta fase.
- Backups, NAS e replicação local estão fora do âmbito atual.

## 4. Dados, segurança e privacidade

Tratar dados de contacto, preferências e viagem como dados pessoais. Dados de passaporte, documentos de identificação, saúde, necessidades especiais e dados de menores podem ser especialmente sensíveis e devem ser evitados, ou recolhidos apenas se estritamente necessários, com acesso limitado e prazo de retenção definido.

Requisitos a detalhar antes de produção:
- recolher o mínimo necessário e explicar a finalidade no momento da recolha;
- definir base legal, consentimentos aplicáveis, retenção, correção, exportação e eliminação, com validação do responsável e da agência;
- autenticação forte, princípio do menor privilégio, sessões seguras e controlo de acesso por função;
- cifragem em trânsito e em repouso conforme capacidades dos serviços escolhidos;
- segredos SMTP/IMAP e chaves apenas no servidor/gestor de segredos; rotação e revogação;
- registo de auditoria para acesso e alterações relevantes, sem guardar conteúdo sensível desnecessário;
- validação de entradas, uploads e tipos/tamanhos de ficheiro; proteção contra malware e abuso;
- links do Drive com acesso restrito, sem partilha pública por defeito;
- política para exportações locais, dispositivos, incidentes e encerramento de contas;
- avaliar fornecedores, localização/região dos dados, contratos e custos antes de ativar serviços;
- separar dados reais de ambientes de desenvolvimento/demonstração e nunca usar dados reais em testes sem salvaguardas e autorização.

A definição final deve ser revista pelo utilizador e, quando aplicável, pela GupiTravel e por assessoria competente em proteção de dados. Este plano não é uma avaliação jurídica.

## 5. Arquitetura proposta (a validar)

- Aplicação: Next.js, aproveitando a base técnica existente no repositório.
- Dados: Supabase/PostgreSQL no plano Free. Autenticação Google pelo Sanity Studio existente; as rotas do CRM validam a identidade do Studio e a lista de permissões antes de consultar a base de dados no servidor.
- Ficheiros: Google Drive como arquivo operacional inicial, com referências/metadados no CRM; avaliar Supabase Storage apenas se trouxer benefício claro.
- Email: Roundcube e serviços SMTP/IMAP da GupiTravel, após confirmação de compatibilidade e autorização.
- Processamento de PDF: fluxo assíncrono e observável, com extração/OCR e validação humana; decidir entre serviço gerido ou processamento local após estimativa de custos, qualidade e privacidade.
- Infraestrutura local: Mac mini M4 16GB/512GB disponível; avaliar operação e coexistência com os agentes existentes. Não o assumir como servidor sempre ligado ou destino de cópias de segurança.

Next.js e Supabase Free foram escolhidos para iniciar a implementação, com a condição de não ativar recursos pagos. Se os limites Free forem insuficientes, parar e rever alternativas antes de qualquer upgrade. Confirmar também alojamento, ambientes, domínio, monitorização, recuperação e custo mensal previsto.

## 6. Fases de implementação propostas

1. **Descoberta e desenho:** rever identidade/estrutura atuais, requisitos de negócio, campos, estados, permissões, documentos de exemplo e custos. Fechar decisões em aberto.
2. **Fundação do CRM:** autenticação, modelo de dados, registo de contactos/oportunidades, pipeline e auditoria básica.
3. **Formulário e leads:** formulário com identidade própria, lógica condicional, validação, privacidade e criação de lead.
4. **Comunicação:** modelos de email e fluxo assistido via Roundcube/SMTP; confirmar configuração com a agência; aceitação sempre por resposta manual.
5. **Orçamentos:** upload seguro, extração/normalização, confiança e fila de revisão humana. Começar com PDFs de exemplo aprovados e ampliar por cobertura de campos.
6. **Viagens confirmadas:** conversão comercial-operacional, tarefas, checklists, calendário e documentos.
7. **Acompanhamento e melhoria:** comunicações pré/pós-viagem, métricas úteis, revisão de segurança, custos e operação.
8. **Infraestrutura local opcional:** avaliar Mac mini e processamento local separadamente. Backups/NAS só mediante novo âmbito e decisão explícita.

Cada fase deve ter estimativa e aprovação próprias antes de iniciar. A implementação funcional não começa com a criação deste documento.

## 7. Custos e operação

Antes de escolher fornecedores ou ativar serviços, estimar custos de alojamento, base de dados/autenticação, armazenamento e tráfego, OCR/extração, email, domínio, monitorização e eventuais licenças. Distinguir custos fixos de custos por uso e definir alertas/limites. Incluir manutenção, atualizações, suporte e tempo operacional. Os preços e limites devem ser verificados no momento da decisão; não são fixados neste plano.

## 8. Pressupostos

- O repositório identificado como aplicação atual é `travelfrontiers/Travel-frontiers`; a raiz contém uma aplicação Next.js/TypeScript e o repositório apresenta um site Travel Frontiers publicado em Vercel.
- As contas de email indicadas estão disponíveis para uso empresarial, mas os parâmetros e permissões SMTP/IMAP ainda não foram verificados.
- O Google Drive existente poderá ser usado para documentos, mas pastas, partilhas e políticas ainda precisam de desenho.
- Os PDFs partilhados anteriormente ilustram formatos de origem; não se presume que cubram todas as variantes de operador.
- O CRM é exclusivamente para Tiago; não criar contas para outros colaboradores sem nova decisão.
- A extração automática é assistiva; o utilizador valida valores antes de os usar.
- A marca e a aplicação existentes devem ser inspecionadas e reutilizadas durante o desenho; não se deve pedir ao utilizador que reenvie elementos já presentes no repositório.

## 9. Itens por validar

- Identidade visual exata: logótipo/variações, cores, tipografia, tom de voz e regras de uso da GupiTravel.
- Formulário: campos obrigatórios, regras condicionais, consentimentos, avisos, limites de upload e destino dos pedidos.
- Pipeline: estados finais, critérios de transição, tarefas, alertas, motivos de perda e relatórios necessários.
- Perfis de acesso: apenas Tiago ou também colegas/agência; separação entre dados pessoais e operacionais.
- Campos normalizados dos orçamentos, formatos de moeda/impostos, regras de preços e tolerância de confiança.
- Localização dos documentos no Drive, convenção de nomes, permissões, retenção e gestão de links.
- Parâmetros SMTP/IMAP, autenticação (incluindo eventual MFA/app password), limites, política de CC e arquivo, e autorização da GupiTravel para integrações.
- Provedor de alojamento, região dos dados, custos, backup/recuperação gerida, monitorização e política de retenção de logs.
- Tratamento de dados sensíveis e de menores, finalidades, prazos e processos de acesso/correção/eliminação.
- Modelo de operação local do Mac mini e responsáveis por atualizações e suporte.
- Plano de migração de eventuais leads atuais e critérios de deduplicação.

## 10. Critérios de aceitação do plano e das fases

### Para este plano

- [x] Explica a relação entre Travel Frontiers e GupiTravel.
- [x] Consolida formulário condicional, leads/pipeline, viagens operacionais, PDFs, email e documentos.
- [x] Mantém a aceitação do orçamento por resposta manual e exclui botão/link nesta fase.
- [x] Regista a arquitetura escolhida, disponibilidade do Mac mini e exclusão de backups/NAS agora.
- [x] Distingue decisões confirmadas, pressupostos e pontos por validar.
- [x] Inclui segurança, privacidade, custos, fases e critérios verificáveis.
- [x] Não altera a aplicação nem implementa funções.

### Para aprovação de cada fase funcional futura

- Objetivos, dados recolhidos, permissões e critérios de sucesso aprovados antes de começar.
- Fluxos principais e exceções descritos e demonstráveis sem depender de credenciais reais em ambientes de teste.
- Dados inválidos, duplicados, falhas de integração e baixa confiança tratados de forma clara e recuperável.
- Acesso a dados limitado ao necessário e ações relevantes auditáveis.
- Custos e responsabilidades operacionais conhecidos e aceites.
- Utilizador consegue rever e corrigir extrações de PDF antes de uso.
- Email enviado só após revisão humana; aceitação permanece documentada como resposta manual.
- Documentos não são expostos por links públicos; retenção e eliminação seguem regras acordadas.
- Nenhuma alteração de produção, integração externa ou transferência de dados reais sem validação correspondente.

## 11. Estado do documento

Este documento consolida o contexto disponível nesta conversa e serve como referência de continuidade para futuras sessões. Os itens por validar devem ser resolvidos antes da respetiva fase. Qualquer alteração às decisões confirmadas deve ser registada aqui antes de orientar trabalho posterior.


## 12. Decisões e progresso após a consolidação

- Supabase foi aceite como base de dados, desde que permaneça no plano Free e sem ativação de serviços pagos. Se as quotas forem insuficientes, parar e propor alternativas antes de qualquer upgrade.
- O Mac mini está disponível no ambiente de trabalho atual e já executa outros agentes. Avaliar concorrência de recursos e isolamento antes de correr serviços do CRM nele.
- Utilizador único: Tiago, autenticado na área Admin existente com `tf.travel.frontiers@gmail.com`. Formulário público para visitantes, CRM sem segundo login.
- Checklist mínima vista no Trello: enviar email com a mensagem para o quarto, fazer check-in e perguntar se está tudo bem; deve ser editável por viagem.
- Campos do formulário e de orçamentos devem seguir este plano; as perguntas podem ser condicionais e o visitante não deve ser solicitado a introduzir mais dados do que o necessário.
- Implementação: formulário público PT/EN/FR com orçamento obrigatório, regras para crianças e aviso interno apenas para Tiago; base Supabase; CRM dentro do Studio existente com pipeline, conversão de pedidos ganhos em viagens e checklist editável.
- Antes de produção faltam rever proteção antiabuso, política de retenção e recuperação dos dados. A configuração de emails fica fora da tarefa atual.

- Decisão adicional: notificações automáticas internas do formulário e de orçamentos são enviadas apenas para Tiago Ferreira, sem CC à GupiTravel.
- Decisão adicional do utilizador: cada cliente pode ter vários documentos registados com tipo, número/ID e data de validade; o dashboard do CRM deve alertar para documentos vencidos ou a vencer nos próximos 30 dias.
- O número/ID do documento é dado pessoal de acesso restrito. O CRM não deve guardar imagens/cópias do documento nesta funcionalidade, nem mostrar o número nos alertas do dashboard. O acesso continua limitado à sessão Google autorizada do Admin; retenção e eliminação devem ser definidas antes de uso operacional continuado.


## 13. Estado da implementação do CRM — 8 de novembro de 2026

Implementado no projeto local `Travel-frontiers`, no branch `travel-frontiers-crm`, sem alterações aos fluxos de email: dashboard inicial; Kanban horizontal com mudança acessível de fase; registo manual de clientes e viagens; associação de clientes a várias viagens; campos operacionais de viagem; serviços/reservas editáveis; checklist mínima editável; calendário de partidas, regressos e tarefas; metadados de documentação do cliente e alertas de validade; formulário público PT/EN/FR; próximo contacto e motivo de perda no pipeline; pré-preenchimento de campos comuns da viagem a partir de PDFs, incluindo sugestões de voos e alojamento revistas manualmente; vistas comerciais e operacionais explicitamente separadas na navegação.

Revisão visual do dashboard: cartões de situação para pedidos novos/ativos, orçamentos à espera do cliente, viagens ativas, tarefas atrasadas e documentação; contagem visual de todas as fases do pipeline e estados operacionais das viagens; agenda dos próximos 14 dias, pedidos recentes, alertas documentais e partidas próximas. Mantém atalhos para novo cliente, importação de orçamento, Kanban, calendário e viagens, sem apresentar projeções de receita sem dados que as sustentem.

As migrações `202611080004_crm_trip_import_fields.sql`, `202611080005_crm_lead_followups.sql` e `202611080006_crm_create_trip_services.sql` foram aplicadas no projeto Supabase Free. A compilação de produção foi concluída com sucesso.

Limites ainda abertos: a extração de PDFs é heurística e precisa de validação com amostras de operadores diferentes; preço, condições e campos ambíguos continuam a exigir revisão manual. O PDF não é arquivado no Google Drive e o formulário não apresenta o PDF lado a lado com os campos; falta integrar o Drive com OAuth autorizado. Não usar preços, datas ou condições extraídos sem revisão. Não guardar documentos de viagem no GitHub. A auditoria encontrou um PDF de cliente já versionado no repositório; `.gitignore` agora impede novos PDFs, mas a cópia no histórico Git ainda precisa de limpeza controlada.

A tarefa atual exclui SMTP/IMAP, templates de email e envio de comunicações. A confirmação do orçamento continua a ser feita pelo cliente em resposta manual ao email.
