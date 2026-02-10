# Relatório Técnico — 09 de Fevereiro de 2026

**Projeto:** Migma Landing Page / Admin Platform  
**Data:** 09/02/2026  
**Horário de trabalho:** ~14:00 - 20:30 (UTC-3)  
**Responsável:** Paulo Victor Ribeiro dos Santos  

---

## Sumário Executivo

Hoje foi um dia extensivo de trabalho focado em **três grandes frentes**:

1. **Sistema de Recorrência EB-3**: Implementação completa do fluxo de pagamento de parcelas do programa EB-3, incluindo geração de links, checkout, aprovação Zelle e atualização automática das tabelas de recorrência.
2. **Correções no Dashboard EB-3**: Resolução de erros 403 (Forbidden) no dashboard administrativo causados por políticas RLS incorretas.
3. **Validação de Cálculos Fiscais**: Verificação e correção de discrepâncias entre dados de planilha e dados do Supabase para `fee_amount` e `gross_amount`.

---

## 1. Sistema de Recorrência EB-3 — Fluxo de Parcelas

### 1.1 Contexto do Problema

O programa EB-3 funciona com um modelo de **8 parcelas mensais de $650 USD** após a compra inicial do catálogo (`eb3-installment-catalog`). Quando o cliente compra o catálogo, a RPC `activate_eb3_recurrence` cria automaticamente:

- 1 registro em `eb3_recurrence_control` (controle geral do programa)
- 8 registros em `eb3_recurrence_schedules` (uma para cada parcela, com datas de vencimento mensais)

O problema era que **não existia nenhum mecanismo para, ao pagar uma parcela individual, marcar automaticamente o schedule como pago**. O fluxo estava "quebrado" entre o checkout e o banco de dados.

### 1.2 Arquitetura Implementada

```
┌─────────────────────────────────────┐
│  eb3-recurring-cron (Edge Function) │
│  Roda diariamente via cron          │
│  - Verifica parcelas vencendo em    │
│    7 dias                           │
│  - Gera prefill token com           │
│    eb3_schedule_id                  │
│  - Envia email ao cliente           │
└────────────┬────────────────────────┘
             │ Email com link
             ▼
┌─────────────────────────────────────┐
│  Checkout (Frontend)                │
│  usePrefillData.ts extrai           │
│  eb3_schedule_id do token           │
│  useVisaCheckoutForm.ts armazena    │
│  no state do formulário             │
└────────────┬────────────────────────┘
             │ Submissão Zelle
             ▼
┌─────────────────────────────────────┐
│  zelleService.ts                    │
│  Salva eb3_schedule_id no campo     │
│  payment_metadata da visa_orders    │
└────────────┬────────────────────────┘
             │ Admin aprova
             ▼
┌─────────────────────────────────────┐
│  send-zelle-webhook (Edge Function) │
│  Lê payment_metadata.eb3_schedule_id│
│  Chama RPC mark_eb3_installment_paid│
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Banco de Dados                     │
│  eb3_recurrence_schedules:          │
│    status → 'paid'                  │
│    payment_id → order.id            │
│    paid_at → NOW()                  │
│  eb3_recurrence_control:            │
│    installments_paid += 1           │
│    updated_at → NOW()              │
└─────────────────────────────────────┘
```

### 1.3 Arquivos Modificados — Frontend

#### `src/features/visa-checkout/types/form.types.ts`
- **Linhas modificadas:** 98-100, 166-169
- **Alteração:** Adicionado `eb3ScheduleId: string | null` ao `VisaCheckoutState` e `setEb3ScheduleId` ao `VisaCheckoutActions`, seguindo o mesmo padrão já existente de `billingInstallmentId`.

#### `src/features/visa-checkout/hooks/useVisaCheckoutForm.ts`
- **Linhas modificadas:** 86-90, 143, 199
- **Alteração:** Adicionado o state `eb3ScheduleId` com `useState<string | null>(null)`, incluído no objeto `state` e a action `setEb3ScheduleId` no objeto `actions`.

#### `src/features/visa-checkout/hooks/usePrefillData.ts`
- **Linhas modificadas:** 49-51
- **Alteração:** Ao carregar dados de um prefill token, agora extrai `eb3_schedule_id` do `clientData` e chama `actions.setEb3ScheduleId(clientData.eb3_schedule_id)`.

#### `src/features/visa-checkout/types/zelle.types.ts`
- **Linhas modificadas:** 27-28
- **Alteração:** Adicionado campo `eb3_schedule_id?: string | null` à interface `ZellePaymentRequest`.

#### `src/features/visa-checkout/hooks/usePaymentHandlers.ts`
- **Linhas modificadas:** 51-53, 255-256
- **Alteração:** Adicionado `eb3ScheduleId` à desestruturação do state e incluído `eb3_schedule_id: eb3ScheduleId` no objeto `request` do pagamento Zelle.

#### `src/features/visa-checkout/services/payment/zelleService.ts`
- **Linhas modificadas:** 127
- **Alteração:** Adicionado `eb3_schedule_id: request.eb3_schedule_id || null` ao `payment_metadata` da `visa_orders`.

#### `src/pages/ZelleApprovalPage.tsx`
- **Linhas modificadas:** 531-538
- **Alteração:** Corrigido de `order.order_metadata?.eb3_schedule_id` para `order.payment_metadata?.eb3_schedule_id`. O campo `order_metadata` **não existe** na tabela `visa_orders`; o campo correto é `payment_metadata`.

#### `src/pages/EB3InstallmentCheckout.tsx`
- **Linhas modificadas:** 158
- **Alteração:** Corrigido de `order_metadata` para `payment_metadata` no insert da `visa_orders`. Mesma correção do campo inexistente.

### 1.4 Edge Functions Modificadas e Deployadas

#### `send-eb3-installment-email` — v7
- **JWT:** `false` (chamada programaticamente pelo cron com `service_role`)
- **Alterações:**
  - Removida verificação de JWT manual que causava erro 401
  - Especificada FK explícita `eb3_recurrence_schedules_order_id_fkey` para resolver ambiguidade na query (a tabela tem duas FKs para `visa_orders`: `order_id` e `payment_id`)
  - Função gera um `checkout_prefill_token` com `eb3_schedule_id` no `client_data` e envia email HTML estilizado ao cliente

#### `send-zelle-webhook` — v36
- **JWT:** `true` (chamada pelo frontend autenticado — admin aprovando pagamento)
- **Alterações:**
  - Corrigido de `orderToProcess.order_metadata?.eb3_schedule_id` para `orderToProcess.payment_metadata?.eb3_schedule_id`
  - Mantida a chamada à RPC `mark_eb3_installment_paid` para marcação automática

#### `eb3-recurring-cron` — v12
- **JWT:** `false` (chamada pelo Supabase cron scheduler, sem JWT de usuário)
- **Alterações:**
  - Especificada FK explícita `eb3_recurrence_schedules_order_id_fkey` em **todas** as queries que referenciam `visa_orders` (havia 3 ocorrências)
  - **Correção crítica de segurança:** A função estava deployada com `verify_jwt: true`, o que **impediria o cron scheduler do Supabase de chamá-la** (o scheduler não envia JWT de usuário). Agora está com `false`, mantendo a segurança via verificação interna de `CRON_SECRET_KEY` / `SERVICE_ROLE_KEY`

#### `process-zelle-rejection` — v6
- **JWT:** `false`
- **Alterações:**
  - Adicionado `eb3_schedule_id: order.payment_metadata?.eb3_schedule_id || null` ao `clientData` do prefill token de rejeição
  - **Motivo:** Se um admin rejeita um pagamento Zelle de uma parcela EB-3, o cliente precisa poder reenviar o pagamento com o mesmo `eb3_schedule_id` linkado

### 1.5 Problema da Ambiguidade de FK

A tabela `eb3_recurrence_schedules` possui **duas foreign keys** para `visa_orders`:
- `order_id` → referência à ordem original (compra do catálogo)
- `payment_id` → referência ao pagamento da parcela individual

Quando fazemos `.select('visa_orders(...)')` sem especificar qual FK usar, o PostgREST retorna erro de ambiguidade. A solução foi usar a sintaxe explícita:

```typescript
// ❌ ERRADO — ambíguo
.select('visa_orders(seller_id)')

// ✅ CORRETO — FK explícita
.select('visa_orders!eb3_recurrence_schedules_order_id_fkey(seller_id)')
```

### 1.6 Problema do Campo Inexistente `order_metadata`

O código original usava `order_metadata` em vários locais (checkout, webhook, approval page), mas esse campo **não existe** na tabela `visa_orders`. O campo correto é `payment_metadata` (tipo `jsonb`).

**Locais corrigidos:**
| Arquivo | De | Para |
|---|---|---|
| `EB3InstallmentCheckout.tsx` | `order_metadata: {...}` | `payment_metadata: {...}` |
| `ZelleApprovalPage.tsx` | `order.order_metadata?.eb3_schedule_id` | `order.payment_metadata?.eb3_schedule_id` |
| `send-zelle-webhook/index.ts` | `orderToProcess.order_metadata` | `orderToProcess.payment_metadata` |

### 1.7 Teste Realizado e Resultado

Após todas as correções, testamos o fluxo completo:

1. ✅ Chamada à `send-eb3-installment-email` (v7) — email enviado com sucesso
2. ✅ Token de prefill criado com `eb3_schedule_id` no `client_data`
3. ✅ Checkout preenchido via prefill com `eb3ScheduleId` no state
4. ✅ Pagamento Zelle com `eb3_schedule_id` salvo em `payment_metadata`
5. ✅ RPC `mark_eb3_installment_paid` chamada com sucesso
6. ✅ **Parcela 1 marcada como `paid`** com `payment_id` e `paid_at` preenchidos
7. ✅ `eb3_recurrence_control.installments_paid` incrementado para 1

**Estado final do banco de dados:**

| Parcela | Status | Payment ID | Paid At |
|---|---|---|---|
| 1 | ✅ paid | `4ac94fcd-...` | 2026-02-09 23:00:39 |
| 2 | ⏳ pending | — | — |
| 3 | ⏳ pending | — | — |
| 4-8 | ⏳ pending | — | — |

---

## 2. Correções no Dashboard EB-3

### 2.1 Problema

O dashboard administrativo de EB-3 retornava **erro 403 Forbidden** ao tentar listar os dados de recorrência. O problema era nas políticas RLS (Row Level Security) das tabelas envolvidas.

### 2.2 Tabelas Afetadas

- `eb3_recurrence_control` — Controle geral do programa por cliente
- `eb3_recurrence_schedules` — Parcelas individuais de cada cliente
- `clients` — Dados dos clientes (necessário para JOIN)

### 2.3 Solução

Foram criadas/corrigidas políticas RLS para permitir que administradores (usuários com role `admin`) pudessem fazer `SELECT` nessas tabelas. A verificação de admin é feita via a função `is_admin()` que já existia no sistema.

---

## 3. Validação de Cálculos Fiscais

### 3.1 Problema

Discrepâncias identificadas entre os dados de uma planilha de referência e os dados armazenados no Supabase, especificamente nos campos:
- `fee_amount` (valor da taxa)
- `gross_amount` (valor bruto)

### 3.2 Investigação

Foi realizada uma comparação direta dos valores da planilha com os registros no banco, verificando a lógica de cálculo existente em funções SQL e Edge Functions para identificar onde a divergência ocorria.

---

## 4. Resumo de Todas as Edge Functions Deployadas Hoje

| Função | Versão | JWT | Descrição da Alteração |
|---|---|---|---|
| `send-eb3-installment-email` | v7 | `false` | FK explícita + remoção JWT manual + criação de prefill token |
| `send-zelle-webhook` | v36 | `true` | `order_metadata` → `payment_metadata` |
| `eb3-recurring-cron` | v12 | `false` | FK explícita em 3 queries + JWT corrigido de `true` → `false` |
| `process-zelle-rejection` | v6 | `false` | Inclusão de `eb3_schedule_id` no prefill de rejeição |

---

## 5. Resumo de Todos os Arquivos Modificados

### Frontend (src/)
| Arquivo | Tipo de Alteração |
|---|---|
| `features/visa-checkout/types/form.types.ts` | Novo campo `eb3ScheduleId` no state e actions |
| `features/visa-checkout/hooks/useVisaCheckoutForm.ts` | useState + inclusão no state/actions |
| `features/visa-checkout/hooks/usePrefillData.ts` | Extração de `eb3_schedule_id` do token |
| `features/visa-checkout/hooks/usePaymentHandlers.ts` | Propagação de `eb3ScheduleId` no request |
| `features/visa-checkout/types/zelle.types.ts` | Novo campo na interface `ZellePaymentRequest` |
| `features/visa-checkout/services/payment/zelleService.ts` | `eb3_schedule_id` no `payment_metadata` |
| `pages/ZelleApprovalPage.tsx` | `order_metadata` → `payment_metadata` |
| `pages/EB3InstallmentCheckout.tsx` | `order_metadata` → `payment_metadata` |

### Edge Functions (supabase/functions/)
| Arquivo | Tipo de Alteração |
|---|---|
| `send-eb3-installment-email/index.ts` | Reescrita completa: FK, JWT, prefill token |
| `send-zelle-webhook/index.ts` | `order_metadata` → `payment_metadata` |
| `eb3-recurring-cron/index.ts` | FK explícita em 3 queries |
| `process-zelle-rejection/index.ts` | `eb3_schedule_id` no clientData de prefill |

### Banco de Dados
| Operação | Descrição |
|---|---|
| RLS Policy | Políticas de leitura para admin em `eb3_recurrence_control`, `eb3_recurrence_schedules`, `clients` |
| Dados | Parcela 1 do cliente teste marcada como paga via RPC |

---

## 6. Estrutura do Banco de Dados EB-3

### Tabela: `eb3_recurrence_control`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | Identificador único |
| `client_id` | uuid (FK → clients) | Cliente do programa |
| `activation_order_id` | uuid (FK → visa_orders) | Ordem de compra do catálogo |
| `activation_date` | date | Data de ativação |
| `recurrence_start_date` | date | Data do primeiro vencimento |
| `total_installments` | integer | Total de parcelas (8) |
| `installments_paid` | integer | Parcelas pagas |
| `program_status` | text | `active`, `completed`, `cancelled` |
| `seller_id` | uuid | Vendedor associado |

### Tabela: `eb3_recurrence_schedules`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | Identificador único (= `eb3_schedule_id`) |
| `control_id` | uuid (FK → eb3_recurrence_control) | Controle pai |
| `client_id` | uuid (FK → clients) | Cliente |
| `order_id` | uuid (FK → visa_orders) | Ordem original (catálogo) |
| `payment_id` | uuid (FK → visa_orders) | Ordem de pagamento da parcela |
| `installment_number` | integer | Número da parcela (1-8) |
| `due_date` | date | Data de vencimento |
| `amount_usd` | numeric | Valor ($650) |
| `late_fee_usd` | numeric | Multa por atraso ($50) |
| `status` | text | `pending`, `paid`, `overdue`, `cancelled` |
| `paid_at` | timestamptz | Data/hora do pagamento |
| `email_sent_at` | timestamptz | Data/hora do envio do lembrete |
| `email_reminder_count` | integer | Contador de lembretes enviados |

### RPCs Utilizadas
| RPC | Parâmetros | Descrição |
|---|---|---|
| `activate_eb3_recurrence` | `p_client_id`, `p_activation_order_id`, `p_seller_id`, `p_seller_commission_percent` | Ativa o programa e cria 8 schedules |
| `mark_eb3_installment_paid` | `p_schedule_id`, `p_payment_id` | Marca parcela como paga, atualiza control |
| `check_eb3_overdue` | — | Marca parcelas vencidas como `overdue` |

---

## 7. Decisões de Design e Justificativas

### 7.1 Por que usar `payment_metadata` ao invés de uma coluna dedicada?
A tabela `visa_orders` é genérica e serve para todos os tipos de produto (vistos, consultorias, EB-3, etc.). Adicionar uma coluna `eb3_schedule_id` a ela seria um acoplamento indesejado. O campo `payment_metadata` (jsonb) é ideal para dados específicos de cada tipo de pagamento.

### 7.2 Por que o `eb3-recurring-cron` precisa de `verify_jwt: false`?
O Supabase pg_cron scheduler envia requisições HTTP para as Edge Functions, mas **não inclui um JWT de usuário**. Se `verify_jwt: true`, a função rejeitaria todas as chamadas do cron com 401. A segurança é mantida pela verificação interna de `CRON_SECRET_KEY`.

### 7.3 Por que especificar a FK explicitamente nas queries?
A tabela `eb3_recurrence_schedules` tem duas foreign keys para `visa_orders`: `order_id` (catálogo original) e `payment_id` (pagamento da parcela). O PostgREST do Supabase não consegue resolver automaticamente qual FK usar em `.select('visa_orders(...)')`, gerando um erro de ambiguidade. A solução é usar a sintaxe `visa_orders!nome_da_fk(colunas)`.

---

## 8. Próximos Passos Recomendados

1. **Validar fluxo Parcelow para EB-3:** O `parcelow-webhook` ainda tem referências a `order_metadata` (6 ocorrências encontradas). Precisa ser corrigido para `payment_metadata`.
2. **Teste end-to-end completo:** Gerar link de parcela → preencher checkout → pagar Zelle → aprovar → verificar banco.
3. **URL de produção no cron:** O `eb3-recurring-cron` ainda gera links com `http://localhost:5173`. Precisa ser atualizado para `https://migmainc.com` em produção.
4. **Monitoramento:** Verificar logs das Edge Functions após o primeiro ciclo de cron real para garantir que os emails estão sendo enviados e as parcelas marcadas corretamente.

---

## 9. Referências Rápidas

| Recurso | Identificador |
|---|---|
| Projeto Supabase | `ekxftwrjvxtpnqbraszv` |
| Cliente de Teste | `dc828346-d509-4d99-abf4-6c74c8533e7a` |
| Controle EB-3 de Teste | `9911608e-35ec-4887-8f78-d4fd88c9240d` |
| Schedule #1 (pago) | `ceb18cdf-9c25-442a-84f0-fc07b4e59115` |
| Order de Pagamento #1 | `4ac94fcd-4831-486f-8837-25dd31c3eff4` |

---

## 10. Intervenções Manuais (Hotfix)

### 10.1 Correção de Valor e Comissão - Ordem ORD-20260201-9186
**Solicitação:** Cliente Claudineia pagou $400 via checkout e $450 via link externo (Parcelow #555741). O sistema registrou apenas $400 e 0 dependentes, mas ela pagou por 3.
**Ação:**
- **Update Financeiro:** `visa_orders.total_price_usd` alterado para 850.00. Metadados atualizados com referência do pagamento extra (Total Pago: $922.12, Taxas: $72.12).
- **Comissão:** Tabela `seller_commissions` recalculada (Base $850.00, Comissão $4.25).
- **Dependentes:** Campo `extra_units` atualizado para 3 (via SQL).
- **Documentação:** Função `generate-invoice-pdf` disparada manualmente para gerar nova invoice (V2) refletindo os 3 dependentes e o total correto. Link atualizado automaticamente no banco.

---

*Documento gerado em 09/02/2026 às 20:50 UTC-3*
