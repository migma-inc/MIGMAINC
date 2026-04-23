# Consulta Técnica 2 — Integração Migma → MatriculaUSA
# Tema: Admin Dashboard + Mínimo necessário para vincular bolsa ao aluno

## Contexto

A Migma aprova bolsas para alunos de forma independente (sistema próprio).
Após a aprovação, precisamos que o aluno apareça corretamente no dashboard
administrativo do MatriculaUSA com os dados da bolsa vinculada.

Já sabemos que:
- `scholarship_applications.scholarship_id` é NOT NULL (FK obrigatória)
- Portanto não é possível criar um registro em `scholarship_applications`
  sem referenciar uma bolsa existente em `scholarships`

---

## Pergunta Principal

**O dashboard administrativo do MatriculaUSA exibe os dados da bolsa
lendo de qual fonte?**

Opção A — Lê de `scholarship_applications → scholarships`:
```sql
SELECT sa.*, s.title, s.annual_value_with_scholarship, s.placement_fee_amount
FROM scholarship_applications sa
JOIN scholarships s ON sa.scholarship_id = s.id
WHERE sa.student_id = :profile_id
```

Opção B — Lê diretamente de `user_profiles`:
```sql
SELECT up.selected_scholarship_id, up.university_id,
       up.is_placement_fee_paid, up.placement_fee_paid_at,
       up.placement_fee_installment_number
FROM user_profiles up
WHERE up.user_id = :user_id
```

Opção C — Lê das duas fontes (user_profiles + scholarship_applications)?

**Por que isso importa:**
- Se for Opção A → obrigatoriamente precisamos de um registro em `scholarships`
  para poder criar o `scholarship_applications`
- Se for Opção B → podemos apenas fazer PATCH em `user_profiles` com os campos
  de bolsa e o admin já vê tudo, sem precisar tocar em `scholarship_applications`
- Se for Opção C → precisamos das duas

---

## Perguntas Específicas

### 1. Admin Dashboard
- Qual página/componente do admin exibe os dados do aluno com a bolsa vinculada?
- Esse componente faz query em `scholarship_applications` ou em `user_profiles`?
- Se fizer query em `scholarship_applications`, o que acontece quando o registro
  não existe? O aluno simplesmente não aparece ou aparece sem bolsa vinculada?

### 2. Campos de user_profiles suficientes?
Os seguintes campos existem em `user_profiles`:
```
selected_scholarship_id    uuid (FK → scholarships.id)
selected_application_id    uuid (FK → scholarship_applications.id)
university_id              uuid (FK → universities.id)
is_placement_fee_paid      boolean
placement_fee_paid_at      timestamptz
placement_fee_flow         boolean
placement_fee_installment_enabled  boolean
placement_fee_installment_number   integer
```

**Se patcharmos apenas esses campos em `user_profiles` (sem criar registro
em `scholarship_applications`), o admin consegue ver:**
- Qual universidade o aluno está vinculado? ✓/✗
- Que o Placement Fee foi pago? ✓/✗
- Qual bolsa foi aprovada (nome, desconto, tuition)? ✓/✗

### 3. selected_scholarship_id sem scholarship_applications
É possível setar `user_profiles.selected_scholarship_id` com um `scholarships.id`
sem criar o registro correspondente em `scholarship_applications`?
(Pergunta sobre se há trigger/constraint que exige a criação do application)

### 4. Alternativa: campo livre em user_profiles
Existe algum campo JSONB ou text em `user_profiles` onde possamos armazenar
os dados da bolsa Migma de forma livre (título, valor, desconto, placement fee)
sem depender de FK para `scholarships`?

Exemplo:
```json
{
  "migma_scholarship": {
    "institution": "Caroline University",
    "course": "MBA",
    "discount_percent": 70,
    "tuition_annual_usd": 5060,
    "placement_fee_usd": 1800,
    "approved_at": "2026-04-23T..."
  }
}
```

---

## O que a Migma tem disponível para enviar

Quando o admin Migma aprova uma bolsa, temos:

```typescript
{
  // Aluno
  email: "ana@gmail.com",
  fullName: "Ana Clara",
  studentProcessType: "transfer",
  numDependents: 0,

  // Bolsa aprovada
  institutionName: "Caroline University",
  institutionSlug: "caroline-university",
  courseName: "MBA",
  degreeLevel: "masters",
  discountPercent: 70,
  tuitionAnnualUsd: 5060,        // valor COM desconto
  originalAnnualUsd: 15000,      // valor SEM desconto
  placementFeeUsd: 1800,
  monthlyMigmaUsd: 100,
  installmentsTotal: 24,

  // Status
  adminApprovedAt: "2026-04-23T...",
  placementFeePaid: false,       // ainda não pagou no momento da aprovação
  placementFeeInstallments: 1,
}
```

---

## Cenários que queremos evitar

1. **Bolsa aparecer no catálogo público** — não queremos que outros alunos
   do MatriculaUSA vejam e apliquem para uma bolsa específica de um aluno Migma

2. **Criar muitos registros desnecessários** — se o admin dashboard consegue
   mostrar as informações necessárias só com PATCH em `user_profiles`,
   preferimos essa abordagem mais simples

3. **Ambiguidade no lookup** — não queremos fazer lookup de bolsa por valor
   numérico (risco de pegar a bolsa errada se houver duas com o mesmo valor)

---

## Resposta esperada

Por favor responda:

1. O admin dashboard lê de `scholarship_applications`, `user_profiles` ou ambos?
2. É possível mostrar a bolsa vinculada ao aluno apenas com PATCH em `user_profiles`?
3. Se precisarmos de `scholarship_applications`, qual é a forma mais simples de
   criar o registro sem depender do catálogo existente de `scholarships`?
   (ex: existe flag `is_active: false` que oculta do catálogo público?)
4. Existe campo livre (JSONB) em `user_profiles` para armazenar dados da bolsa?
