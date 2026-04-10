# Matricula USA × Migma — Fluxo de Onboarding do Aluno

## Visão Geral

Este documento descreve o fluxo completo que o aluno percorre no Matricula USA — do cadastro ao aceite pela universidade. A Migma precisa replicar este fluxo na própria plataforma, usando as Edge Functions do Matricula USA para registrar pagamentos e consultar status.

O fluxo é dividido em duas etapas macro:

| Etapa | Equivalente | Descrição |
|-------|-------------|-----------|
| **Checkout Inicial** | `QuickRegistration` | Cadastro + pagamento da taxa de processo seletivo |
| **Onboarding** | `StudentOnboarding` | Jornada completa do aluno (8–10 passos) |

---

## PARTE 1 — Checkout Inicial (Quick Registration)

Esta é a página de entrada. O aluno chega aqui através de um link de marketing ou indicação.

### O que acontece nesta tela

1. **Formulário de cadastro:**
   - Nome completo (`full_name`) — obrigatório
   - Email (`email`) — obrigatório
   - Telefone (`phone`) — obrigatório (com seletor de código do país)
   - CPF — obrigatório (para alunos brasileiros)
   - Número de dependentes — obrigatório
   - Senha + confirmação de senha
   - Aceitação dos Termos de Uso

2. **Seleção do método de pagamento:**
   - **Stripe / Cartão** — USD direto
   - **PIX** — cobrado em BRL (taxa de câmbio calculada no momento)
   - **Zelle** — transferência bancária manual (confirmação pelo admin)
   - **Parcelow** — parcelamento (redireciona para URL externa do Parcelow)

3. **Cupom de desconto (opcional):**
   - Código de indicação de vendedor (`?ref=CODIGO` ou `?coupon=CODIGO` na URL) — desconto de $50
   - Link de rastreamento sem desconto (`?sref=CODIGO`) — vincula ao vendedor sem desconto
   - Cupom promocional (BLACK, etc.) — desconto variável

### Taxa cobrada

| Sistema | Valor padrão | Com desconto de indicação |
|---------|-------------|--------------------------|
| Standard | USD 400 | USD 350 |
| Simplified | USD 350 | USD 350 (já é o mínimo) |

> Para alunos da Migma, o valor padrão é **USD 400**. A Migma define se oferece desconto ou não.

### O que fazer quando o pagamento for aprovado

Chamar a Edge Function para registrar o pagamento:

```typescript
// Após pagamento aprovado:
await fetch(`${MATRICULAUSA_API_URL}/migma-payment-completed`, {
  method: 'POST',
  headers: {
    'x-migma-api-key': MATRICULAUSA_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    user_id: 'uuid-do-aluno',        // retornado em migma-create-student
    fee_type: 'selection_process',
    amount: 400.00,
    payment_method: 'stripe',        // ou 'zelle', 'parcelow'
    // Campos adicionais por método:
    payment_intent_id: 'pi_xxx',     // Stripe
    gross_amount_usd: 416.55,        // Stripe — valor cobrado ao aluno (com taxa)
    fee_amount_usd: 16.55,           // Stripe — taxa do Stripe
    zelle_payment_id: 'uuid',        // Zelle
    parcelow_order_id: 'order_xxx',  // Parcelow
  }),
});
```

### Redirecionamento após pagamento

Após confirmação, redirecionar o aluno para o fluxo de onboarding:

```
/student/onboarding?step=selection_fee&payment=success
```

---

## PARTE 2 — Onboarding do Aluno (Passo a Passo)

O onboarding é um wizard com etapas sequenciais. Cada etapa só é liberada quando as condições anteriores forem satisfeitas. O progresso é salvo no banco — se o aluno fechar o browser e voltar, ele retoma de onde parou.

### Sequência de etapas

```
selection_fee → identity_verification → selection_survey → scholarship_selection
      → process_type → documents_upload → payment → placement_fee (ou scholarship_fee)
      → [reinstatement_fee] → my_applications → completed
```

### Como determinar a etapa atual

Use a Edge Function de status para saber em qual etapa o aluno está:

```typescript
const response = await fetch(
  `${MATRICULAUSA_API_URL}/migma-get-student-status?user_id=${userId}`,
  { headers: { 'x-migma-api-key': MATRICULAUSA_API_KEY } }
);
const { current_step, profile } = await response.json();
// current_step indica qual tela mostrar
```

---

## Etapas Detalhadas

---

### Etapa 1 — `selection_fee` (Taxa de Processo Seletivo)

**Flag que libera esta etapa:** `has_paid_selection_process_fee = true`

**O que mostrar:**
- Se o aluno chegou do checkout com `?payment=success`, mostrar mensagem de confirmação
- Botão "Continuar" para avançar para a próxima etapa

**Esta etapa já está concluída** quando o aluno chega do checkout. É apenas uma tela de confirmação.

**Condição para avançar:** `has_paid_selection_process_fee = true`

---

### Etapa 2 — `identity_verification` (Verificação de Identidade)

**Flag que libera:** `has_paid_selection_process_fee = true`

**O que mostrar:**
- Termo de aceite com fotografia (o aluno tira uma selfie segurando o documento)
- Formulário para upload da foto de identificação
- O aceite é registrado na tabela `comprehensive_term_acceptance` com `identity_photo_path`

**Ação da Migma ao concluir:**
- Fazer upload da foto para o Storage do Supabase
- Inserir registro em `comprehensive_term_acceptance` com o caminho da foto

**Condição para avançar:** Registro em `comprehensive_term_acceptance` com `identity_photo_path` preenchido

> **Nota:** Esta etapa pode ser simplificada ou adaptada pela Migma conforme suas necessidades de compliance.

---

### Etapa 3 — `selection_survey` (Quiz de Seleção)

**Flag que libera:** `identity_verified = true` (ou foto de identidade enviada)

**O que mostrar:**
- Quiz com perguntas de qualificação do aluno
- Perguntas sobre intenção, situação atual, objetivos

**Ação da Migma ao concluir o quiz:**
- Atualizar `selection_survey_passed = true` diretamente no banco via Supabase client
  ```typescript
  await supabaseClient
    .from('user_profiles')
    .update({ selection_survey_passed: true })
    .eq('user_id', userId);
  ```

**Condição para avançar:** `selection_survey_passed = true`

> **Nota:** A aprovação no quiz é decidida pela Migma. Pode ser automática (aluno sempre passa) ou baseada em critérios definidos pela equipe.

---

### Etapa 4 — `scholarship_selection` (Escolha da Bolsa)

**Flag que libera:** `selection_survey_passed = true`

**O que mostrar:**
- Lista de bolsas disponíveis (buscar de `scholarships` via Supabase)
- Card de cada bolsa com: nome da universidade, valor da anuidade, estado, tipo de curso
- Botão de selecionar bolsa (pode selecionar mais de uma no carrinho)

**Buscar bolsas disponíveis:**
```typescript
const { data: scholarships } = await supabaseClient
  .from('scholarships')
  .select(`
    id, name, application_fee_amount, annual_value_with_scholarship,
    university:universities(name, state, city),
    is_highlighted, is_active
  `)
  .eq('is_active', true)
  .order('is_highlighted', { ascending: false });
```

**Ao selecionar uma bolsa:**
- Inserir em `scholarship_applications`:
  ```typescript
  await supabaseClient
    .from('scholarship_applications')
    .insert({
      student_id: profileId,  // id do user_profiles (não user_id do auth!)
      scholarship_id: scholarshipId,
      status: 'pending',
      source: 'migma',
    });
  ```
- Atualizar `selected_scholarship_id` no perfil:
  ```typescript
  await supabaseClient
    .from('user_profiles')
    .update({ selected_scholarship_id: scholarshipId })
    .eq('user_id', userId);
  ```

**Condição para avançar:** Ao menos 1 registro em `scholarship_applications` para o aluno

---

### Etapa 5 — `process_type` (Tipo de Processo)

**Flag que libera:** Bolsa selecionada

**O que mostrar:**
- Opções de tipo de processo:
  - **Initial** — Aluno entrando pela primeira vez nos EUA
  - **Transfer** — Aluno já nos EUA transferindo de uma instituição para outra
  - **Change of Status (COS)** — Mudança de status de visto
  - **Resident** — Residente permanente ou cidadão

**Ao selecionar:**
```typescript
await supabaseClient
  .from('user_profiles')
  .update({ student_process_type: 'initial' }) // 'initial'|'transfer'|'change_of_status'|'resident'
  .eq('user_id', userId);

// E atualizar também na scholarship_applications:
await supabaseClient
  .from('scholarship_applications')
  .update({ student_process_type: 'initial' })
  .eq('student_id', profileId);
```

**Condição para avançar:** `student_process_type` preenchido no perfil

---

### Etapa 6 — `documents_upload` (Upload de Documentos)

**Flag que libera:** `student_process_type` preenchido

**O que mostrar:**
- Lista de documentos necessários de acordo com o tipo de processo
- Interface de upload de arquivo para cada documento
- Status de cada documento (pendente, enviado, aprovado, rejeitado)

**Documentos típicos por tipo de processo:**

| Documento | Initial | Transfer | COS | Resident |
|-----------|---------|----------|-----|---------|
| Passaporte | ✓ | ✓ | ✓ | ✓ |
| Diploma | ✓ | ✓ | ✓ | ✓ |
| Histórico Escolar | ✓ | ✓ | ✓ | ✓ |
| I-20 atual | — | ✓ | ✓ | — |
| Visto F-1 atual | — | ✓ | ✓ | — |
| Comprovante financeiro | ✓ | ✓ | ✓ | ✓ |

**Upload de documentos:**
```typescript
// 1. Upload do arquivo para o Storage
const { data: uploadData } = await supabaseClient.storage
  .from('student-documents')
  .upload(`${userId}/${documentType}/${fileName}`, file);

// 2. Registrar na tabela student_documents
await supabaseClient
  .from('student_documents')
  .insert({
    user_id: userId,
    document_type: documentType,
    file_path: uploadData.path,
    original_name: fileName,
    source: 'migma',
  });
```

**Ao concluir todos os documentos:**
```typescript
await supabaseClient
  .from('user_profiles')
  .update({ documents_uploaded: true })
  .eq('user_id', userId);
```

**Condição para avançar:** `documents_uploaded = true`

---

### Etapa 7 — `payment` (Taxa de Inscrição / Application Fee)

**Flag que libera:** `documents_uploaded = true`

**O que mostrar:**
- Valor da taxa de inscrição da bolsa escolhida
- Métodos de pagamento disponíveis
- O valor varia por bolsa — buscar `application_fee_amount` de `scholarships`

**Buscar valor da taxa:**
```typescript
const { data: scholarship } = await supabaseClient
  .from('scholarships')
  .select('application_fee_amount')
  .eq('id', selectedScholarshipId)
  .single();

const applicationFee = scholarship.application_fee_amount; // ex: 400
```

**Ao registrar pagamento:**
```typescript
await fetch(`${MATRICULAUSA_API_URL}/migma-payment-completed`, {
  method: 'POST',
  headers: { 'x-migma-api-key': MATRICULAUSA_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    fee_type: 'application',
    amount: applicationFee,
    payment_method: 'stripe',
    payment_intent_id: 'pi_xxx',
  }),
});
```

**Condição para avançar:** `is_application_fee_paid = true` no perfil

---

### Etapa 8 — `placement_fee` (Placement Fee) *ou* `scholarship_fee`

O aluno entra em uma das duas branches dependendo do campo `placement_fee_flow`:

```
if (profile.placement_fee_flow === true)  → Etapa: placement_fee
if (profile.placement_fee_flow === false) → Etapa: scholarship_fee
```

> **Alunos da Migma têm `placement_fee_flow = true` por padrão** (definido em `migma-create-student`).

#### Branch A — `placement_fee` (Placement Fee)

**O que mostrar:**
- Taxa calculada com base na anuidade da bolsa escolhida
- Fórmula: **20% do `annual_value_with_scholarship`** da bolsa
- Ex: anuidade de $10.000 → placement fee de $2.000

**Buscar valor:**
```typescript
const { data: scholarship } = await supabaseClient
  .from('scholarships')
  .select('annual_value_with_scholarship')
  .eq('id', selectedScholarshipId)
  .single();

const placementFee = scholarship.annual_value_with_scholarship * 0.20;
```

**Ao registrar pagamento:**
```typescript
await fetch(`${MATRICULAUSA_API_URL}/migma-payment-completed`, {
  method: 'POST',
  headers: { 'x-migma-api-key': MATRICULAUSA_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    fee_type: 'placement',
    amount: placementFee,
    payment_method: 'stripe',
    payment_intent_id: 'pi_xxx',
  }),
});
```

**Condição para avançar:** `is_placement_fee_paid = true`

#### Branch B — `scholarship_fee` (Taxa de Bolsa)

**O que mostrar:**
- Taxa fixa de **USD 900**
- Métodos de pagamento disponíveis

**Ao registrar pagamento:**
```typescript
await fetch(`${MATRICULAUSA_API_URL}/migma-payment-completed`, {
  method: 'POST',
  headers: { 'x-migma-api-key': MATRICULAUSA_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    fee_type: 'scholarship',
    amount: 900,
    payment_method: 'stripe',
    payment_intent_id: 'pi_xxx',
  }),
});
```

**Condição para avançar:** `is_scholarship_fee_paid = true`

---

### Etapa 9 — `reinstatement_fee` (Apenas Transfer inativos)

**Quando aparece:** Apenas quando `student_process_type = 'transfer'` E `visa_transfer_active = false`

Esta etapa é rara e indica que o aluno teve o visto cancelado. A Matricula USA marca `visa_transfer_active = false` no admin dashboard quando identifica este caso.

**O que mostrar:**
- Taxa de reinstituição
- Explicação do que o pacote cobre

**Ao registrar pagamento:**
```typescript
await fetch(`${MATRICULAUSA_API_URL}/migma-payment-completed`, {
  method: 'POST',
  headers: { 'x-migma-api-key': MATRICULAUSA_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    fee_type: 'placement', // usar 'placement' como fee_type para reinstituição
    amount: valorDaTaxa,
    payment_method: 'stripe',
  }),
});
```

---

### Etapa 10 — `my_applications` (Minhas Candidaturas)

**Flag que libera:** Todos os pagamentos obrigatórios concluídos

**O que mostrar:**
- Lista de candidaturas do aluno
- Status de cada candidatura: pendente, em análise, aceito, rejeitado
- Status dos documentos enviados
- Notificações da equipe do Matricula USA

**Esta etapa é o pós-venda.** O aluno aguarda enquanto a equipe do Matricula USA:
1. Analisa os documentos
2. Contata a universidade
3. Obtém carta de aceite
4. Pede taxa I-20 Control (última taxa)

**Buscar candidaturas:**
```typescript
const { data: applications } = await supabaseClient
  .from('scholarship_applications')
  .select(`
    id, status, created_at,
    scholarship:scholarships(name, university:universities(name))
  `)
  .eq('student_id', profileId);
```

**Buscar notificações para o aluno:**
```typescript
const { data: notifications } = await supabaseClient
  .from('student_notifications')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

---

### Etapa 11 — `i20_control` (Taxa I-20 Control)

**Quando aparece:** Após aceite pela universidade (admin do Matricula USA aciona manualmente)

Esta etapa não está no fluxo automático do `current_step` — ela é disparada pelo admin. A Migma deve monitorar o campo via polling ou webhook:

```typescript
// Consultar status periodicamente (polling a cada 5 min):
const { profile } = await getStudentStatus(userId);
if (profile.has_paid_i20_control_fee === false && profile.documents_status === 'approved') {
  // Mostrar tela de pagamento I-20
}
```

**Ao registrar pagamento:**
```typescript
await fetch(`${MATRICULAUSA_API_URL}/migma-payment-completed`, {
  method: 'POST',
  headers: { 'x-migma-api-key': MATRICULAUSA_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    fee_type: 'i20_control',
    amount: 900,
    payment_method: 'stripe',
    payment_intent_id: 'pi_xxx',
  }),
});
```

**`current_step` muda para `completed` após este pagamento.**

---

### Etapa 12 — `completed` (Processo Concluído)

**O que mostrar:**
- Tela de parabéns
- Resumo do processo
- Próximos passos (preparativos para viagem, etc.)

---

## Fluxo Resumido de Chamadas de API

```
1. Aluno se cadastra
   → POST /migma-create-student → salvar user_id

2. Aluno paga Taxa de Processo Seletivo (USD 400)
   → POST /migma-payment-completed { fee_type: "selection_process" }
   → current_step: "selection_survey"

3. Aluno faz verificação de identidade (selfie)
   → UPDATE user_profiles SET identity_verified = true [via Supabase client]
   → current_step: "selection_survey"

4. Aluno passa no quiz de seleção
   → UPDATE user_profiles SET selection_survey_passed = true [via Supabase client]
   → current_step: "scholarship_selection"

5. Aluno escolhe bolsa
   → INSERT scholarship_applications [via Supabase client]
   → current_step: "process_type"

6. Aluno escolhe tipo de processo
   → UPDATE user_profiles SET student_process_type = 'initial' [via Supabase client]
   → current_step: "documents_upload"

7. Aluno faz upload de documentos
   → INSERT student_documents [via Supabase client]
   → UPDATE user_profiles SET documents_uploaded = true
   → current_step: "payment"

8. Aluno paga Taxa de Inscrição (Application Fee)
   → POST /migma-payment-completed { fee_type: "application" }
   → current_step: "placement_fee" (para alunos Migma com placement_fee_flow = true)

9. Aluno paga Placement Fee
   → POST /migma-payment-completed { fee_type: "placement" }
   → current_step: "my_applications"

10. *** PASSO DO MATRICULA USA (pós-venda) ***
    Equipe analisa documentos, contata universidade, obtém carta de aceite.
    Migma não precisa fazer nada aqui — apenas mostrar status.

11. Após aceite: Taxa I-20 Control
    → POST /migma-payment-completed { fee_type: "i20_control" }
    → current_step: "completed"
```

---

## Resumo das Taxas

| Taxa | `fee_type` | Valor | Quando cobrar |
|------|-----------|-------|---------------|
| Processo Seletivo | `selection_process` | USD 400 | Na entrada (QuickRegistration) |
| Inscrição | `application` | Varia por bolsa (ex: USD 400) | Após upload de documentos |
| Placement Fee | `placement` | 20% da anuidade da bolsa | Após application fee (fluxo Migma) |
| I-20 Control | `i20_control` | USD 900 | Após aceite pela universidade |

> **Nota:** A Scholarship Fee (USD 900) aparece apenas para alunos com `placement_fee_flow = false`, que é o fluxo antigo. Alunos da Migma usam o fluxo novo (Placement Fee).

---

## Campos Importantes no Perfil do Aluno

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `has_paid_selection_process_fee` | boolean | Taxa de processo seletivo paga |
| `identity_verified` | boolean | Verificação de identidade concluída |
| `selection_survey_passed` | boolean | Quiz de seleção aprovado |
| `selected_scholarship_id` | uuid | ID da bolsa escolhida |
| `student_process_type` | text | 'initial' \| 'transfer' \| 'change_of_status' \| 'resident' |
| `documents_uploaded` | boolean | Documentos enviados |
| `documents_status` | text | null \| 'pending' \| 'under_review' \| 'approved' \| 'rejected' |
| `is_application_fee_paid` | boolean | Taxa de inscrição paga |
| `is_placement_fee_paid` | boolean | Placement Fee paga |
| `is_scholarship_fee_paid` | boolean | Taxa de bolsa paga (fluxo antigo) |
| `placement_fee_flow` | boolean | **true para todos os alunos Migma** |
| `has_paid_i20_control_fee` | boolean | Taxa I-20 paga |
| `onboarding_completed` | boolean | Processo concluído |
| `onboarding_current_step` | text | Etapa atual salva no banco |
| `visa_transfer_active` | boolean | false = visto cancelado (Transfer) |

---

## Pré-requisitos Técnicos

Para construir o fluxo de onboarding, a Migma precisa de:

1. **Supabase Client** com as credenciais do Matricula USA (para leitura de bolsas, inserção de documentos, etc.)
2. **Edge Functions API** (as 3 endpoints documentadas em `MIGMA_API_INTEGRATION.md`)
3. **Storage access** para upload de documentos (via Supabase client com chave anon)

### Credenciais necessárias

```env
# Para chamadas diretas ao banco (leitura de bolsas, status de candidaturas):
MATRICULAUSA_SUPABASE_URL=https://fitpynguasqqutuhzifx.supabase.co
MATRICULAUSA_SUPABASE_ANON_KEY=<chave anon pública — solicitar ao time Matricula USA>

# Para chamadas às Edge Functions (registrar pagamentos, criar alunos):
MATRICULAUSA_API_URL=https://fitpynguasqqutuhzifx.supabase.co/functions/v1
MATRICULAUSA_API_KEY=dd0e79e8b844f8cb318b4ae3efec9c2ab4df9f726cfe7ef732c89ce9e7c3223f
```

> ⚠️ **Atenção de segurança:**
> - A `ANON_KEY` é pública e pode ficar no frontend
> - A `API_KEY` (das Edge Functions) deve ficar **sempre no backend/server-side**

---

## Contato

Em caso de dúvidas, contatar o time técnico do Matricula USA.
