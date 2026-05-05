# Relatório Técnico - 05/05/2026

## TASK: Análise e Simplificação do Fluxo de Scholarship Maintenance Fee

### Objetivo
Analisar a necessidade de contrato, nome completo e selfie no link de pagamento do "Scholarship Maintenance Fee" e simplificar o processo conforme solicitado pelo cliente. Além disso, tratar os avisos de segurança de RLS (Row Level Security).

### Ações Realizadas

#### 1. Análise do Fluxo Atual
- Identificamos que o produto `scholarship-maintenance-fee` estava seguindo o fluxo padrão de vistos, que exige 3 passos:
    - **Passo 1:** Informações Pessoais (completas, incluindo endereço, estado civil, etc).
    - **Passo 2:** Documentos (Upload de ID e Selfie).
    - **Passo 3:** Termos e Pagamento (Assinatura Digital).
- Para parcelas recorrentes (via token prefill), o sistema já pulava o Passo 2, mas para links gerais do produto, o fluxo completo era mantido.

#### 2. Simplificação do Frontend
- **Validação:** Atualizamos `src/lib/visa-checkout-validation.ts` para tratar o `scholarship-maintenance-fee` como um fluxo simplificado (exigindo apenas Nome, Email e WhatsApp).
- **Navegação:** Alteramos `VisaCheckoutPage.tsx` e `Step1PersonalInfo.tsx` para marcar este produto como `isSpecialFlow`, o que faz com que o sistema pule automaticamente o **Passo 2 (Documentos/Selfie)**.
- **Passo 3 (Pagamento):** Modificamos `Step3Payment.tsx` para substituir a exigência de assinatura digital e selfie por um checkbox simples de "Termos e Condições" especificamente para o produto de manutenção de bolsa. Isso remove a fricção de ter que desenhar a assinatura ou subir selfie para um serviço recorrente.

#### 3. Backend e Recorrência (Correção Stripe)
- Identificamos que o webhook do Stripe (`stripe-visa-webhook`) não possuía a lógica de ativação de recorrência para bolsas de estudo, ao contrário dos webhooks do Square e Parcelow.
- Implementamos a chamada ao RPC `activate_scholarship_recurrence` no Stripe para garantir que pagamentos feitos via esse gateway também ativem o ciclo mensal automaticamente.
- Fizemos o deploy da função atualizada para produção.

#### 4. Segurança (Row Level Security - RLS)
- Note: O ajuste de RLS foi revertido conforme solicitado pelo usuário para manter a compatibilidade atual.

### Conclusão
O fluxo de "Scholarship Maintenance Fee" agora é o mais enxuto possível:
1. Usuário informa dados básicos.
2. Pula upload de documentos.
3. Aceita os termos via checkbox e paga.
4. A recorrência é ativada automaticamente no backend (agora funcionando em Stripe, Square e Parcelow).

---
**Status:** Concluído (Simplificação e Automação de Recorrência).
