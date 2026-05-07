# Zelle Application Fee — Aprovação Cross-System (Migma → MatriculaUSA)

> **Documento de especificação técnica**  
> **Data:** 2026-04-28  
> **Contexto:** Alunos da Migma pagam a *application fee* via Zelle. Em vez de validar o comprovante localmente na Migma, o comprovante é enviado para o webhook global do MatriculaUSA (`zelle-global`), e a aprovação acontece no **dashboard admin do MatriculaUSA**. Quando aprovado lá, **ambos os sistemas são marcados como pagos**.

---

## 1. Visão Geral do Fluxo

```
[Aluno na Migma]
      │
      │  1. Faz upload do comprovante Zelle
      │
      ▼
[Migma Frontend]
      │
      │  2. Envia comprovante para MatriculaUSA
      │     POST https://nwh.suaiden.com/webhook/zelle-global
      │     (payload inclui source="migma" + IDs do aluno/application)
      │
      ▼
[MatriculaUSA n8n / zelle-global]
      │
      │  3. Salva pagamento na tabela `zelle_payments` do MatriculaUSA
      │     status = pending_verification
      │
      ▼
[Admin MatriculaUSA — Dashboard]
      │
      │  4. Admin visualiza e aprova (ou rejeita) o pagamento
      │
      ▼
[MatriculaUSA — approveZelleFlow]
      │
      │  5a. Marca pagamento como aprovado no DB do MatriculaUSA
      │  5b. Chama callback da Migma:
      │      POST https://<migma-supabase>.supabase.co/functions/v1/migma-approve-application-fee
      │
      ▼
[Migma — Edge Function: migma-approve-application-fee]
      │
      │  6a. Marca institution_applications.is_application_fee_paid = true
      │  6b. Marca application_fee_zelle_pending.status = 'approved'
      │  6c. Notifica o aluno (WhatsApp / Email)
```

---

## 2. O que a Migma faz

### 2.1 Upload do comprovante

Ao aluno selecionar o arquivo Zelle na tela de *Application Fee*:

1. Upload da imagem para o **Supabase Storage da Migma** (bucket `application-fee-proofs`)
2. Obter a `publicUrl` do arquivo
3. Criar registro em `application_fee_zelle_pending` com `status = 'pending_verification'`

### 2.2 Envio para o MatriculaUSA

POST para `https://nwh.suaiden.com/webhook/zelle-global` com o seguinte payload:

```json
{
  "source": "migma",
  "fee_type": "application_fee",
  "image_url": "<publicUrl do comprovante>",
  "amount": 150.00,
  "currency": "USD",
  "timestamp": "2026-04-28T12:00:00Z",
  "migma_application_id": "<institution_applications.id>",
  "migma_profile_id": "<user_profiles.id da Migma>",
  "migma_user_id": "<auth.users.id da Migma>",
  "migma_student_name": "Nome do Aluno",
  "migma_student_email": "aluno@email.com"
}
```

> **Nota:** Não há validação automática (sem n8n AI). O pagamento fica sempre `pending_verification` até o admin do MatriculaUSA aprovar manualmente.

### 2.3 Edge Function: `migma-approve-application-fee`

A Migma expõe um endpoint que o MatriculaUSA chama após a decisão do admin:

**URL:** `https://<migma-supabase>.supabase.co/functions/v1/migma-approve-application-fee`  
**Method:** POST  
**Auth:** Header `x-migma-webhook-secret: <shared-secret>`

**Payload de aprovação:**
```json
{
  "action": "approved",
  "migma_application_id": "<institution_applications.id>",
  "migma_profile_id": "<user_profiles.id>",
  "migma_user_id": "<auth.users.id>",
  "matriculausa_payment_id": "<zelle_payments.id do MatriculaUSA>",
  "approved_by": "Nome do Admin"
}
```

**Payload de rejeição:**
```json
{
  "action": "rejected",
  "migma_application_id": "<institution_applications.id>",
  "migma_profile_id": "<user_profiles.id>",
  "migma_user_id": "<auth.users.id>",
  "matriculausa_payment_id": "<zelle_payments.id do MatriculaUSA>",
  "rejection_reason": "Comprovante ilegível",
  "rejected_by": "Nome do Admin"
}
```

**O que a edge function faz:**

| Ação | Efeito no DB da Migma |
|------|----------------------|
| `approved` | `institution_applications.is_application_fee_paid = true` |
| `approved` | `application_fee_zelle_pending.status = 'approved'` |
| `approved` | Notificação ao aluno |
| `rejected` | `application_fee_zelle_pending.status = 'rejected'` |
| `rejected` | `application_fee_zelle_pending.rejection_reason = <reason>` |
| `rejected` | Notificação ao aluno com motivo |

---

## 3. O que o MatriculaUSA precisa fazer

### 3.1 Webhook `zelle-global` — suporte ao campo `source`

O workflow n8n do `zelle-global` precisa:

1. Detectar se `body.source === "migma"`
2. Salvar na tabela `zelle_payments` do MatriculaUSA com:

```json
{
  "user_id": null,
  "fee_type": "application_fee",
  "fee_type_global": "application_fee_migma",
  "amount": "<body.amount>",
  "screenshot_url": "<body.image_url>",
  "status": "pending_verification",
  "metadata": {
    "source": "migma",
    "migma_application_id": "<body.migma_application_id>",
    "migma_profile_id": "<body.migma_profile_id>",
    "migma_user_id": "<body.migma_user_id>",
    "migma_student_name": "<body.migma_student_name>",
    "migma_student_email": "<body.migma_student_email>"
  }
}
```

> Se `source` for diferente de `"migma"` (ou ausente) → comportamento atual inalterado.

### 3.2 `zelleOrchestrator.ts` — case `application_fee_migma`

No `approveZelleFlow`, adicionar um bloco para `fee_type_global === "application_fee_migma"`:

```typescript
const isApplicationFeeMigma = feeTypeGlobalSafe === "application_fee_migma";

if (isApplicationFeeMigma) {
  const migmaAppId    = payment.metadata?.migma_application_id;
  const migmaProfileId = payment.metadata?.migma_profile_id;
  const migmaUserId   = payment.metadata?.migma_user_id;

  if (migmaAppId && migmaUserId) {
    await fetch(`${MIGMA_FUNCTIONS_URL}/migma-approve-application-fee`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-migma-webhook-secret': MIGMA_WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        action: 'approved',
        migma_application_id: migmaAppId,
        migma_profile_id: migmaProfileId,
        migma_user_id: migmaUserId,
        matriculausa_payment_id: payment.id,
        approved_by: adminName,
      }),
    });
  }
}
```

Análogo no `rejectZelleFlow` — detectar `application_fee_migma` e chamar o callback com `action: 'rejected'`.

### 3.3 Admin Dashboard — identificação visual

No componente de listagem de pagamentos Zelle (`ZellePayments`), exibir:

- Badge **`MIGMA`** em pagamentos onde `fee_type_global === "application_fee_migma"` ou `metadata.source === "migma"`
- No modal de revisão (`ZellePaymentReviewModal`), mostrar campos extras:
  - **Aluno:** `metadata.migma_student_name`
  - **Email:** `metadata.migma_student_email`
  - **Sistema:** Migma Inc.

### 3.4 Variáveis de ambiente necessárias no MatriculaUSA

```env
VITE_MIGMA_FUNCTIONS_URL=https://<migma-supabase-project>.supabase.co/functions/v1
VITE_MIGMA_WEBHOOK_SECRET=<shared-secret-combinado-entre-os-sistemas>
```

---

## 4. Schema — o que muda

### Migma: `application_fee_zelle_pending`

Campos novos a adicionar:

```sql
ALTER TABLE application_fee_zelle_pending
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending_verification',
  ADD COLUMN IF NOT EXISTS matriculausa_payment_id uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by text;
```

### MatriculaUSA: `zelle_payments`

Sem migração necessária — os campos extras do Migma vão em `metadata` (já é `jsonb`).  
O único campo novo relevante é `fee_type_global = 'application_fee_migma'`, que o `zelleLoader.ts` já suporta via leitura do campo.

---

## 5. Segurança

| Ponto | Mecanismo |
|-------|-----------|
| Callback Migma exposto publicamente | Header `x-migma-webhook-secret` obrigatório — rejeitar 401 se inválido |
| Secret compartilhado | Gerado uma vez, armazenado em Supabase Secrets (Migma) e `.env`/secrets (MatriculaUSA) |
| Idempotência | `UPDATE ... WHERE id = X` é seguro de rodar duas vezes — sem efeito duplo |
| CORS | Edge function Migma não precisa CORS (server-to-server) |

---

## 6. Checklist de Implementação

### Migma
- [ ] Migration SQL em `application_fee_zelle_pending`
- [ ] `PaymentStep.tsx`: substituir `processZellePaymentWithN8n` por upload + POST `zelle-global`
- [ ] Nova edge function `migma-approve-application-fee`
- [ ] Configurar secret `MIGMA_WEBHOOK_SECRET` no Supabase Secrets da Migma

### MatriculaUSA
- [ ] Atualizar workflow n8n `zelle-global` para rotear `source=migma`
- [ ] `zelleOrchestrator.ts`: adicionar bloco `application_fee_migma` em `approveZelleFlow`
- [ ] `zelleOrchestrator.ts`: adicionar callback Migma em `rejectZelleFlow`
- [ ] Dashboard: badge `MIGMA` na listagem e info extra no modal
- [ ] Configurar `VITE_MIGMA_FUNCTIONS_URL` e `VITE_MIGMA_WEBHOOK_SECRET` no `.env`

### Ambos
- [ ] Combinar e configurar o `shared-secret`
- [ ] Teste E2E: upload na Migma → aparece no admin MatriculaUSA → aprovar → Migma marcado como pago
- [ ] Teste de rejeição: rejeitar no MatriculaUSA → Migma recebe rejeição → aluno notificado

---

## 7. Observações Finais

- **`user_id` no MatriculaUSA:** O aluno Migma pode não ter conta no MatriculaUSA — gravar `user_id = null` é intencional e o `zelleLoader.ts` já suporta isso (filtra por `amount > 0` e `screenshot_url not null`).
- **`student_id` no `approveZelleFlow`:** Com `user_id = null`, o `finalStudentId` ficará vazio. O bloco `application_fee_migma` **não deve** chamar `log_student_action` com ID vazio — usar o `payment.id` como referência ou pular o log de student action.
- **Sem validação automática:** O comprovante **não** passa pelo validador de IA. A aprovação é sempre manual pelo admin. Isso é intencional — o admin visualiza o comprovante e decide.
