# Consulta Técnica — Integração Migma → MatriculaUSA

## Contexto

O sistema **Migma** (migmainc.com) é o frontend de captação e onboarding de alunos.
O **MatriculaUSA** é o sistema de gestão de matrículas que processa os alunos aprovados.

Atualmente, quando o admin da Migma aprova uma bolsa para um aluno, o sistema chama
a Edge Function `sync-to-matriculausa`, que:

1. Cria (ou localiza) o usuário no auth do MatriculaUSA via `admin.createUser`
2. Faz um `PATCH` em `user_profiles` com dados básicos do aluno

**O problema:** isso não é suficiente. Além do `user_profiles`, precisamos sincronizar
os dados da bolsa aprovada — instituição, curso, nível de bolsa, placement fee, desconto —
para que o aluno apareça corretamente no MatriculaUSA com sua candidatura vinculada.

---

## Dados que a Migma tem no momento da aprovação da bolsa

Quando o admin aprova, temos disponíveis os seguintes dados:

### Dados do Aluno (`user_profiles` Migma)
```
profile_id          uuid
user_id             uuid (auth)
email               string
full_name           string
phone               string
country             string
student_process_type  "transfer" | "cos" | "initial" | "reinstatement"
num_dependents      integer
migma_seller_id     uuid (nullable)
migma_agent_id      uuid (nullable)
```

### Dados da Candidatura aprovada (`institution_applications` Migma)
```
application_id              uuid
institution_id              uuid
scholarship_level_id        uuid
status                      "payment_pending" | "payment_confirmed"
admin_approved_at           timestamp
placement_fee_paid_at       timestamp (nullable — só após pagamento)
placement_fee_installments  integer (1 ou 2)
```

### Dados da Instituição (`institutions` Migma)
```
institution_name    ex: "Caroline University" | "Oikos University"
institution_slug    ex: "caroline-university" | "oikos-university"
city, state         ex: "Los Angeles, CA"
application_fee_usd ex: 350
accepts_cos         boolean
accepts_transfer    boolean
modality            "hybrid" | "in_person"
cpt_opt             ex: "CPT day 1 (Mestrado)"
```

### Dados da Bolsa aprovada (`institution_scholarships` Migma)
```
scholarship_id          uuid
placement_fee_usd       ex: 1800
discount_percent        ex: 70
tuition_annual_usd      ex: 5060
monthly_migma_usd       ex: 105
installments_total      ex: 24 (mestrado) ou 48 (bacharelado)
```

### Dados do Curso (`institution_courses` Migma)
```
course_name     ex: "MBA" | "Business Administration" | "Computer Science"
degree_level    ex: "masters" | "bachelor"
area            ex: "business" | "technology"
```

---

## O que precisamos saber do MatriculaUSA

Por favor, analise o banco de dados do MatriculaUSA e responda:

### 1. Estrutura de candidatura do aluno
- Existe uma tabela de candidaturas (tipo `scholarship_applications`,
  `student_applications`, `enrollments` ou similar)?
- Como ela se relaciona com `user_profiles`?
- Quais campos ela tem? (institution, course, scholarship level, placement fee, discount, etc.)
- Como o status de candidatura é representado?

### 2. Estrutura de bolsas/scholarships
- Como as bolsas estão modeladas no MatriculaUSA?
  (tabela `scholarships`, `scholarship_levels`, `institution_scholarships`?)
- As bolsas já existem no banco (cadastradas pela equipe) ou precisam ser criadas
  via sync da Migma?
- Se já existem, como identificamos a bolsa correta para vincular ao aluno?
  (por institution slug + discount_percent? por placement_fee_usd? por um ID fixo?)

### 3. Packages/módulos do aluno
- Existe conceito de "package" ou "módulo" que o aluno tem acesso após ser matriculado?
- Em qual tabela fica? Como é criado? Quais campos são obrigatórios?

### 4. Application Fee checkout
- O checkout da Application Fee (taxa I-20: $350 + $100/dep) é gerado pelo MatriculaUSA?
- Se sim: existe um endpoint/Edge Function que recebe o `user_id` e retorna um link de pagamento?
- Quando o pagamento é confirmado, o MatriculaUSA dispara algum webhook de volta?
  Se sim, qual o formato do payload?

### 5. Fluxo ideal de sync
Com base na estrutura que você encontrar, qual seria a sequência correta de chamadas
que a Migma deve fazer ao MatriculaUSA após a aprovação da bolsa?

Por exemplo:
```
1. PATCH user_profiles (dados básicos) — já implementado
2. POST/UPSERT tabela_X com dados da candidatura
3. POST/UPSERT tabela_Y com dados da bolsa vinculada
4. POST/UPSERT tabela_Z para criar o package do aluno
```

---

## O que já funciona hoje

- Criação do usuário no auth do MatriculaUSA (`admin.createUser`)
- PATCH em `user_profiles` com: `full_name`, `phone`, `country`,
  `student_process_type`, `status: "active"`, `role: "student"`,
  `source: "migma"`, `dependents`, `placement_fee_flow: true`,
  `selection_survey_passed`
- `matricula_user_id` salvo de volta na Migma após sync

## O que NÃO é enviado hoje (e precisa ser)
- Nome/dados da instituição aprovada
- Nível de bolsa (discount_percent, tuition_annual_usd, placement_fee_usd)
- Nome do curso e grau (MBA, Bacharelado, etc.)
- Status da candidatura (aprovada, placement fee pago)
- Package/módulo do aluno

---

## Formato de resposta esperado

Para cada tabela relevante encontrada, responda com:

```
Tabela: nome_da_tabela
Colunas relevantes: coluna1 (tipo), coluna2 (tipo), ...
FK para user_profiles: coluna_fk
Como criar: INSERT com campos obrigatórios = [...]
Observação: qualquer regra de negócio relevante
```

E ao final, o fluxo ideal de sync em sequência numerada.
