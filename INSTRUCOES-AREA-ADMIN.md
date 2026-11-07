# Instruções: Área admin da calculadora de comissões

## Acesso

- Endereço: `https://promo.travelfrontiers.pt/pt/area-admin/comissoes`
- O endereço também fica ligado no menu do site Travel Frontiers.
- O ecrã de login é público, mas a calculadora só é entregue pelo servidor depois de validar a conta Google autorizada.
- O endereço autorizado é guardado na variável privada `ADMIN_EMAIL` da Vercel. Não colocar o endereço em ficheiros públicos, no GitHub ou numa variável `NEXT_PUBLIC_*`.
- A sessão usa um cookie `HttpOnly`, `Secure` em produção e dura no máximo uma hora. O botão **Terminar sessão** apaga o cookie.

## Configurar Google Identity Services

É necessário um cliente OAuth do tipo **Web application**. Este fluxo usa o botão Google Identity Services com callback JavaScript; não usa segredo de cliente nem URI de redirecionamento.

1. Na [Google Cloud Console](https://console.cloud.google.com/), seleciona ou cria um projeto.
2. Em **Google Auth Platform**, configura o nome e os dados de consentimento da aplicação.
3. Se a aplicação estiver no modo de teste, acrescenta a conta autorizada como utilizador de teste.
4. Em **Clients**, cria um cliente OAuth do tipo **Web application**.
5. Em **Authorized JavaScript origins**, acrescenta `https://promo.travelfrontiers.pt`.
6. Guarda o **Client ID**. Não é necessário criar ou guardar um Client Secret para este fluxo.

## Configurar a Vercel

No projeto `travel-frontiers-promo`, em **Settings → Environment Variables**:

1. Confirma que `ADMIN_EMAIL` existe como variável **Sensitive/Secret** nos ambientes Production, Preview e Development. O valor já foi configurado privadamente durante esta integração.
2. Cria `NEXT_PUBLIC_GOOGLE_CLIENT_ID` com o Client ID criado na Google Cloud Console. Seleciona Production, Preview e Development. Esta variável é pública por definição; nunca coloques um segredo nela.
3. Guarda as alterações e cria uma nova deployment. Variáveis alteradas não se aplicam às deployments já existentes.

O domínio de produção e os respetivos Google OAuth origins devem corresponder exatamente. Para desenvolvimento local, se necessário, acrescenta `http://localhost:3000` aos Authorized JavaScript origins e disponibiliza as variáveis de Development localmente.

## Como funciona a proteção

- O navegador envia o ID token Google ao endpoint da aplicação.
- O servidor valida a assinatura com as chaves públicas publicadas pela Google e confirma emissor, Client ID, validade, nonce, email verificado e correspondência com `ADMIN_EMAIL`.
- A calculadora só é renderizada no servidor depois desta validação. A rota não depende de esconder o link no menu.
- A calculadora faz os cálculos no navegador; não envia os valores da viagem para um serviço.
- As alterações de código estão numa branch de revisão. A criação/merge de uma PR para a branch de produção pode iniciar uma deployment; não fazer merge antes de configurar o Client ID e rever a PR.

## Verificação após configurar

1. Abre o endereço da área admin numa janela privada.
2. Inicia sessão com a conta Google autorizada e confirma que aparece a calculadora.
3. Termina sessão; o ecrã de login deve voltar a aparecer.
4. Experimenta uma conta Google diferente; a calculadora não deve aparecer.
5. Confirma os cenários da calculadora: sem auto-consumo (80% da comissão total), auto-consumo sem repartir a poupança, auto-consumo com repartição e cedência da comissão ligada ou desligada.

## Resolução de problemas

- **“O login Google ainda não está configurado”**: falta `NEXT_PUBLIC_GOOGLE_CLIENT_ID` na Vercel ou ainda não foi criada uma nova deployment.
- **A Google não aceita o domínio**: confirma que `https://promo.travelfrontiers.pt` está nas Authorized JavaScript origins do cliente Web.
- **“Esta conta Google não tem acesso a esta área”**: confirma que o email verificado da sessão corresponde exatamente ao valor privado de `ADMIN_EMAIL`.
- **A alteração de uma variável não surtiu efeito**: cria uma nova deployment para carregar os valores atualizados.

