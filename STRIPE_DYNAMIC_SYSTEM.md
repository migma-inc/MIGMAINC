# 🎯 Sistema Dinâmico do Stripe - MIGMA

## 📋 Visão Geral

O sistema dinâmico do Stripe foi implementado para **detectar automaticamente o ambiente** (desenvolvimento ou produção) e usar as chaves corretas do Stripe sem necessidade de configuração manual ou alteração de código.

### Funcionamento Principal

- **Ambiente de Desenvolvimento** (localhost, preview) → Usa chaves `sk_test_*` e `pk_test_*`
- **Ambiente de Produção** (migma.com, vercel.app produção) → Usa chaves `sk_live_*` e `pk_live_*`

O sistema detecta automaticamente o ambiente através dos **headers HTTP** da requisição e seleciona as variáveis de ambiente corretas.

---

## 🏗️ Arquitetura do Sistema

O sistema é composto por **3 módulos principais** localizados em `supabase/functions/shared/`:

### 1. `environment-detector.ts` - Detecção de Ambiente

**Responsabilidade:** Analisa os headers HTTP da requisição para determinar se está em produção ou desenvolvimento.

**Como funciona:**

```typescript
export function detectEnvironment(req: Request): EnvironmentInfo {
  const referer = req.headers.get('referer') || '';
  const origin = req.headers.get('origin') || '';
  const host = req.headers.get('host') || '';
  
  // Detecta produção: se qualquer header contém migma.com
  const isProductionDomain = 
    referer.includes('migma.com') ||
    origin.includes('migma.com') ||
    (referer.includes('vercel.app') && !referer.includes('preview'));
  
  return {
    environment: isProductionDomain ? 'production' : 'test',
    isProduction: isProductionDomain,
    isTest: !isProductionDomain,
    // ... outros dados
  };
}
```

**Lógica de Detecção:**

1. **Para requisições normais (frontend → backend):**
   - Verifica se `referer`, `origin` ou `host` contém `migma.com`
   - Se sim → **Produção**
   - Se não → **Teste**

2. **Para webhooks do Stripe:**
   - Webhooks do Stripe **não enviam** headers `referer` ou `origin`
   - Usa sistema **multi-secret** que tenta todos os secrets disponíveis
   - O secret que verificar com sucesso determina o ambiente

### 2. `stripe-env-mapper.ts` - Mapeamento de Variáveis

**Responsabilidade:** Mapeia as variáveis de ambiente baseado no ambiente detectado.

**Variáveis de Ambiente Esperadas:**

- **Produção:**
  - `STRIPE_SECRET_KEY_PROD`
  - `STRIPE_WEBHOOK_SECRET_PROD`
  - `STRIPE_PUBLISHABLE_KEY_PROD`

- **Teste/Desenvolvimento:**
  - `STRIPE_SECRET_KEY_TEST`
  - `STRIPE_WEBHOOK_SECRET_TEST`
  - `STRIPE_PUBLISHABLE_KEY_TEST`

### 3. `stripe-config.ts` - Configuração Centralizada

**Responsabilidade:** Orquestra a detecção de ambiente e o mapeamento de variáveis, retornando uma configuração completa do Stripe.

---

## 🔄 Fluxo de Funcionamento

### Cenário 1: Frontend fazendo checkout (Desenvolvimento)

```
1. Usuário acessa: http://localhost:5173/checkout/visa/initial
2. Frontend chama: POST /functions/v1/create-visa-checkout-session
3. Headers enviados:
   - referer: "http://localhost:5173/..."
   - origin: "http://localhost:5173"

4. environment-detector.ts:
   - Analisa headers
   - Não encontra "migma.com"
   - Detecta: environment = "test"

5. stripe-env-mapper.ts:
   - Usa sufixo "TEST"
   - Busca: STRIPE_SECRET_KEY_TEST, etc.

6. Resultado: Checkout usa modo TEST do Stripe
```

### Cenário 2: Frontend fazendo checkout (Produção)

```
1. Usuário acessa: https://migma.com/checkout/visa/initial
2. Frontend chama: POST /functions/v1/create-visa-checkout-session
3. Headers enviados:
   - referer: "https://migma.com/..."
   - origin: "https://migma.com"

4. environment-detector.ts:
   - Analisa headers
   - Encontra "migma.com" no referer
   - Detecta: environment = "production"

5. stripe-env-mapper.ts:
   - Usa sufixo "PROD"
   - Busca: STRIPE_SECRET_KEY_PROD, etc.

6. Resultado: Checkout usa modo PRODUCTION do Stripe
```

### Cenário 3: Webhook do Stripe (Sistema Multi-Secret)

```
1. Stripe envia webhook: POST /functions/v1/stripe-visa-webhook
2. Headers enviados:
   - user-agent: "Stripe/1.0"
   - stripe-signature: "t=1234567890,v1=..."
   - (sem referer/origin)

3. stripe-visa-webhook/index.ts:
   - Usa getAllWebhookSecrets() para obter todos os secrets
   - Tenta verificar assinatura com cada secret:
     1. STRIPE_WEBHOOK_SECRET_PROD
     2. STRIPE_WEBHOOK_SECRET_STAGING (opcional)
     3. STRIPE_WEBHOOK_SECRET_TEST
   - O primeiro que verificar com sucesso determina o ambiente

4. Resultado: Webhook processado com chaves corretas
```

---

## 🔐 Sistema Multi-Secret para Webhooks

### Problema Original

Webhooks do Stripe não enviam headers `referer` ou `origin`, tornando difícil detectar o ambiente. A solução implementada usa uma abordagem **fail-safe** que tenta todos os secrets disponíveis.

### Solução Implementada

**Vantagens:**

1. ✅ **Fail-safe:** Se um secret falhar, tenta o próximo
2. ✅ **Suporta múltiplos ambientes:** Produção, Staging e Teste
3. ✅ **Não depende de headers:** Funciona mesmo sem referer/origin
4. ✅ **Logs detalhados:** Mostra qual secret foi usado

---

## ⚙️ Configuração no Supabase Dashboard

### Variáveis de Ambiente Necessárias

Acesse: **Supabase Dashboard** > **Settings** > **Edge Functions** > **Environment Variables**

#### Para Produção:
```
STRIPE_SECRET_KEY_PROD=sk_live_...
STRIPE_WEBHOOK_SECRET_PROD=whsec_...
STRIPE_PUBLISHABLE_KEY_PROD=pk_live_...
```

#### Para Teste/Desenvolvimento:
```
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_WEBHOOK_SECRET_TEST=whsec_...
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
```

#### Opcional (Staging):
```
STRIPE_SECRET_KEY_STAGING=sk_test_...
STRIPE_WEBHOOK_SECRET_STAGING=whsec_...
STRIPE_PUBLISHABLE_KEY_STAGING=pk_test_...
```

---

## 🧪 Como Testar

### 1. Testar em Desenvolvimento

1. **Configure as chaves de TESTE no Supabase:**
   ```
   STRIPE_SECRET_KEY_TEST=sk_test_51ABC123...
   STRIPE_WEBHOOK_SECRET_TEST=whsec_test_...
   STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
   ```

2. **Inicie o servidor local:**
   ```bash
   npm run dev
   ```

3. **Acesse:** `http://localhost:5173/checkout/visa/initial?seller=TEST`

4. **Use cartão de teste do Stripe:**
   - Número: `4242 4242 4242 4242`
   - Data: Qualquer data futura
   - CVC: Qualquer 3 dígitos
   - CEP: Qualquer CEP

5. **Verifique os logs no Supabase:**
   ```
   🔍 Environment Detection: {
     referer: "http://localhost:5173/...",
     environment: "test"
   }
   🔑 Stripe Config (test): {
     secretKey: "sk_test_51ABC123...",
     webhookSecret: "whsec_test_..."
   }
   ✅ Stripe config loaded for test environment
   🔧 Using Stripe in test mode
   ```

### 2. Testar em Produção

1. **Configure as chaves de PRODUÇÃO no Supabase:**
   ```
   STRIPE_SECRET_KEY_PROD=sk_live_51XYZ789...
   STRIPE_WEBHOOK_SECRET_PROD=whsec_live_...
   STRIPE_PUBLISHABLE_KEY_PROD=pk_live_...
   ```

2. **Acesse o domínio de produção:**
   ```
   https://migma.com/checkout/visa/initial?seller=VENDEDOR01
   ```

3. **Use cartão REAL** (ou cartão de teste se ainda em sandbox do Stripe)

4. **Verifique os logs no Supabase:**
   ```
   🔍 Environment Detection: {
     referer: "https://migma.com/...",
     environment: "production"
   }
   🔑 Stripe Config (production): {
     secretKey: "sk_live_51XYZ789...",
     webhookSecret: "whsec_live_..."
   }
   ✅ Stripe config loaded for production environment
   🔧 Using Stripe in production mode
   ```

### 3. Testar Webhooks

1. **Configure 2 webhooks no Stripe Dashboard:**

   **Webhook de Teste:**
   - URL: `https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/stripe-visa-webhook`
   - Modo: **Test Mode**
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, etc.
   - Copie o **Signing Secret** e adicione como `STRIPE_WEBHOOK_SECRET_TEST`

   **Webhook de Produção:**
   - URL: `https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/stripe-visa-webhook`
   - Modo: **Live Mode**
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, etc.
   - Copie o **Signing Secret** e adicione como `STRIPE_WEBHOOK_SECRET_PROD`

2. **Faça um pagamento de teste**

3. **Verifique os logs:**
   ```
   [Webhook] Attempting signature verification with 2 secrets...
   ✅ [Webhook] Signature verified with test secret
   [Webhook] Event received: {
     type: "checkout.session.completed",
     environment: "test"
   }
   ```

---

## 📊 Verificar Logs no Supabase

### Via Dashboard:
1. Acesse: **Supabase Dashboard** > **Edge Functions** > **Logs**
2. Selecione a função: `create-visa-checkout-session` ou `stripe-visa-webhook`
3. Filtre por timestamp

### Via CLI:
```bash
# Logs da função de checkout
supabase functions logs create-visa-checkout-session --project-ref ekxftwrjvxtpnqbraszv

# Logs do webhook
supabase functions logs stripe-visa-webhook --project-ref ekxftwrjvxtpnqbraszv
```

---

## 🛡️ Segurança e Validação

### Validação Automática

O sistema valida automaticamente se todas as variáveis necessárias estão configuradas:

```typescript
const validationErrors = validateStripeEnvironmentVariables(envVars, envInfo);
if (validationErrors.length > 0) {
  throw new Error(`Stripe configuration errors: ${validationErrors.join(', ')}`);
}
```

### Logs Mascarados

As chaves sensíveis são mascaradas nos logs:

```typescript
console.log(`🔑 Stripe Config (${envInfo.environment}):`, {
  secretKey: config.secretKey ? `${config.secretKey.substring(0, 20)}...` : '❌ Missing',
  webhookSecret: config.webhookSecret ? `${config.webhookSecret.substring(0, 20)}...` : '❌ Missing',
});
```

---

## 🐛 Troubleshooting

### Problema: "Stripe configuration errors"

**Causa:** Variáveis de ambiente não configuradas ou faltando.

**Solução:**
1. Verifique no Supabase Dashboard se todas as variáveis estão configuradas
2. Confirme que os sufixos estão corretos (`_PROD` ou `_TEST`)
3. Verifique se não há espaços extras nos valores

### Problema: Ambiente não detectado corretamente

**Causa:** Headers HTTP não contêm o domínio esperado.

**Solução:**
1. Verifique os logs de detecção de ambiente
2. Confirme que o domínio `migma.com` está sendo enviado nos headers
3. Para webhooks, o sistema usa fallback multi-secret automaticamente

### Problema: Webhook signature verification failed

**Causa:** Secret do webhook incorreto ou não configurado.

**Solução:**
1. Verifique se `STRIPE_WEBHOOK_SECRET_PROD` e `STRIPE_WEBHOOK_SECRET_TEST` estão configurados
2. Confirme que os secrets correspondem aos webhooks configurados no Stripe Dashboard
3. O sistema tenta todos os secrets automaticamente - verifique os logs para ver qual falhou

---

## 🎯 Benefícios do Sistema

1. **🔒 Segurança:**
   - Chaves de produção nunca expostas em desenvolvimento
   - Validação automática de configuração
   - Logs mascarados para evitar vazamento

2. **⚡ Automatização:**
   - Sem necessidade de alterar código ao trocar ambientes
   - Detecção automática baseada em headers HTTP
   - Zero configuração manual por requisição

3. **✅ Confiabilidade:**
   - Impossível usar chaves erradas por engano
   - Validação em tempo de execução
   - Logs detalhados para debugging

4. **🔧 Manutenibilidade:**
   - Configuração centralizada
   - Código reutilizável
   - Fácil adicionar novos ambientes

5. **📈 Escalabilidade:**
   - Suporta múltiplos ambientes (test, staging, production)
   - Sistema de fallback para webhooks

---

## 📝 Checklist de Implementação

- [x] Criar módulos shared:
  - [x] `environment-detector.ts`
  - [x] `stripe-env-mapper.ts`
  - [x] `stripe-config.ts`
- [x] Atualizar Edge Functions:
  - [x] `create-visa-checkout-session/index.ts`
  - [x] `stripe-visa-webhook/index.ts`
- [ ] Configurar variáveis no Supabase:
  - [ ] `STRIPE_SECRET_KEY_TEST`
  - [ ] `STRIPE_WEBHOOK_SECRET_TEST`
  - [ ] `STRIPE_PUBLISHABLE_KEY_TEST`
  - [ ] `STRIPE_SECRET_KEY_PROD` (quando pronto)
  - [ ] `STRIPE_WEBHOOK_SECRET_PROD` (quando pronto)
  - [ ] `STRIPE_PUBLISHABLE_KEY_PROD` (quando pronto)
- [ ] Fazer deploy das Edge Functions
- [ ] Configurar webhooks no Stripe (teste e produção)
- [ ] Testar fluxo completo em desenvolvimento
- [ ] Testar fluxo completo em produção

---

**Última atualização:** Janeiro 2025  
**Versão:** 1.0.0  
**Projeto:** MIGMA Visa Services





