# Matricula USA × Migma — API Integration Guide

## Visão Geral

A Migma oferece a jornada completa do aluno (processo seletivo, pagamentos, documentos, bolsas) com **sua própria marca (white-label)**. O aluno interage apenas com a interface da Migma e não sabe que o backend é o Matricula USA.

O pós-venda (aprovação de documentos, contato com universidades, envio de cartas de aceite) é feito pela equipe do Matricula USA no admin dashboard deles.

**Arquitetura:** A Migma se comunica com o Matricula USA exclusivamente via **3 Edge Functions** autenticadas por uma chave de API secreta.

---

## Configuração — Variáveis de Ambiente

Adicione no `.env` do projeto Migma:

```env
# Matricula USA — Integração API
MATRICULAUSA_API_URL=https://fitpynguasqqutuhzifx.supabase.co/functions/v1
MATRICULAUSA_API_KEY=dd0e79e8b844f8cb318b4ae3efec9c2ab4df9f726cfe7ef732c89ce9e7c3223f
```

Toda requisição precisa do header:
```
x-migma-api-key: <MATRICULAUSA_API_KEY>
Content-Type: application/json
```

---

## Endpoints

### 1. Criar Aluno

Deve ser chamado quando um novo aluno se cadastra na plataforma da Migma.

**`POST /migma-create-student`**

#### Request
```typescript
const response = await fetch(`${process.env.MATRICULAUSA_API_URL}/migma-create-student`, {
  method: 'POST',
  headers: {
    'x-migma-api-key': process.env.MATRICULAUSA_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'aluno@email.com',        // obrigatório
    full_name: 'João da Silva',      // obrigatório
    phone: '+55 11 99999-9999',      // opcional
    country: 'Brazil',               // opcional
    migma_seller_id: 'vendedor-123', // opcional — ID do vendedor na Migma
    migma_agent_id: 'agente-456',    // opcional — ID do agente na Migma
    password: 'senha-opcional',      // opcional — se não enviado, gera uma temporária
  }),
});
```

#### Respostas

**201 — Criado com sucesso:**
```json
{
  "success": true,
  "user_id": "uuid-do-auth",
  "profile_id": "uuid-do-perfil",
  "profile": {
    "id": "uuid-do-perfil",
    "user_id": "uuid-do-auth",
    "email": "aluno@email.com",
    "full_name": "João da Silva",
    "source": "migma",
    "migma_seller_id": "vendedor-123"
  }
}
```

**409 — Aluno já existe:**
```json
{
  "error": "Student already exists",
  "message": "Email aluno@email.com já está cadastrado",
  "user_id": "uuid-existente",
  "profile_id": "uuid-existente",
  "source": "migma"
}
```

**400 — Campos faltando:**
```json
{
  "error": "Missing required fields: email, full_name"
}
```

**401 — Chave inválida:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing x-migma-api-key header"
}
```

> **Importante:** Salve o `user_id` retornado — ele é necessário para registrar pagamentos e consultar o status do aluno.

---

### 2. Registrar Pagamento

Deve ser chamado toda vez que um aluno da Migma conclui um pagamento.

**`POST /migma-payment-completed`**

#### Tipos de taxa disponíveis (`fee_type`)

| Valor | Descrição | Valor padrão |
|-------|-----------|-------------|
| `selection_process` | Taxa do Processo Seletivo | USD 400 |
| `application` | Taxa de Inscrição | USD 400 |
| `scholarship` | Taxa de Bolsa | varia |
| `placement` | Placement Fee | varia |
| `college_enrollment` | Taxa de Matrícula | varia |
| `i20_control` | Taxa I-20 Control | varia |

#### Métodos de pagamento (`payment_method`)

| Valor | Descrição |
|-------|-----------|
| `stripe` | Cartão via Stripe |
| `zelle` | Transferência Zelle |
| `manual` | Marcação manual |
| `parcelow` | Parcelamento Parcelow |

#### Request
```typescript
const response = await fetch(`${process.env.MATRICULAUSA_API_URL}/migma-payment-completed`, {
  method: 'POST',
  headers: {
    'x-migma-api-key': process.env.MATRICULAUSA_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    user_id: 'uuid-do-aluno',          // obrigatório — retornado em migma-create-student
    fee_type: 'selection_process',     // obrigatório — ver tabela acima
    amount: 400.00,                    // obrigatório — valor em USD
    payment_method: 'stripe',          // obrigatório — ver tabela acima

    // Campos opcionais por método de pagamento:
    payment_intent_id: 'pi_xxx',       // Stripe
    stripe_charge_id: 'ch_xxx',        // Stripe
    gross_amount_usd: 416.55,          // Stripe — valor bruto cobrado
    fee_amount_usd: 16.55,             // Stripe — taxa do Stripe
    zelle_payment_id: 'uuid',          // Zelle
    parcelow_order_id: 'order_xxx',    // Parcelow
    parcelow_checkout_url: 'https://...', // Parcelow
    parcelow_reference: 'ref_xxx',     // Parcelow
  }),
});
```

#### Resposta — 200 OK
```json
{
  "success": true,
  "payment_id": "uuid-do-pagamento",
  "record_id": "uuid-do-registro",
  "profile_flag_updated": "has_paid_selection_process_fee"
}
```

> **O que acontece internamente:** O pagamento é registrado, o flag booleano correspondente no perfil do aluno é atualizado (`has_paid_selection_process_fee = true`), e uma notificação `[MIGMA]` é criada no dashboard do Matricula USA.

---

### 3. Consultar Status do Aluno

Retorna o status completo do aluno: etapa atual, pagamentos, documentos, candidaturas.

**`GET /migma-get-student-status?user_id=UUID`**  
ou  
**`GET /migma-get-student-status?email=aluno@email.com`**

#### Request
```typescript
const response = await fetch(
  `${process.env.MATRICULAUSA_API_URL}/migma-get-student-status?user_id=${userId}`,
  {
    method: 'GET',
    headers: {
      'x-migma-api-key': process.env.MATRICULAUSA_API_KEY,
    },
  }
);
```

#### Resposta — 200 OK
```json
{
  "profile": {
    "user_id": "uuid",
    "email": "aluno@email.com",
    "full_name": "João da Silva",
    "source": "migma",
    "migma_seller_id": "vendedor-123",
    "has_paid_selection_process_fee": true,
    "selection_survey_passed": false,
    "is_application_fee_paid": false,
    "is_scholarship_fee_paid": false,
    "has_paid_college_enrollment_fee": false,
    "has_paid_i20_control_fee": false,
    "documents_uploaded": false,
    "documents_status": null,
    "selected_scholarship_id": null
  },
  "current_step": "selection_survey",
  "applications": [],
  "pending_document_requests": [],
  "student_documents": [],
  "payments": [
    {
      "fee_type": "selection_process",
      "amount": "400.00",
      "payment_method": "stripe",
      "payment_date": "2026-04-08T17:00:00Z"
    }
  ],
  "unread_notifications": []
}
```

#### Etapas do aluno (`current_step`)

| Valor | Significado | Próxima ação da Migma |
|-------|-------------|----------------------|
| `selection_process_payment` | Aguardando pagamento da taxa de processo seletivo | Redirecionar para pagamento |
| `selection_survey` | Aguardando aprovação no quiz de seleção | Mostrar quiz |
| `scholarship_selection` | Aguardando pagamento da taxa de inscrição | Mostrar bolsas disponíveis |
| `document_upload` | Aguardando upload de documentos | Interface de upload |
| `scholarship_fee_payment` | Aguardando pagamento da taxa de bolsa | Redirecionar para pagamento |
| `placement_fee_payment` | Aguardando Placement Fee | Redirecionar para pagamento |
| `document_review` | Documentos em análise pelo Matricula USA | Aguardar (pós-venda) |
| `i20_control_fee` | Aguardando taxa I-20 | Redirecionar para pagamento |
| `completed` | Processo concluído | — |

---

## Fluxo Completo do Aluno

```
1. Aluno se cadastra na Migma
   → POST /migma-create-student
   → Salvar user_id retornado

2. Aluno paga Taxa de Processo Seletivo (USD 400)
   → POST /migma-payment-completed { fee_type: "selection_process" }
   → current_step muda para "selection_survey"

3. Aluno passa no quiz de seleção
   → [interno Migma — marcar selection_survey_passed via API ou UI]
   → current_step muda para "scholarship_selection"

4. Aluno escolhe bolsa e paga Taxa de Inscrição
   → POST /migma-payment-completed { fee_type: "application" }
   → current_step muda para "document_upload"

5. Aluno faz upload de documentos
   → [interno Migma]
   → current_step muda para "scholarship_fee_payment"

6. Aluno paga Taxa de Bolsa
   → POST /migma-payment-completed { fee_type: "scholarship" }
   → current_step muda para "placement_fee_payment"

7. Aluno paga Placement Fee
   → POST /migma-payment-completed { fee_type: "placement" }
   → current_step muda para "document_review"

8. *** PASSO DO MATRICULA USA ***
   Equipe do Matricula USA analisa documentos, contata universidade,
   envia carta de aceite. Migma não precisa fazer nada aqui.

9. Após aceite: Taxa I-20 Control
   → POST /migma-payment-completed { fee_type: "i20_control" }
   → current_step muda para "completed"
```

---

## Segurança

- Todas as requisições são autenticadas via header `x-migma-api-key`
- A chave nunca deve ser exposta no frontend — use sempre em chamadas server-side
- Apenas alunos com `source = 'migma'` são retornados/aceitos pelos endpoints
- O Matricula USA consegue ver todos os alunos da Migma no admin dashboard deles com badge roxo "Migma"

---

## Erros Comuns

| Código | Mensagem | Causa |
|--------|----------|-------|
| 401 | Unauthorized | `x-migma-api-key` ausente ou incorreta |
| 404 | Student not found or does not belong to Migma | `user_id` não existe ou não é aluno Migma |
| 409 | Student already exists | Email já cadastrado |
| 400 | Missing required fields | Campo obrigatório faltando no body |
| 500 | Internal server error | Erro interno — contatar Matricula USA |

---

## Contato

Em caso de dúvidas ou problemas na integração, contatar o time técnico do Matricula USA.
