# 💳 Guia de Integração Square Payment Gateway - MIGMA

## 📋 O que é o Square?

O **Square** (squareup.com) é uma plataforma de pagamento completa que oferece soluções para processar transações **online e presenciais**, similar ao Stripe, mas com foco adicional em:

- ✅ **Pagamentos presenciais** (terminais POS, leitores de cartão)
- ✅ **Pagamentos online** (API, SDKs)
- ✅ **Gestão de clientes** e CRM integrado
- ✅ **Faturamento digital**
- ✅ **Relatórios e analytics** avançados

---

## 🔄 Square vs Stripe - Comparação

### **Stripe (Atual no Projeto)**
- ✅ Foco em **pagamentos online**
- ✅ Excelente para **e-commerce** e **SaaS**
- ✅ Suporta **PIX** (Brasil)
- ✅ Webhooks robustos
- ✅ Taxas: ~2.9% + $0.30 (online)
- ✅ **Já implementado** no projeto

### **Square**
- ✅ Foco em **pagamentos presenciais + online**
- ✅ Excelente para **vendas físicas** e **híbridas**
- ✅ **Não suporta PIX** (limitado a EUA, Canadá, Reino Unido, Austrália, Japão)
- ✅ Webhooks disponíveis
- ✅ Taxas: ~2.6% + $0.10 (presencial) | 2.9% + $0.30 (online)
- ❌ **Não disponível no Brasil** para pagamentos online

---

## ⚠️ **IMPORTANTE: Limitação Geográfica**

### **Square NÃO está disponível no Brasil para:**
- ❌ Pagamentos online via API
- ❌ Processamento de cartões brasileiros
- ❌ Integração com bancos brasileiros

### **Square está disponível em:**
- ✅ **Estados Unidos**
- ✅ **Canadá**
- ✅ **Reino Unido**
- ✅ **Austrália**
- ✅ **Japão**

### **Conclusão:**
**Para o projeto MIGMA (focado em Brasil com PIX), o Square NÃO é uma opção viável** porque:
1. Não processa pagamentos no Brasil
2. Não suporta PIX
3. Não aceita cartões brasileiros

---

## 💡 **Alternativas ao Square para o Brasil**

Se você quiser **adicionar outro gateway além do Stripe**, considere:

### **1. Mercado Pago** ⭐ RECOMENDADO
- ✅ **Disponível no Brasil**
- ✅ Suporta **PIX, Cartão, Boleto**
- ✅ Taxas competitivas
- ✅ API robusta
- ✅ Webhooks

### **2. PagSeguro**
- ✅ **Disponível no Brasil**
- ✅ Suporta **PIX, Cartão, Boleto**
- ✅ Taxas: ~3.99% + R$0.40
- ✅ API disponível

### **3. Asaas**
- ✅ **Disponível no Brasil**
- ✅ Foco em **PIX e Boleto**
- ✅ Taxas baixas para PIX
- ✅ API simples

### **4. Gerencianet (Efí)**
- ✅ **Disponível no Brasil**
- ✅ Foco em **PIX e Boleto**
- ✅ Taxas competitivas
- ✅ API robusta

---

## 🏗️ **Como Integrar Square (Se Expandir para EUA/Canadá)**

Se no futuro você quiser expandir para **Estados Unidos ou Canadá**, aqui está como integrar o Square:

### **1. Criar Conta no Square**

1. Acesse: https://squareup.com
2. Crie uma conta comercial
3. Complete a verificação de identidade
4. Obtenha as **API Keys**:
   - **Application ID** (público)
   - **Access Token** (secreto)
   - **Location ID** (ID da sua localização)

### **2. Instalar SDK do Square**

```bash
npm install squareup
```

### **3. Configurar Variáveis de Ambiente no Supabase**

No **Supabase Dashboard → Project Settings → Edge Functions → Secrets**:

```bash
# Square Configuration
SQUARE_APPLICATION_ID=your_app_id
SQUARE_ACCESS_TOKEN=your_access_token
SQUARE_LOCATION_ID=your_location_id
SQUARE_ENVIRONMENT=sandbox  # ou 'production'
```

### **4. Criar Edge Function para Square**

**Arquivo:** `supabase/functions/create-square-payment/index.ts`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Client, Environment } from 'squareup';

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const {
      amount,
      currency,
      sourceId, // Token do cartão (obtido via Square.js no frontend)
      orderId,
      customerEmail,
    } = await req.json();

    // Get Square configuration
    const applicationId = Deno.env.get("SQUARE_APPLICATION_ID");
    const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
    const locationId = Deno.env.get("SQUARE_LOCATION_ID");
    const environment = Deno.env.get("SQUARE_ENVIRONMENT") || "sandbox";

    if (!applicationId || !accessToken || !locationId) {
      return new Response(
        JSON.stringify({ error: "Square configuration missing" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize Square client
    const squareClient = new Client({
      environment: environment === "production" ? Environment.Production : Environment.Sandbox,
      accessToken: accessToken,
    });

    // Create payment
    const paymentsApi = squareClient.paymentsApi;
    const paymentRequest = {
      sourceId: sourceId,
      idempotencyKey: `${orderId}-${Date.now()}`, // Unique key
      amountMoney: {
        amount: amount, // Amount in cents
        currency: currency || "USD",
      },
      customerId: customerEmail, // Optional: link to customer
    };

    const { result, statusCode } = await paymentsApi.createPayment(paymentRequest);

    if (statusCode !== 200 || !result.payment) {
      return new Response(
        JSON.stringify({ error: "Payment failed", details: result }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment: {
          id: result.payment.id,
          status: result.payment.status,
          amount: result.payment.amountMoney?.amount,
          currency: result.payment.amountMoney?.currency,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("[Square Payment] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
```

### **5. Frontend - Integrar Square.js**

**Arquivo:** `src/components/payment/SquarePayment.tsx`

```typescript
import { useEffect, useRef } from 'react';
import { loadSquare } from '@square/web-sdk';

interface SquarePaymentProps {
  applicationId: string;
  locationId: string;
  amount: number;
  currency: string;
  onSuccess: (paymentToken: string) => void;
  onError: (error: Error) => void;
}

export const SquarePayment = ({
  applicationId,
  locationId,
  amount,
  currency,
  onSuccess,
  onError,
}: SquarePaymentProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const paymentsRef = useRef<any>(null);

  useEffect(() => {
    const initializeSquare = async () => {
      try {
        const payments = await loadSquare(applicationId, locationId);
        paymentsRef.current = payments;

        if (cardRef.current) {
          const card = await payments.card();
          await card.attach(cardRef.current);
          
          // Handle payment
          const paymentRequest = {
            amountMoney: {
              amount: amount,
              currency: currency,
            },
          };

          const tokenResult = await card.tokenize();
          if (tokenResult.status === 'OK') {
            onSuccess(tokenResult.token);
          } else {
            onError(new Error(tokenResult.errors?.[0]?.detail || 'Payment failed'));
          }
        }
      } catch (error) {
        onError(error instanceof Error ? error : new Error('Failed to initialize Square'));
      }
    };

    initializeSquare();
  }, [applicationId, locationId, amount, currency, onSuccess, onError]);

  return (
    <div>
      <div id="square-card" ref={cardRef}></div>
      <button onClick={() => paymentsRef.current?.card?.tokenize()}>
        Pay ${(amount / 100).toFixed(2)}
      </button>
    </div>
  );
};
```

---

## 📊 **Comparação: Stripe vs Square vs Mercado Pago**

| Recurso | Stripe | Square | Mercado Pago |
|---------|--------|--------|--------------|
| **Disponível no Brasil** | ✅ Sim | ❌ Não | ✅ Sim |
| **Suporta PIX** | ✅ Sim | ❌ Não | ✅ Sim |
| **Suporta Cartão** | ✅ Sim | ✅ Sim* | ✅ Sim |
| **Taxas Online** | 2.9% + $0.30 | 2.9% + $0.30 | ~4.99% + R$0.40 |
| **Taxas PIX** | ~1% | ❌ | ~1.99% |
| **Webhooks** | ✅ Sim | ✅ Sim | ✅ Sim |
| **API Documentação** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Fácil Integração** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

*Square só aceita cartões em países onde está disponível (não inclui Brasil)

---

## 🎯 **Recomendação para MIGMA**

### **Opção 1: Manter apenas Stripe** ⭐ RECOMENDADO
- ✅ Já está implementado e funcionando
- ✅ Suporta PIX e Cartão
- ✅ Taxas competitivas
- ✅ Excelente documentação
- ✅ Webhooks robustos

### **Opção 2: Adicionar Mercado Pago como alternativa**
- ✅ Mais opções de pagamento para clientes
- ✅ Alguns clientes preferem Mercado Pago
- ✅ Pode aumentar conversão
- ⚠️ Requer implementação adicional
- ⚠️ Mais complexidade de manutenção

### **Opção 3: Square (apenas se expandir para EUA/Canadá)**
- ✅ Excelente para vendas presenciais
- ✅ Boa opção se abrir escritório físico
- ❌ **Não funciona no Brasil**
- ❌ Não suporta PIX

---

## 📝 **Próximos Passos**

1. **Decidir se quer adicionar outro gateway:**
   - Se sim → Considerar **Mercado Pago** (melhor para Brasil)
   - Se não → Manter apenas **Stripe**

2. **Se escolher Mercado Pago:**
   - Criar conta no Mercado Pago
   - Obter credenciais de API
   - Implementar Edge Function similar ao Stripe
   - Adicionar opção no checkout

3. **Se escolher Square:**
   - ⚠️ **Só funciona se expandir para EUA/Canadá**
   - Criar conta no Square
   - Implementar usando o código exemplo acima

---

## 🔗 **Links Úteis**

- **Square Developer Docs:** https://developer.squareup.com/docs
- **Square API Reference:** https://developer.squareup.com/reference/square
- **Mercado Pago Developers:** https://www.mercadopago.com.br/developers
- **Stripe Docs (atual):** https://stripe.com/docs

---

## ❓ **Perguntas Frequentes**

**Q: Posso usar Square no Brasil?**  
A: Não, Square não processa pagamentos no Brasil. Apenas EUA, Canadá, Reino Unido, Austrália e Japão.

**Q: Square suporta PIX?**  
A: Não, Square não suporta PIX. Apenas cartões e outras formas de pagamento dos países onde opera.

**Q: Vale a pena adicionar outro gateway além do Stripe?**  
A: Depende. Se você quer mais opções para clientes brasileiros, considere Mercado Pago. Se está satisfeito com Stripe, mantenha apenas ele.

**Q: Posso usar Square e Stripe juntos?**  
A: Sim, mas Square só funcionaria para clientes de países onde está disponível. Para Brasil, continuaria usando Stripe.

---

**Última atualização:** 2025-01-15






