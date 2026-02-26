# Autenticação e Ambientes (Staging vs Produção) - Parcelow API

Este documento descreve detalhadamente o mecanismo de identificação dinâmica implementado no sistema Migma para alternar automaticamente entre os ambientes de Teste (Staging) e Produção da API Parcelow. 

A lógica foi arquitetada para garantir que nenhum pagamento simulado ou de homologação gere cobranças reais e, inversamente, para que todos os clientes e compras em ambientes produtivos se comuniquem com o serviço oficial e seguro do Gateway de pagamento Parcelow.

---

## 1. Como a Identificação Dinâmica Funciona

A escolha da credencial que a integração da Parcelow utilizará (Staging vs. Production) ocorre ativamente a cada requisição enviada ao servidor. 

Isso se baseia na função **`detectEnvironment`** localizada dentro do Core da nossa Edge Function no Supabase (`create-parcelow-checkout/index.ts`). O script detecta a origem real de onde a aplicação cliente disparou a chamada via URL do navegador.

### Mecanismo de Identificação:
Ele lê cabeçalhos nativos HTTP provenientes da chamada REST do frontend:
*   `origin`
*   `referer`
*   `host`

A regra implementada no código é a seguinte:

```typescript
// origin detection
const isProductionDomain =
  referer.includes('migmainc.com') ||
  origin.includes('migmainc.com') ||
  host.includes('migmainc.com') ||
  (referer.includes('vercel.app') && !referer.includes('preview')) ||
  (origin.includes('vercel.app') && !origin.includes('preview'));
```

#### Cenário de Produção (Production):
Ele categorizará e definirá `isProduction = true`, além do ambiente interno setado para **`'production'`** ***caso***:
1.  A origem da chamada contenha o domínio matriz do seu sistema produtivo (`migmainc.com`).
2.  A origem da chamada venha do Vercel, mas garanta explicitamente a ***ausência*** do termo `"preview"` nas strings.

#### Cenário de Teste / Homologação (Staging):
A aplicação definirá `isProduction = false`, caindo em um fallback padrão onde o ambiente selecionado é o **`'staging'`** ***caso***:
1.  A chamada HTTP venha de execuções dev (`localhost:5173` ou similares).
2.  A chamada venha de Links temporários gerados no GitHub/Vercel (e.g., `migma-blabla-preview.vercel.app`).

---

## 2. Roteamento de Credenciais a Nível de Ambiente (Supabase)

Assim que o estágio acima encerra a categorização booleana da URL, a Edge Function executa a montagem lógica da chamada à API.

Ela avalia o estágio ativo e cruza os dados para buscar nos Segredos (Secrets) do *Supabase* a via adequada a se utilizar:

### Configuração em Staging (Testes Puros)

*   **API Base Mapeada:** `https://sandbox-2.parcelow.com.br`
*   **Rotina do Código:** 

```typescript
const parcelowClientId = parcelowEnvironment === 'staging'
  ? (Deno.env.get("PARCELOW_CLIENT_ID_STAGING") || Deno.env.get("PARCELOW_CLIENT_ID"))

const parcelowClientSecret = parcelowEnvironment === 'staging'
  ? (Deno.env.get("PARCELOW_CLIENT_SECRET_STAGING") || Deno.env.get("PARCELOW_CLIENT_SECRET"))
```
*Ele priorizará sempre qualquer credencial guardada que possuir o sufixo `_STAGING` para garantir a segurança.*

**Chaves Utilizadas na Tabela de Secretos:**
*   `PARCELOW_CLIENT_ID_STAGING`
    *   (Ex.: fa2b7af0a811b9acde602aacb78e3638e8506dfead5fe6c3425b10b526f94bdd)
*   `PARCELOW_CLIENT_SECRET_STAGING`
    *   (Ex.: dcff419720b79b721aa4215363c8bfcd3d19c762412034aa41d3ce2b2f1ce2c5)

### Configuração em Produção (Transações e Cobranças Reais)

*   **API Base Mapeada:** `https://app.parcelow.com`
*   **Rotina do Código:** 

```typescript
  : (Deno.env.get("PARCELOW_CLIENT_ID_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_ID"));

  : (Deno.env.get("PARCELOW_CLIENT_SECRET_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_SECRET"));
```
*Ele priorizará qualquer credencial guardada que possuir o sufixo `_PRODUCTION` nas chaves ativas da cloud.*

**Chaves Utilizadas na Tabela de Secretos:**
*   `PARCELOW_CLIENT_ID_PRODUCTION`
    *   (Ex.: 63ecbfa3a1ad34a1fdd5e3dd3aeaec31456d1d676552c654d5ecf7dab0b2f4f8)
*   `PARCELOW_CLIENT_SECRET_PRODUCTION`
    *   *(Chave privada correspondente)*

---

## 3. Segurança e Lógica Curinga (Fallback)

Toda a codificação contida em nossos conectores Parcelow possui uma arquitetura de proteção em formato condicional `||`.

Eles existem em todas as consultas a atributos base, exemplo: `|| Deno.env.get("PARCELOW_CLIENT_ID")`.

**Motivo:** 
Caso em algum momento crítico (por limpeza ou migração acidental por parte do suporte) a variável explícita como "Production" ser eliminada e o sistema tentar cobrar um checkout de produção verídico sem a chave final do ID ali contida, o script não irá 'crachar' e perder a venda instantaneamente. Ele utilizará o `PARCELOW_CLIENT_ID` base (que também está lá hoje nas suas Settings do Supabase mapeado para produção).

Este modelo de três camadas atende aos mais rigorosos frameworks de escalabilidade e segurança de gateways de integração em TypeScript nativo nas functions Deno.
