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
- Conta empresarial Roundcube disponível e acesso às configurações sob controlo do utilizador.
- Remetente previsto: `tiago.ferreira@gupitravel.pt`; CC da agência: `geral@gupitravel.pt`.
- Google Drive será usado para documentos; GitHub para código.
- A arquitetura proposta é Next.js e Supabase, a validar antes da implementação.
- Mac mini M4 com 16 GB de memória e 512 GB de armazenamento é infraestrutura futura proposta para processamento. Não implementar agora backups, NAS ou infraestrutura local.
- O pedido nesta fase é de planeamento. Não alterar a aplicação atual nem implementar funcionalidades.

## 3. Âmbito funcional proposto

### 3.1 Formulário de pedido/reserva

Criar um formulário próprio com identidade Travel Frontiers, responsivo e acessível. Deve recolher apenas a informação necessária para compreender o pedido e preparar uma proposta.

Campos candidatos (a confirmar): nome e contactos; destino/região ou flexibilidade; datas e flexibilidade; duração; número e idades dos viajantes quando necessário; tipo de viagem/experiências; origem ou aeroporto preferido; alojamento/regime; orçamento indicativo; observações; canal/origem do pedido; consentimentos e informação de privacidade aplicáveis.

As regras condicionais devem revelar apenas perguntas relevantes (por exemplo, idades quando há menores, detalhes de voo quando se pede pacote com voo, preferências de alojamento conforme o tipo de viagem). Deve haver validação de formato e obrigatoriedade, prevenção de submissões inválidas e confirmação clara após envio. Os campos finais, texto legal, retenção, proteção contra spam e comportamento após envio carecem de validação.

### 3.2 CRM, leads e pipeline comercial

Manter um registo por contacto e um ou mais pedidos/oportunidades associados, evitando duplicados quando possível. O pipeline deve permitir estados configuráveis, por exemplo:

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

Permitir anexar PDFs recebidos da plataforma ou de operadores diversos. Propor um fluxo de extração que:
- guarda o ficheiro original no Google Drive, com ligação e metadados no CRM;
- extrai texto e, quando necessário, aplica OCR a PDFs digitalizados;
- normaliza campos comuns, por exemplo operador/fornecedor, referência, destino, datas, duração, viajantes, voos, alojamento, regime, serviços incluídos/excluídos, preço, moeda, condições, validade e observações;
- associa os dados extraídos à oportunidade correta, com possibilidade de correção;
- assinala campos ausentes, ambiguidades e baixa confiança;
- apresenta o PDF e os valores extraídos lado a lado para revisão humana;
- só após aprovação grava/usa os valores normalizados e permite preparar a comunicação ao cliente.

Não assumir que todos os PDFs contêm todos os campos ou têm o mesmo formato. Definir dicionário de dados, regras de confiança, tratamento de tabelas/moedas/impostos, limites de ficheiro e formatos suportados antes da implementação. Não usar extração automatizada como confirmação de preço ou disponibilidade.

### 3.5 Email e modelos de comunicação

Usar Roundcube como interface de email existente e avaliar envio/consulta pelo servidor empresarial via SMTP/IMAP, apenas depois de confirmar suporte, autenticação, limites e autorização da agência. A configuração deve usar segredos protegidos no servidor e nunca expor credenciais no browser ou no repositório.

Identidade pretendida:
- De: Tiago Ferreira <tiago.ferreira@gupitravel.pt>
- CC: geral@gupitravel.pt

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
- Supabase (proposta): autenticação, base de dados PostgreSQL e armazenamento apenas se a decisão de arquitetura e as condições de privacidade/custo forem aprovadas.
- Next.js (proposta): aplicação web para interface e lógica de servidor.
- Mac mini M4, 16 GB/512 GB: considerar numa fase futura para processamento local/auxiliar de documentos, após avaliação de segurança, disponibilidade e manutenção. Não é requisito para a primeira fase.
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
- Dados e autenticação: Supabase/PostgreSQL, com políticas de acesso no servidor e por linha quando adequadas.
- Ficheiros: Google Drive como arquivo operacional inicial, com referências/metadados no CRM; avaliar Supabase Storage apenas se trouxer benefício claro.
- Email: Roundcube e serviços SMTP/IMAP da GupiTravel, após confirmação de compatibilidade e autorização.
- Processamento de PDF: fluxo assíncrono e observável, com extração/OCR e validação humana; decidir entre serviço gerido ou processamento local após estimativa de custos, qualidade e privacidade.
- Infraestrutura futura: avaliar Mac mini M4 16GB/512GB apenas numa fase posterior. Não pressupor que seja servidor sempre ligado ou destino de cópias de segurança.

A marcação técnica de Next.js e Supabase é uma proposta consolidada para orientar a análise, não uma decisão de implementação irreversível. Confirmar também alojamento, ambientes, domínio, monitorização, recuperação e custo mensal previsto.

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
- O CRM é inicialmente para o consultor e poderá necessitar de acesso da agência no futuro, sujeito a decisão e permissões.
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
- Papel futuro do Mac mini, modelo de operação e responsáveis por atualizações e suporte.
- Plano de migração de eventuais leads atuais e critérios de deduplicação.

## 10. Critérios de aceitação do plano e das fases

### Para este plano

- [x] Explica a relação entre Travel Frontiers e GupiTravel.
- [x] Consolida formulário condicional, leads/pipeline, viagens operacionais, PDFs, email e documentos.
- [x] Mantém a aceitação do orçamento por resposta manual e exclui botão/link nesta fase.
- [x] Regista arquitetura proposta, Mac mini como possibilidade futura e exclusão de backups/NAS agora.
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
