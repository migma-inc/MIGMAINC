# 💳 Como Funciona o Pagamento Wise - Diferenças do Stripe

**Data**: 2026-01-12

---

## 🔄 WISE vs STRIPE: Diferenças Principais

### Stripe (Checkout Embarcado)
- ✅ Cliente **NÃO precisa** criar conta no Stripe
- ✅ Pagamento acontece **dentro do seu site** (iframe/modal)
- ✅ Cliente preenche dados do cartão diretamente no checkout
- ✅ Processamento instantâneo
- ✅ Você controla toda a experiência do usuário

### Wise (Redirect Flow)
- ⚠️ Cliente **PRECISA** fazer login na plataforma Wise (ou criar conta)
- ⚠️ Cliente é **redirecionado** para o site da Wise
- ⚠️ Pagamento acontece **na plataforma Wise**
- ⚠️ Cliente volta para seu site após pagamento
- ⚠️ Você tem menos controle sobre a experiência do usuário

---

## 📋 POR QUE O WISE FUNCIONA ASSIM?

### Limitação do Personal Token

Com **Personal API Token** (o que estamos usando), há uma limitação importante:

**❌ NÃO podemos fundar transfers via API automaticamente**

Isso significa:
- Não podemos debitar o cartão do cliente diretamente
- Não podemos processar o pagamento sem interação do cliente
- O cliente precisa fazer o pagamento manualmente na plataforma Wise

### Por que isso acontece?

**Regulamentação PSD2 (Europa)**:
- Requer autenticação forte do cliente (2FA)
- Requer consentimento explícito para cada pagamento
- Não pode ser automatizado completamente via API com Personal Token

---

## 🔄 FLUXO COMPLETO DO PAGAMENTO WISE

### 1. Cliente Seleciona Wise no Checkout
- Cliente preenche dados do pedido no seu site
- Seleciona "Wise" como método de pagamento
- Clica em "Pay with Wise"

### 2. Sistema Cria Transfer no Wise
- Seu sistema cria uma **quote** (cotação)
- Cria um **recipient** (conta da Migma que recebe)
- Cria um **transfer** (transferência)
- Obtém URL de pagamento: `https://wise.com/payments/{transfer_id}`

### 3. Cliente é Redirecionado para Wise
- Cliente é redirecionado para: `https://wise.com/login?redirectUrl=/payments/{transfer_id}`
- **Se já tem conta Wise**: Faz login
- **Se não tem conta**: Precisa criar conta primeiro

### 4. Cliente Completa Pagamento na Wise
- Cliente escolhe método de pagamento (cartão, transferência bancária, etc.)
- Completa o pagamento na plataforma Wise
- Wise processa o pagamento

### 5. Webhook Confirma Pagamento
- Wise envia webhook para seu sistema quando pagamento é confirmado
- Seu sistema atualiza o pedido para `payment_status = 'completed'`
- PDF de contrato é gerado automaticamente
- Email de confirmação é enviado

---

## ⚠️ IMPLICAÇÕES PARA O CLIENTE

### Cliente Precisa:
1. ✅ Ter conta Wise OU criar conta durante o processo
2. ✅ Fazer login na plataforma Wise
3. ✅ Completar pagamento na plataforma Wise
4. ✅ Voltar para seu site após pagamento

### Cliente NÃO Precisa:
- ❌ Ter cartão de crédito (pode usar transferência bancária)
- ❌ Ter conta bancária nos EUA
- ❌ Fazer transferência manual (como Zelle)

---

## 🆚 COMPARAÇÃO: STRIPE vs WISE vs ZELLE

| Aspecto | Stripe | Wise | Zelle |
|---------|--------|------|-------|
| **Criação de Conta** | ❌ Não precisa | ✅ Precisa (Wise) | ❌ Não precisa |
| **Login Necessário** | ❌ Não | ✅ Sim (Wise) | ❌ Não |
| **Onde Paga** | No seu site | Plataforma Wise | Manual (upload comprovante) |
| **Processamento** | Automático | Automático | Manual |
| **Taxas** | 3.9% + $0.30 | Variável (~0.4-1.8%) | Sem taxa |
| **Velocidade** | Instantâneo | 1-3 dias úteis | Manual |
| **Experiência** | Melhor (embarcado) | Boa (redirect) | Pior (manual) |

---

## 💡 VANTAGENS DO WISE

Apesar de exigir login, o Wise tem vantagens:

1. ✅ **Taxas mais baixas** que Stripe para valores maiores
2. ✅ **Suporta múltiplas moedas** e métodos de pagamento
3. ✅ **Processamento automático** (não precisa verificar manualmente como Zelle)
4. ✅ **Ideal para clientes internacionais** que já usam Wise
5. ✅ **Webhook automático** confirma pagamento

---

## 🔧 COMO MELHORAR A EXPERIÊNCIA

### Opções Futuras:

1. **OAuth 2.0 + mTLS** (requer aprovação da Wise):
   - ✅ **Permite checkout embarcado** (igual ao Stripe)
   - ✅ Cliente **NÃO precisa** fazer login na Wise
   - ✅ Pagamento acontece **dentro do seu site**
   - ⚠️ Requer contato com Wise e aprovação (2-4 semanas)
   - ⚠️ Requer configuração de certificados (mTLS)
   - 📖 **Guia completo**: [`WISE_CHECKOUT_EMBARCADO_OAUTH_MTLS.md`](./WISE_CHECKOUT_EMBARCADO_OAUTH_MTLS.md)

2. **Wise Business API** (se disponível):
   - Pode oferecer mais opções de integração
   - Requer conta Business verificada

3. **Manter Personal Token** (atual):
   - Mais simples de configurar
   - Não requer aprovação
   - Cliente precisa fazer login na Wise

---

## 📝 NOTAS IMPORTANTES

### Para o Cliente:
- **Se já tem conta Wise**: Processo é rápido (apenas login)
- **Se não tem conta**: Precisa criar conta (pode levar alguns minutos)
- **Após pagamento**: Volta automaticamente para seu site

### Para Você (Desenvolvedor):
- ✅ Transfer é criado automaticamente
- ✅ Webhook confirma pagamento automaticamente
- ✅ Não precisa verificar manualmente
- ⚠️ Cliente precisa fazer login na Wise (não pode evitar isso)

---

## ✅ CONCLUSÃO

**Sim, o Wise funciona diferente do Stripe:**

- **Stripe**: Checkout embarcado, sem login necessário
- **Wise**: Redirect para plataforma Wise, login necessário

**Isso é uma limitação do Personal Token**, mas é o método mais simples de implementar sem precisar de aprovação da Wise.

**Se quiser checkout embarcado** (igual ao Stripe), seria necessário migrar para **OAuth 2.0 + mTLS**. 

📖 **Veja o guia completo**: [`WISE_CHECKOUT_EMBARCADO_OAUTH_MTLS.md`](./WISE_CHECKOUT_EMBARCADO_OAUTH_MTLS.md)

**Resumo do processo**:
- Contato com Wise (`partners@wise.com`)
- Aprovação da aplicação (2-4 semanas)
- Configuração de certificados (mTLS)
- Implementação técnica (1-2 semanas)
- **Tempo total estimado**: 5-8 semanas

---

**Última atualização**: 2026-01-12
