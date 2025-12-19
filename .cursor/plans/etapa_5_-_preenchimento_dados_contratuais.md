# ETAPA 5 - Preenchimento dos Dados Contratuais

## Objetivo

Adicionar formulário completo na página `/partner-terms` para coletar dados contratuais obrigatórios antes do aceite final. O formulário deve aparecer após o usuário rolar o contrato e antes da seção de upload de documentos.

## Análise do Código Atual

1. **Página atual**: `src/pages/PartnerTerms.tsx` contém apenas:
   - Contrato renderizado (protegido)
   - Upload de documentos (frente, verso, selfie)
   - Checkbox de aceite
   - Campo de assinatura digital

2. **Tabela atual**: `partner_terms_acceptances` não possui campos para dados contratuais

3. **Dados já disponíveis**: `global_partner_applications` tem `email`, `full_name`, `phone`, `country` - alguns podem ser pré-preenchidos

## Estrutura de Dados Necessária

### Campos a Adicionar na Tabela `partner_terms_acceptances`

**Identificação Pessoal:**
- `full_legal_name` TEXT (pode ser diferente do nome na aplicação)
- `date_of_birth` DATE
- `nationality` TEXT
- `country_of_residence` TEXT
- `phone_whatsapp` TEXT (pode ser diferente do phone da aplicação)
- `email` TEXT (pré-preenchido da aplicação, mas pode ser editado)

**Endereço:**
- `address_street` TEXT
- `address_city` TEXT
- `address_state` TEXT
- `address_zip` TEXT
- `address_country` TEXT

**Estrutura Fiscal/Empresarial:**
- `business_type` TEXT ('Individual' ou 'Company')
- `tax_id_type` TEXT ('CNPJ', 'NIF', 'Equivalent', etc.)
- `tax_id_number` TEXT
- `company_legal_name` TEXT (opcional, apenas se business_type = 'Company')

**Pagamento:**
- `preferred_payout_method` TEXT ('Wise', 'Stripe', 'Other')
- `payout_details` TEXT (detalhes mínimos da conta)

## Implementação

### 1. Migration SQL - Adicionar Campos

**Arquivo**: `supabase/migrations/20250118000003_add_contractual_data_fields.sql` (NOVO)

Adicionar todos os campos listados acima com CHECK constraints apropriados e comentários.

### 2. Atualizar PartnerTerms.tsx - Adicionar Formulário

**Mudanças**:

1. Adicionar estados para todos os campos do formulário
2. Implementar pré-preenchimento de dados da aplicação
3. Criar seção de formulário após o contrato
4. Adicionar validação
5. Atualizar `handleAccept` para salvar dados

### 3. Estrutura Visual do Formulário

**Ordem na página**:
1. Contrato (protegido) - Card "1. Terms & Conditions"
2. **Formulário de Dados Contratuais** - Card "2. Contractual Information" (NOVO)
3. Upload de Documentos - Card "3. Identity Verification"
4. Aceite e Assinatura - Footer fixo

## Ordem de Execução

1. Criar migration SQL
2. Aplicar migration via MCP Supabase
3. Adicionar estados no componente
4. Implementar pré-preenchimento
5. Criar seção de formulário
6. Adicionar validação
7. Atualizar handleAccept
8. Testar fluxo completo

## Validações Necessárias

- Campos obrigatórios validados
- Se `business_type = 'Company'`: `company_legal_name` e `tax_id_number` obrigatórios
- Email válido
- Data de nascimento válida

