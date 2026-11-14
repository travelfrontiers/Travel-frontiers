# Evolução do CRM · Revisão integrada

A branch da fase 4 junta as quatro fases. Os [pull requests](#pull-requests) estão encadeados para que cada um mostre o trabalho da sua etapa. A demonstração e as capturas usam dados fictícios.

## Percurso de revisão

1. **Início → Viagens → Roma.** A ficha reúne as sete secções. Os viajantes, as propostas e o histórico têm ligações próprias.
2. **Comunicações e Alertas.** O alerta de check-in abre a tarefa, uma prestação abre Pagamentos e a validade abre a proposta. O email continua a exigir revisão e envio explícito. O histórico e a sincronização de respostas continuam junto do editor.
3. **Serviços.** A comparação usa os serviços ativos, com a base por reserva ou por pessoa declarada. Só apresenta uma diferença face ao preço contratado quando todos os serviços ativos têm preço de venda na moeda da viagem. Custos e comissões são apresentados separadamente. O total contratado só muda por uma ação explícita.
4. **Comissões.** Procura a viagem ou filtra pelo mês de confirmação, valores por receber e divergências. No exemplo, 240 € previstos, 220 € confirmados e 180 € recebidos correspondem a 20 € de divergência, 40 € confirmados por receber e 60 € face à previsão. Um recebimento de 40 € liquida o saldo confirmado. A regularização exige motivo e comprovativo. Um estorno de 10 € reabre um saldo de 10 €.

## Capturas

| Secção | Desktop | iPhone 13 emulado |
| --- | --- | --- |
| Comunicações e alertas | [Ver](comunicacoes-desktop.jpg) | [Ver](comunicacoes-iphone.jpg) |
| Valores por serviço | [Ver](servicos-desktop.jpg) | [Ver](servicos-iphone.jpg) |
| Conciliação de comissões | [Ver](comissao-desktop.jpg) | [Ver](comissao-iphone.jpg) |

## Verificação

- Compilação de pré-visualização da branch integrada na Vercel e TypeScript.
- Três suites de regressão para rotas, permissões, documentos, email com transporte simulado e regras da calculadora.
- Sete suites SQL numa instância PostgreSQL descartável. Cobrem, entre outros casos, alterações concorrentes, documentos de outra viagem, preservação de movimentos, valores desconhecidos, aceitação de propostas, OCR e o circuito de regularização e estorno.
- Chromium em desktop e com dimensão de iPhone 13. Incluiu alertas, retenção de rascunho, alteração do valor por serviço, filtros, registo parcial de comissão, regularização, estorno e modo escuro. A demonstração guarda os exemplos apenas em memória e reinicia os valores quando é recarregada.
- Os PDFs textuais seguem para uma revisão dos serviços extraídos. Campos financeiros por serviço ficam em branco até confirmação manual. A leitura de preços por linha em PDFs digitalizados requer amostras anonimizadas que permitam validar a associação entre cada preço, a moeda e a base por pessoa ou por reserva.
- A importação de mapas PDF/CSV/XLSX da agência fica pendente de uma amostra anonimizada. A proposta é ler para uma fila de revisão, procurar candidatos por operador, localizador, datas e montante, mostrar discrepâncias e só guardar quando houver confirmação humana.

As migrações 023 e 024 foram testadas localmente e ainda têm de ser aplicadas num ambiente de teste com dados próprios antes de qualquer publicação. Não foram feitas alterações em produção, em dados de clientes ou na configuração do email.

## Pull requests

- [#53 · Navegação e ficha de viagem](https://github.com/travelfrontiers/Travel-frontiers/pull/53)
- [#55 · Comunicações e alertas](https://github.com/travelfrontiers/Travel-frontiers/pull/55)
- [#56 · Valores por serviço](https://github.com/travelfrontiers/Travel-frontiers/pull/56)
- [#54 · Conciliação de comissões e branch integrada](https://github.com/travelfrontiers/Travel-frontiers/pull/54)
