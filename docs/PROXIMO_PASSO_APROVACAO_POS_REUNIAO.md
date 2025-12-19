# Próximo Passo: Aprovação Pós-Reunião

## 🎯 O que acontece quando você clica em "Approve After Meeting"

Quando o admin clica no botão **"Approve After Meeting"**, o sistema executa o seguinte fluxo:

## 📋 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Admin clica "Approve After Meeting"                     │
│    (Dashboard ou ApplicationDetailPage)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Modal de confirmação aparece                              │
│    "Are you sure you want to approve [Nome] after the       │
│     meeting? This will send them an email with the          │
│     contract terms link."                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Admin confirma                                            │
│    → Chama approveApplicationAfterMeeting()                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Validação                                                 │
│    - Verifica se status é 'approved_for_meeting'            │
│    - Se não for, retorna erro                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Atualiza status no banco                                 │
│    UPDATE global_partner_applications                        │
│    SET status = 'approved_for_contract'                      │
│    WHERE id = <application_id>                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Gera token único                                          │
│    → approveCandidateAndSendTermsLink()                    │
│    - Token: migma_<timestamp>_<random1>_<random2>           │
│    - Expira em 30 dias                                       │
│    - Salva na tabela partner_terms_acceptances              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Envia email com link do contrato                         │
│    → sendApprovalEmail()                                    │
│    Subject: "Congratulations! Your MIGMA Global Partner     │
│              Application Has Been Approved"                 │
│    Link: /partner-terms?token=<token_gerado>               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Candidato recebe email                                    │
│    - Email com link único e seguro                          │
│    - Link válido por 30 dias                                │
│    - Botão "Review and Accept Terms"                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Candidato clica no link                                   │
│    → Acessa /partner-terms?token=<token>                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. Sistema valida token                                     │
│     → validateTermsToken()                                  │
│     - Verifica se token existe                              │
│     - Verifica se não expirou                               │
│     - Verifica se ainda não foi aceito                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. Página do contrato carrega                               │
│     - Mostra contrato completo (protegido)                  │
│     - Formulário de dados pessoais                          │
│     - Upload de selfie com documento                        │
│     - Checkbox de aceite                                    │
│     - Campo de assinatura (nome completo)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 12. Candidato aceita termos                                  │
│     - Preenche dados                                        │
│     - Faz upload da selfie                                  │
│     - Marca checkbox                                        │
│     - Digita nome completo                                  │
│     - Clica "I ACCEPT"                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 13. Sistema registra aceite                                   │
│     - Marca token como usado                                │
│     - Salva dados do aceite                                 │
│     - Gera PDF do contrato (se configurado)                 │
│     - Envia email de confirmação                            │
└─────────────────────────────────────────────────────────────┘
```

## 🔍 Detalhamento Técnico

### Passo 1-3: Interface do Admin

**Arquivo**: `src/pages/Dashboard.tsx` ou `src/pages/ApplicationDetailPage.tsx`

```typescript
// Quando admin clica no botão
const handleApprove = async (application: Application) => {
  if (application.status === 'approved_for_meeting') {
    setShowApproveConfirm(true); // Abre modal de confirmação
  }
};

// Quando admin confirma
const confirmApprove = async () => {
  const result = await approveApplicationAfterMeeting(applicationId);
  // ...
};
```

### Passo 4-5: Validação e Atualização de Status

**Arquivo**: `src/lib/admin.ts`

```typescript
export async function approveApplicationAfterMeeting(
  applicationId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Verifica status atual
  const { data: application } = await supabase
    .from('global_partner_applications')
    .select('status')
    .eq('id', applicationId)
    .single();

  if (application.status !== 'approved_for_meeting') {
    return { 
      success: false, 
      error: 'Application must be in approved_for_meeting status' 
    };
  }

  // 2. Atualiza status
  await supabase
    .from('global_partner_applications')
    .update({ 
      status: 'approved_for_contract',
      updated_at: new Date().toISOString() 
    })
    .eq('id', applicationId);
}
```

### Passo 6: Geração do Token

**Arquivo**: `src/lib/partner-terms.ts`

```typescript
export async function generateTermsToken(
  applicationId: string,
  expiresInDays: number = 30
): Promise<{ token: string; expiresAt: Date } | null> {
  // Gera token único
  const token = `migma_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
  
  // Calcula expiração (30 dias)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // Salva no banco
  await supabase
    .from('partner_terms_acceptances')
    .insert({
      application_id: applicationId,
      token: token,
      expires_at: expiresAt.toISOString(),
    });

  return { token, expiresAt };
}
```

**Exemplo de token gerado**:
```
migma_1704067200000_abc123def456_xyz789ghi012
```

### Passo 7: Envio do Email

**Arquivo**: `src/lib/emails.ts`

O email enviado contém:

- **Subject**: "Congratulations! Your MIGMA Global Partner Application Has Been Approved"
- **Conteúdo**:
  - Mensagem de parabéns
  - Instruções dos próximos passos
  - **Link do contrato**: `https://migma.com/partner-terms?token=migma_...`
  - Aviso de expiração (30 dias)

**Link gerado**:
```typescript
const termsUrl = `${baseUrl}/partner-terms?token=${token}`;
// Exemplo: https://migma.com/partner-terms?token=migma_1704067200000_abc123_xyz789
```

### Passo 8-9: Candidato Recebe e Clica

O candidato recebe o email e clica no botão **"Review and Accept Terms"** ou copia o link.

### Passo 10: Validação do Token

**Arquivo**: `src/lib/partner-terms.ts`

```typescript
export async function validateTermsToken(token: string) {
  // Busca token no banco
  const { data } = await supabase
    .from('partner_terms_acceptances')
    .select('*, application_id')
    .eq('token', token)
    .single();

  // Verifica se existe
  if (!data) return null;

  // Verifica se não expirou
  const now = new Date();
  const expiresAt = new Date(data.expires_at);
  if (now > expiresAt) return null;

  // Verifica se ainda não foi aceito
  if (data.accepted_at) return null;

  return data; // Token válido!
}
```

### Passo 11-13: Página do Contrato

**Arquivo**: `src/pages/PartnerTerms.tsx`

A página `/partner-terms?token=...`:

1. **Valida o token** (Passo 10)
2. **Mostra o contrato** (protegido contra cópia/impressão)
3. **Formulário de dados**:
   - Nome completo legal
   - Data de nascimento
   - Nacionalidade
   - Endereço completo
   - Dados fiscais
4. **Upload de selfie** com documento de identidade
5. **Aceite eletrônico**:
   - Checkbox: "I have read and agree..."
   - Campo de assinatura (nome completo digitado)
   - Botão "I ACCEPT"

Quando o candidato clica em "I ACCEPT":
- Token é marcado como usado (`accepted_at` preenchido)
- Dados são salvos
- Status pode ser atualizado para verificação final
- Email de confirmação é enviado

## 📊 Mudanças no Banco de Dados

### Tabela: `global_partner_applications`

```sql
-- Status muda de:
status = 'approved_for_meeting'
-- Para:
status = 'approved_for_contract'
```

### Tabela: `partner_terms_acceptances`

```sql
-- Nova linha criada:
INSERT INTO partner_terms_acceptances (
  application_id,
  token,
  expires_at,
  created_at
) VALUES (
  '<application_id>',
  'migma_1704067200000_abc123_xyz789',
  '2025-02-20T00:00:00Z',  -- 30 dias depois
  NOW()
);
```

## ✅ O que o Admin vê após aprovar

1. **Mensagem de sucesso**: "Application approved successfully! Email sent."
2. **Status atualizado**: Badge muda para "Approved for Contract" (verde)
3. **Botão desaparece**: "Approve After Meeting" não aparece mais
4. **Lista atualizada**: Aplicação aparece com novo status

## 📧 O que o Candidato recebe

**Email com**:
- Título: "Congratulations! Your MIGMA Global Partner Application Has Been Approved"
- Mensagem de parabéns
- Link único: `/partner-terms?token=migma_...`
- Botão grande: "Review and Accept Terms"
- Aviso: Link expira em 30 dias

## 🔐 Segurança

- **Token único**: Cada aplicação gera um token diferente
- **Expiração**: Token válido por 30 dias
- **Uso único**: Token só pode ser usado uma vez
- **Validação**: Sistema verifica token antes de mostrar contrato
- **Proteção**: Contrato não pode ser copiado/impresso (ETAPA 4 implementada)

## 🧪 Como Testar

1. **Aprove uma aplicação para reunião** (já feito ✅)
2. **Clique em "Approve After Meeting"**
3. **Confirme no modal**
4. **Verifique**:
   - Status mudou para `approved_for_contract`?
   - Email foi enviado?
   - Token foi criado no banco?
5. **Abra o link do email** (ou copie do banco)
6. **Verifique**:
   - Página `/partner-terms` carrega?
   - Contrato aparece?
   - Proteção está ativa?

## 📝 Resumo

Quando você clica em **"Approve After Meeting"**:

1. ✅ Status muda para `approved_for_contract`
2. ✅ Token único é gerado e salvo
3. ✅ Email é enviado com link do contrato
4. ✅ Candidato recebe link válido por 30 dias
5. ✅ Candidato pode acessar e aceitar termos
6. ✅ Sistema registra aceite e finaliza processo

**Próximo passo do candidato**: Clicar no link do email e aceitar os termos do contrato!

