# Query: Schema de scholarship_applications + campo de application fee por aluno

## Contexto

Estamos sincronizando dados de bolsas aprovadas da Migma para o MatriculaUSA.
Cada aluno tem um valor de **application fee calculado individualmente**:

- Base: $350
- Por dependente: +$100
- Exemplo: aluno com 4 dependentes → $750

Precisamos armazenar esse valor **por aluno** (não na bolsa compartilhada, pois a bolsa é reutilizada entre alunos com valores diferentes).

## Problema

Tentamos inserir `application_fee_amount` na tabela `scholarship_applications` e recebemos:

```
Could not find the 'application_fee_amount' column of 'scholarship_applications' in the schema cache
```

## Perguntas

1. **Quais colunas existem na tabela `scholarship_applications`?** Por favor, liste todas as colunas com tipo e se é nullable.

2. **Existe alguma coluna para armazenar o valor da application fee específico do aluno?** Por exemplo: `fee_amount`, `custom_fee`, `fee_paid_amount`, ou similar?

3. **Se não existe essa coluna, qual é o lugar correto no schema do MatriculaUSA para armazenar o valor de application fee por aluno?** Existe alguma tabela de pagamentos ou de detalhes da aplicação?

4. **O que é o campo `payment_status` em `scholarship_applications`?** Quais valores aceita (enum)?

5. **Quais campos são obrigatórios (NOT NULL sem default) em `scholarship_applications`?**

## Payload atual que estamos tentando inserir

```json
{
  "student_id": "<uuid do user_profiles>",
  "scholarship_id": "<uuid da bolsa>",
  "status": "approved",
  "applied_at": "<timestamp>",
  "reviewed_at": "<timestamp>",
  "student_process_type": "change_of_status",
  "source": "migma",
  "is_application_fee_paid": false,
  "is_scholarship_fee_paid": false,
  "payment_status": "pending",
  "application_fee_amount": 750,
  "notes": "Migma sync | placement_fee: $1000 | discount: 50%"
}
```

Por favor analise via MCP do Supabase quais desses campos existem e quais causariam erro de schema.
