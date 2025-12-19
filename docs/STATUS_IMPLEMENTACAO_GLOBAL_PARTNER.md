# Status de Implementação - Global Partner Flow

## ✅ O QUE JÁ ESTÁ IMPLEMENTADO

### ETAPA 2 e 3 - Sistema de Reunião ✅
- ✅ Migration com campos de reunião
- ✅ Modal de agendamento (MeetingScheduleModal)
- ✅ Função approveApplicationForMeeting()
- ✅ Email de convite para reunião
- ✅ Função approveApplicationAfterMeeting()
- ✅ Interface atualizada (Dashboard, ApplicationDetailPage, ApplicationsList)
- ✅ Status badges e filtros

### ETAPA 4 - Proteção do Contrato ✅
- ✅ Hook useContentProtection implementado
- ✅ Bloqueio de botão direito (global)
- ✅ Bloqueio de cópia/seleção
- ✅ Bloqueio de impressão (CSS + JS)
- ✅ Proteção contra screenshots (Netflix-style)
- ✅ Bloqueio de APIs de captura de tela
- ✅ Proteção do header e conteúdo do contrato

### ETAPA 6 - Verificação de Identidade ✅
- ✅ Upload de documento frente
- ✅ Upload de documento verso
- ✅ Upload de selfie com documento
- ✅ Componente DocumentUpload funcional

### ETAPA 7 - Assinatura Digital ✅
- ✅ Campo "Digital Signature" adicionado
- ✅ Validação de nome completo
- ✅ Campo signature_name no banco
- ✅ Migration aplicada

### Registros Básicos ✅
- ✅ IP address salvo
- ✅ User agent salvo
- ✅ Data/hora de aceite salvo
- ✅ Token único gerado

---

## ❌ O QUE AINDA FALTA FAZER

### ETAPA 8 - Registros Legais Completos (PRIORIDADE ALTA)

**O que falta:**
- `contract_version` - Versão do contrato aceito
- `contract_hash` - Hash do conteúdo do contrato para integridade
- `geolocation` - Localização aproximada (país/cidade via IP)

**O que fazer:**
1. Criar migration para adicionar campos:
   - `contract_version TEXT`
   - `contract_hash TEXT`
   - `geolocation_country TEXT`
   - `geolocation_city TEXT` (opcional)

2. Atualizar `handleAccept()` em PartnerTerms.tsx:
   - Buscar versão ativa do contrato (tabela `application_terms`)
   - Gerar hash do conteúdo do contrato
   - Obter geolocalização via API (ex: ipapi.co ou similar)
   - Salvar todos os campos no update

3. Criar função helper para:
   - Gerar hash do contrato (SHA-256)
   - Buscar versão ativa do contrato
   - Obter geolocalização via IP

**Arquivos a modificar:**
- `supabase/migrations/20250118000002_add_legal_fields.sql` (NOVO)
- `src/pages/PartnerTerms.tsx` (MODIFICAR)
- `src/lib/contracts.ts` (MODIFICAR - adicionar helpers)

---

### ETAPA 9 - Email de Confirmação (PRIORIDADE MÉDIA)

**O que falta:**
- Chamar `sendTermsAcceptanceConfirmationEmail()` após aceite
- Email já existe, só precisa ser chamado

**O que fazer:**
1. Importar função em PartnerTerms.tsx
2. Chamar após sucesso do update no banco
3. Passar dados: email, fullName, contractPdfUrl (se disponível)

**Arquivos a modificar:**
- `src/pages/PartnerTerms.tsx` (MODIFICAR - adicionar chamada de email)

**Código a adicionar:**
```typescript
// Após sucesso do update
import { sendTermsAcceptanceConfirmationEmail } from '@/lib/emails';

// Buscar email do candidato
const { data: application } = await supabase
  .from('global_partner_applications')
  .select('email, full_name')
  .eq('id', tokenData.application_id)
  .single();

if (application) {
  await sendTermsAcceptanceConfirmationEmail(
    application.email,
    application.full_name,
    contractPdfUrl // se disponível
  );
}
```

---

### ETAPA 5 - Preenchimento de Dados Contratuais (PRIORIDADE MÉDIA)

**O que falta:**
Formulário completo com:
- Identificação pessoal:
  - Full legal name
  - Date of birth
  - Nationality
  - Country of residence
  - Phone / WhatsApp
  - Email (pré-preenchido)
- Endereço:
  - Full address (street, city, state, zip, country)
- Estrutura fiscal/empresarial:
  - Business type: Individual / Company
  - Tax ID type: CNPJ / NIF / Equivalent
  - Tax ID number
  - Company legal name (se aplicável)
- Pagamento:
  - Preferred payout method
  - Payout details (campos mínimos)

**O que fazer:**
1. Criar migration para adicionar campos em `partner_terms_acceptances` OU criar nova tabela `partner_contract_data`
2. Criar componente `ContractDataForm.tsx` com todos os campos
3. Adicionar antes da seção de upload de documentos
4. Validar e salvar dados antes de permitir aceite
5. Pré-preencher email da aplicação

**Arquivos a criar/modificar:**
- `supabase/migrations/20250118000003_add_contract_data_fields.sql` (NOVO)
- `src/components/partner/ContractDataForm.tsx` (NOVO)
- `src/pages/PartnerTerms.tsx` (MODIFICAR - adicionar formulário)

**Decisão necessária:**
- Salvar em `partner_terms_acceptances` (mais simples) OU
- Criar tabela separada `partner_contract_data` (mais organizado)

---

### ETAPA 10 - Verificação Interna (PRIORIDADE MÉDIA)

**O que falta:**
- Interface no dashboard para ver documentos e selfie
- Botões de aprovar/rejeitar verificação
- Status: `contract_pending_verification`, `active_partner`, `verification_failed`
- Sistema de reupload controlado (se falhar)

**O que fazer:**
1. Criar migration para adicionar status de verificação:
   - `contract_verification_status TEXT` (pending_verification, verified, failed)
   - `contract_verified_at TIMESTAMPTZ`
   - `contract_verified_by TEXT`
   - `contract_verification_notes TEXT`

2. Criar página/componente no dashboard:
   - `src/pages/ContractVerificationPage.tsx` (NOVO)
   - Lista de contratos pendentes de verificação
   - Visualização de documentos (frente, verso, selfie)
   - Botões: "Approve Verification" / "Reject & Request Resubmission"

3. Criar funções em `src/lib/admin.ts`:
   - `approveContractVerification()`
   - `rejectContractVerification()` (com opção de gerar novo token)

4. Atualizar status da aplicação:
   - Após verificação aprovada: status → `active_partner`
   - Após verificação rejeitada: status → `verification_failed`

**Arquivos a criar/modificar:**
- `supabase/migrations/20250118000004_add_verification_fields.sql` (NOVO)
- `src/pages/ContractVerificationPage.tsx` (NOVO)
- `src/lib/admin.ts` (MODIFICAR - adicionar funções)
- `src/pages/Dashboard.tsx` (MODIFICAR - adicionar link/rota)
- `src/components/admin/Sidebar.tsx` (MODIFICAR - adicionar menu item)

---

### Geração de PDF ✅ (MANTIDA)

**Status:**
- ✅ Geração de PDF mantida (necessária para admins e vendedores)
- ✅ PDF é gerado após aceite do contrato
- ✅ PDF NÃO é enviado no email para o candidato (conforme especificação)
- ✅ PDF fica disponível no sistema para acesso interno

**Observação:**
- A geração de PDF já está implementada e funcionando
- Não precisa ser removida, apenas não enviar no email de confirmação

---

## 📊 RESUMO POR PRIORIDADE

### PRIORIDADE ALTA (Fazer primeiro)

1. **ETAPA 8 - Registros Legais Completos**
   - Tempo estimado: 2-3 horas
   - Impacto: Compliance e auditoria
   - Dependências: Nenhuma

### PRIORIDADE MÉDIA (Fazer depois)

2. **ETAPA 9 - Email de Confirmação**
   - Tempo estimado: 30 minutos
   - Impacto: UX
   - Dependências: Nenhuma

3. **ETAPA 5 - Preenchimento de Dados Contratuais**
   - Tempo estimado: 4-6 horas
   - Impacto: Funcionalidade completa
   - Dependências: Nenhuma

4. **ETAPA 10 - Verificação Interna**
   - Tempo estimado: 4-5 horas
   - Impacto: Processo completo
   - Dependências: ETAPA 5 (para ter dados para verificar)

### PRIORIDADE BAIXA (Opcional)

5. ~~**Remover Geração de PDF**~~ ✅ **NÃO NECESSÁRIO**
   - Geração de PDF mantida (para admins e vendedores)
   - PDF não é enviado no email (conforme especificação)

---

## 🎯 ORDEM RECOMENDADA DE IMPLEMENTAÇÃO

1. ✅ **ETAPA 8** - Registros Legais (2-3h)
2. ✅ **ETAPA 9** - Email Confirmação (30min)
3. ✅ **ETAPA 5** - Dados Contratuais (4-6h)
4. ✅ **ETAPA 10** - Verificação Interna (4-5h)

**Tempo total estimado**: 11-15 horas

**Nota:** Geração de PDF mantida (necessária para admins/vendedores). PDF não é enviado no email para o candidato.

---

## 📝 NOTAS IMPORTANTES

- **ETAPA 5 vs ETAPA 6**: ETAPA 5 (dados) deve vir ANTES de ETAPA 6 (upload de documentos) no fluxo
- **ETAPA 10**: Requer que ETAPA 5 esteja completa para ter dados para verificar
- **Geração de PDF**: Mantida para uso interno (admins/vendedores). PDF não é enviado no email para o candidato, conforme especificação.

---

## 🔍 VERIFICAÇÕES NECESSÁRIAS

Antes de implementar ETAPA 5, verificar:
- Onde os dados devem ser salvos? (tabela existente ou nova?)
- Alguns dados já vêm da aplicação inicial? (email, nome, etc.)
- Quais campos são obrigatórios vs opcionais?

Antes de implementar ETAPA 10, verificar:
- Como deve funcionar o reupload? (novo token? mesmo token?)
- Quais critérios para aprovar/rejeitar?
- O que acontece após verificação aprovada?

