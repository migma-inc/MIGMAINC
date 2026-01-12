# 🔐 Como Configurar Wise para Checkout Embarcado (OAuth 2.0 + mTLS)

**Data**: 2026-01-12  
**Objetivo**: Migrar de Personal Token para OAuth 2.0 + mTLS para ter checkout embarcado igual ao Stripe

---

## 🎯 VISÃO GERAL

Para ter **checkout embarcado** no Wise (sem redirecionamento, igual ao Stripe), é necessário migrar de **Personal Token** para **OAuth 2.0 + mTLS**.

### Diferenças Principais

| Aspecto | Personal Token (Atual) | OAuth 2.0 + mTLS (Checkout Embarcado) |
|---------|------------------------|----------------------------------------|
| **Checkout** | ❌ Redirect para Wise | ✅ Embarcado no seu site |
| **Login Cliente** | ✅ Necessário | ❌ Não necessário |
| **Aprovação Wise** | ❌ Não precisa | ✅ **PRECISA** |
| **Certificados** | ❌ Não precisa | ✅ **PRECISA** (mTLS) |
| **Complexidade** | ⭐ Simples | ⭐⭐⭐ Complexo |
| **Tempo Setup** | ⏱️ Minutos | ⏱️ **Semanas** (com aprovação) |

---

## 📋 REQUISITOS PARA CHECKOUT EMBARCADO

### 1. Aprovação da Wise (OBRIGATÓRIO)

**⚠️ IMPORTANTE**: Você **NÃO pode** simplesmente mudar o código. É necessário:

1. **Entrar em contato com Wise**:
   - Email: `partners@wise.com` ou através do dashboard
   - Explicar seu caso de uso
   - Solicitar acesso a **OAuth 2.0 + mTLS**

2. **Processo de Aprovação**:
   - Wise avalia sua aplicação
   - Pode levar **2-4 semanas** para aprovação
   - Requer documentação do negócio
   - Pode requerer conta Business verificada

3. **Após Aprovação**:
   - Wise fornece `client_id` e `client_secret`
   - Wise fornece instruções para gerar certificados
   - Wise fornece certificado CA para trust store

---

## 🔧 CONFIGURAÇÃO TÉCNICA

### Passo 1: Obter Credenciais OAuth 2.0

Após aprovação da Wise, você receberá:

```bash
# Credenciais OAuth 2.0
WISE_CLIENT_ID=seu_client_id_aqui
WISE_CLIENT_SECRET=seu_client_secret_aqui

# Ambiente (sandbox ou production)
WISE_ENVIRONMENT=sandbox  # ou production
```

### Passo 2: Gerar Certificado de Cliente (mTLS)

**mTLS (Mutual TLS)** é obrigatório para OAuth 2.0 com Wise.

#### 2.1. Gerar Chave Privada

```bash
# Opção 1: RSA 2048 bits (recomendado)
openssl genrsa -out wise-client-private-key.pem 2048

# Opção 2: RSA 4096 bits (mais seguro)
openssl genrsa -out wise-client-private-key.pem 4096

# Opção 3: ECC 256 bits (mais leve)
openssl ecparam -genkey -name secp256r1 -out wise-client-private-key.pem
```

#### 2.2. Gerar CSR (Certificate Signing Request)

```bash
openssl req -new -key wise-client-private-key.pem -out wise-client.csr

# Durante o processo, você será perguntado:
# - Country Name: US (ou seu país)
# - State/Province: (seu estado)
# - Locality: (sua cidade)
# - Organization: Migma (ou seu nome)
# - Organizational Unit: (opcional)
# - Common Name: api.wise.com (ou api.wise-sandbox.com)
# - Email: (seu email)
```

#### 2.3. Enviar CSR para Wise

1. Acesse o dashboard da Wise (após aprovação)
2. Vá em **Integrations** > **Certificates**
3. Faça upload do arquivo `wise-client.csr`
4. Wise retornará um **certificado assinado** (`wise-client-cert.pem`)

#### 2.4. Obter Certificado CA da Wise

Wise fornecerá um certificado CA para trust store:

```bash
# Download do certificado CA da Wise
# (fornecido pela Wise após aprovação)
# Salve como: wise-ca-cert.pem
```

---

## 💻 IMPLEMENTAÇÃO NO CÓDIGO

### Mudanças Necessárias

#### 1. Atualizar Edge Function: `create-wise-checkout`

**Antes (Personal Token)**:
```typescript
// Autenticação simples
const headers = {
  'Authorization': `Bearer ${personalToken}`,
  'Content-Type': 'application/json'
};
```

**Depois (OAuth 2.0 + mTLS)**:
```typescript
// 1. Obter access token via Client Credentials Grant
const accessToken = await getOAuth2AccessToken();

// 2. Usar mTLS para requisições
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
};

// 3. Configurar certificados para fetch
const fetchOptions = {
  headers,
  // Certificados para mTLS
  cert: await Deno.readTextFile('./wise-client-cert.pem'),
  key: await Deno.readTextFile('./wise-client-private-key.pem'),
  ca: await Deno.readTextFile('./wise-ca-cert.pem'),
};
```

#### 2. Criar Função para Obter Access Token

```typescript
// supabase/functions/create-wise-checkout/index.ts

async function getOAuth2AccessToken(): Promise<string> {
  const clientId = Deno.env.get('WISE_CLIENT_ID');
  const clientSecret = Deno.env.get('WISE_CLIENT_SECRET');
  const environment = Deno.env.get('WISE_ENVIRONMENT') || 'sandbox';
  
  const tokenUrl = environment === 'sandbox'
    ? 'https://api.wise-sandbox.com/oauth/token'
    : 'https://api.wise.com/oauth/token';

  // Ler certificados
  const cert = await Deno.readTextFile('./wise-client-cert.pem');
  const key = await Deno.readTextFile('./wise-client-private-key.pem');
  const ca = await Deno.readTextFile('./wise-ca-cert.pem');

  // Fazer requisição com mTLS
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'transfers:send transfers:fund', // Escopos necessários
    }),
    // Configurar mTLS (depende da implementação do Deno)
    // Nota: Deno pode não suportar mTLS nativamente, pode precisar de biblioteca externa
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}
```

**⚠️ NOTA IMPORTANTE**: Deno pode não suportar mTLS nativamente. Pode ser necessário:

- Usar biblioteca externa (ex: `@supabase/functions-js` com suporte a mTLS)
- Ou usar Node.js runtime ao invés de Deno
- Ou usar proxy/gateway que faça mTLS

#### 3. Atualizar WiseClient

```typescript
// src/lib/wise/wise-client.ts

export class WiseClient {
  private accessToken: string; // Ao invés de personalToken
  private baseUrl: string;
  private profileId?: string;
  private cert?: string;
  private key?: string;
  private ca?: string;

  constructor(config: WiseClientConfig) {
    this.accessToken = config.accessToken; // OAuth 2.0 token
    this.profileId = config.profileId;
    this.baseUrl = config.environment === 'sandbox'
      ? 'https://api.wise-sandbox.com'
      : 'https://api.wise.com';
    
    // Certificados para mTLS
    this.cert = config.cert;
    this.key = config.key;
    this.ca = config.ca;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    retries = 3
  ): Promise<T> {
    // Renovar token se necessário (tokens OAuth 2.0 expiram em ~12 horas)
    if (this.isTokenExpired()) {
      this.accessToken = await this.refreshAccessToken();
    }

    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    // Adicionar certificados para mTLS
    const fetchOptions: RequestInit = {
      method,
      headers,
      // ... configuração mTLS
    };

    // ... resto da implementação
  }

  private async refreshAccessToken(): Promise<string> {
    // Implementar renovação de token
    // ...
  }
}
```

---

## 🔄 FLUXO DE CHECKOUT EMBARCADO

### Com OAuth 2.0 + mTLS:

1. **Cliente Seleciona Wise no Checkout**
   - Cliente preenche dados no seu site
   - Seleciona "Wise" como método de pagamento

2. **Sistema Cria Transfer (via API com mTLS)**
   - Sistema obtém access token OAuth 2.0
   - Sistema cria quote, recipient e transfer via API
   - **✅ Transfer pode ser fundado via API** (diferente do Personal Token)

3. **Checkout Embarcado**
   - **✅ Cliente NÃO precisa fazer login na Wise**
   - **✅ Pagamento acontece no seu site** (iframe/modal)
   - Cliente preenche dados do cartão diretamente
   - Processamento instantâneo

4. **Webhook Confirma Pagamento**
   - Wise envia webhook quando pagamento é confirmado
   - Sistema atualiza pedido para `payment_status = 'completed'`

---

## 📊 COMPARAÇÃO: PERSONAL TOKEN vs OAUTH 2.0 + MTLS

| Funcionalidade | Personal Token | OAuth 2.0 + mTLS |
|----------------|----------------|------------------|
| **Checkout Embarcado** | ❌ Não | ✅ Sim |
| **Login Cliente Necessário** | ✅ Sim | ❌ Não |
| **Fund Transfer via API** | ❌ Não | ✅ Sim |
| **Aprovação Wise** | ❌ Não precisa | ✅ **OBRIGATÓRIO** |
| **Certificados** | ❌ Não precisa | ✅ **OBRIGATÓRIO** |
| **Complexidade Setup** | ⭐ Simples | ⭐⭐⭐ Complexo |
| **Tempo Setup** | ⏱️ Minutos | ⏱️ **Semanas** |
| **Manutenção** | ⭐ Simples | ⭐⭐ Média (renovação tokens) |

---

## ⚠️ DESAFIOS E LIMITAÇÕES

### 1. Aprovação da Wise

- **Não é automático**: Precisa entrar em contato
- **Pode levar semanas**: Processo de avaliação
- **Pode ser negado**: Wise avalia caso de uso

### 2. Complexidade Técnica

- **mTLS é complexo**: Requer gerenciamento de certificados
- **Renovação de tokens**: Tokens OAuth 2.0 expiram (~12 horas)
- **Deno pode não suportar mTLS nativamente**: Pode precisar de workaround

### 3. Manutenção

- **Certificados expiram**: Precisa renovar periodicamente
- **Tokens expiram**: Precisa implementar refresh logic
- **Mais pontos de falha**: Certificados, tokens, mTLS

---

## 🚀 PLANO DE MIGRAÇÃO

### Fase 1: Contato com Wise (2-4 semanas)

1. ✅ Entrar em contato com Wise (`partners@wise.com`)
2. ✅ Explicar caso de uso e necessidade de checkout embarcado
3. ✅ Preencher formulário de aplicação (se necessário)
4. ✅ Aguardar aprovação

### Fase 2: Configuração Inicial (1 semana)

1. ✅ Receber `client_id` e `client_secret`
2. ✅ Gerar chave privada e CSR
3. ✅ Enviar CSR para Wise e receber certificado assinado
4. ✅ Obter certificado CA da Wise
5. ✅ Configurar variáveis de ambiente no Supabase

### Fase 3: Implementação (1-2 semanas)

1. ✅ Implementar função `getOAuth2AccessToken()`
2. ✅ Atualizar `WiseClient` para usar OAuth 2.0
3. ✅ Implementar lógica de renovação de tokens
4. ✅ Configurar mTLS nas requisições
5. ✅ Testar em sandbox

### Fase 4: Testes e Deploy (1 semana)

1. ✅ Testes completos em sandbox
2. ✅ Migrar para production
3. ✅ Monitorar logs e erros
4. ✅ Documentar processo

**Tempo Total Estimado**: **5-8 semanas**

---

## 💡 ALTERNATIVAS

### Se Aprovação da Wise Demorar ou For Negada:

1. **Manter Personal Token**:
   - ✅ Funciona hoje
   - ✅ Sem aprovação necessária
   - ❌ Cliente precisa fazer login na Wise

2. **Usar Stripe como Principal**:
   - ✅ Checkout embarcado já funciona
   - ✅ Sem aprovação necessária
   - ✅ Taxas mais altas que Wise

3. **Híbrido**:
   - Stripe para checkout embarcado (principal)
   - Wise para clientes que preferem (redirect flow)

---

## 📝 CHECKLIST DE MIGRAÇÃO

### Pré-requisitos:
- [ ] Contato com Wise estabelecido
- [ ] Aprovação recebida
- [ ] `client_id` e `client_secret` recebidos
- [ ] Certificados gerados e configurados

### Implementação:
- [ ] Função `getOAuth2AccessToken()` implementada
- [ ] Lógica de renovação de tokens implementada
- [ ] `WiseClient` atualizado para OAuth 2.0
- [ ] mTLS configurado nas requisições
- [ ] Variáveis de ambiente configuradas no Supabase

### Testes:
- [ ] Testes em sandbox completos
- [ ] Checkout embarcado funcionando
- [ ] Webhooks funcionando
- [ ] Renovação de tokens funcionando

### Deploy:
- [ ] Migração para production
- [ ] Monitoramento configurado
- [ ] Documentação atualizada

---

## 🔗 LINKS ÚTEIS

### Links Oficiais da Wise (Documentação Completa):
📖 **Veja documento completo com todos os links oficiais**: [`WISE_LINKS_OFICIAIS_CHECKOUT_EMBARCADO.md`](./WISE_LINKS_OFICIAIS_CHECKOUT_EMBARCADO.md)

### Links Principais:
- **Wise Partner Account Guide**: https://docs.wise.com/api-docs/guides/partner-account
- **Wise mTLS Guide**: https://docs.wise.com/guides/developer/auth-and-security/mtls
- **Wise Embedded Checkout Auth**: https://docs.wise.com/guides/product/send-money/use-cases/embedded/authentication-and-access
- **Wise API Reference**: https://docs.wise.com/api-reference/
- **Wise Developer Hub**: https://wise.com/developer
- **Contato Wise (Parceiros)**: `partnerwise@wise.com`

---

## ✅ CONCLUSÃO

**Para ter checkout embarcado igual ao Stripe:**

1. ✅ **É possível**, mas requer **OAuth 2.0 + mTLS**
2. ⚠️ **Requer aprovação da Wise** (não é automático)
3. ⏱️ **Pode levar semanas** para configurar
4. 🔧 **É mais complexo** que Personal Token

**Recomendação**:
- Se checkout embarcado é **crítico**: Inicie processo de aprovação com Wise
- Se checkout embarcado é **desejável mas não crítico**: Mantenha Personal Token por enquanto
- Considere **híbrido**: Stripe (embarcado) + Wise (redirect) para dar opções ao cliente

---

**Última atualização**: 2026-01-12
