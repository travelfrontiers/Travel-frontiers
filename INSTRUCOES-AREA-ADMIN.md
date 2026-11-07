# Instruções: calculadora de comissões

## Onde abrir

1. Abre [promo.travelfrontiers.pt/admin/comissoes](https://promo.travelfrontiers.pt/admin/comissoes).
2. Inicia sessão no Sanity Studio com a mesma conta usada para gerir as promoções.
3. No menu do Studio, escolhe **Calculadora de comissão**.

A calculadora fica dentro do Studio existente e usa a sessão já aberta.

## Acesso

- A autenticação e a sessão são as mesmas do painel de promoções do Sanity Studio.
- O acesso depende de a conta estar autorizada no projeto Sanity usado pelo site. Gere os utilizadores e permissões no painel de gestão desse projeto.
- Qualquer pessoa que já tenha acesso ao Sanity Studio também poderá ver e usar esta ferramenta. Para restringi-la a uma só pessoa, o projeto Sanity tem de conceder acesso apenas a essa conta.
- A ligação no site abre o Studio. O conteúdo da calculadora só aparece depois da autenticação normal do Studio.

## Como usar a calculadora

1. Introduz a comissão total da viagem, o número de viajantes e o preço por viajante.
2. Ativa **Também vou nesta viagem** se fores membro dos viajantes e indica o custo por viajante. O teu preço de auto-consumo é custo + 1%.
3. Se quiseres, ativa **Distribuir a poupança de auto-consumo por todos?**. A poupança é dividida pelo grupo e o novo preço por viajante é apresentado.
4. A cedência de comissão é uma escolha independente. Quando viajas, ativa a cedência aos outros passageiros para introduzir o montante total; sem auto-consumo, introduz diretamente o montante.
5. O montante cedido é repartido igualmente pelos passageiros que o recebem. A comissão antes da cedência é 80% da comissão total.

Os valores são calculados no navegador e não são guardados no Sanity.

## Publicação e resolução de problemas

- A branch de revisão contém a ferramenta e as ligações do site. Depois de a alteração ser integrada na branch de produção, a Vercel publica o novo Studio.
- Se não aparecer **Calculadora de comissão** no menu do Studio, confirma que a deployment de produção inclui esta versão de `sanity.config.ts`.
- Se não conseguires iniciar sessão no Studio, confirma que a conta tem acesso ao mesmo projeto Sanity usado pelas promoções.
- Não são necessárias credenciais nem variáveis de ambiente adicionais para a calculadora.

