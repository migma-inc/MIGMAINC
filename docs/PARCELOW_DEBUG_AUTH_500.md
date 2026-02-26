# Debug: Erro 500 na Autenticação com a Parcelow

## O Problema
Ao tentar rodar a Edge Function de criar o checkout da Parcelow em um novo projeto (usando a codebase do Migma como base), a API do Gateway Parcelow retorna o seguinte erro:
```
[create-parcelow-checkout] Erro: Falha na autenticação com o Gateway Parcelow (Status 500).
Erro auth Parcelow: 500 { "message": "Server Error" }
```

## A Causa
O erro **500 Server Error** vindo da autenticação (`/oauth/token`) da Parcelow acontece porque as **credenciais (`client_id` e/ou `client_secret`) incorretas (ou antigas)** estão sendo enviadas no body da requisição.

Ao analisar os logs, notou-se o seguinte:
```json
[create-parcelow-checkout] Tentando Autenticar. Body: { client_id: "fa2b7af0...", client_secret: "***HIDDEN***", grant_type: "client_credentials" }
```
O `client_id` enviado foi `fa2b7af0...`, no entanto, as credenciais corretas do projeto que deveriam ter sido utilizadas eram:
```properties
PARCELOW_CLIENT_ID_STAGING=99f7cac...
PARCELOW_CLIENT_SECRET_STAGING=462ebfac...
```

### Por que as chaves erradas foram enviadas?
No código da Edge Function, existe a seguinte lógica de fallback:
```typescript
const parcelowClientId = parcelowEnvironment === 'staging'
    ? (Deno.env.get("PARCELOW_CLIENT_ID_STAGING") || Deno.env.get("PARCELOW_CLIENT_ID"))
    : (Deno.env.get("PARCELOW_CLIENT_ID_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_ID"));
```
Se a variável `PARCELOW_CLIENT_ID_STAGING` não estiver configurada ou carregada corretamente no ambiente, a function usa a variável genérica `PARCELOW_CLIENT_ID` por conta do operador `||`. Como essa variável contem dados residuais/antigos de outro projeto, a requisição para a Parcelow falha (a API da Parcelow lida incorretamente com clients inválidos e retorna 500 em vez de 401).

## Como Resolver

### 1. Ambiente Local (Supabase CLI)
Verifique o seu arquivo de variáveis de ambiente local (ex: `.env` ou `supabase/.env.local` do novo projeto):
- Adicione as chaves corretas:
  ```env
  PARCELOW_CLIENT_ID_STAGING=99f7cac42f4058992d2306177269b6fccf03b92c58c7ff9b11e71071cb7e98ef
  PARCELOW_CLIENT_SECRET_STAGING=462ebfac6deeddafee601bc0500a63aa266ddacc504f057ccd11500d2c246a3b
  # Adicione também as de _PRODUCTION
  ```
- **Remova** completamente do arquivo qualquer referência a `PARCELOW_CLIENT_ID` e `PARCELOW_CLIENT_SECRET` (as variáveis genéricas sem sufixo), para impedir que o fallback utilize lixo de configuração.
- Reinicie a function carregando explicitamente seu arquivo `.env`:
  ```bash
  supabase functions serve --env-file ./supabase/.env.local
  ```

### 2. Ambiente em Nuvem (Supabase Dashboard)
Associe os secrets diretamente no novo projeto do Supabase conectado, rodando os seguintes comandos no terminal:
```bash
npx supabase secrets set PARCELOW_CLIENT_ID_STAGING=99f7cac42f4058992d2306177269b6fccf03b92c58c7ff9b11e71071cb7e98ef
npx supabase secrets set PARCELOW_CLIENT_SECRET_STAGING=462ebfac6deeddafee601bc0500a63aa266ddacc504f057ccd11500d2c246a3b

npx supabase secrets set PARCELOW_CLIENT_ID_PRODUCTION=d6197bdbf3c3a825139831b6b85d5335d57c471f605c5abbc552cee27651f110
npx supabase secrets set PARCELOW_CLIENT_SECRET_PRODUCTION=[COLOQUE-SEGREDO-DE-PRODUCAO-AQUI]
```

Remova os secrets antigos se existirem:
```bash
npx supabase secrets unset PARCELOW_CLIENT_ID
npx supabase secrets unset PARCELOW_CLIENT_SECRET
```

Ajustando o carregamento dos secrets, o Gateway da Parcelow deixará de estourar Erro 500 na sua requisição de `/oauth/token`.
