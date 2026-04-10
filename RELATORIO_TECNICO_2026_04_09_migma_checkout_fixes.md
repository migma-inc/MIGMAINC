# Relatório Técnico — 09 de Abril de 2026
## MigmaCheckout: Correções de Assinatura, Fotos, Contratos e PDF

**Projeto:** migma-lp  
**Branch:** tracking-paulo  
**Engenheiro:** victuribdev + Claude Sonnet 4.6

---

## Resumo Executivo

Hoje foram resolvidos **5 problemas críticos** no fluxo do MigmaCheckout (checkout de alunos), que vai do preenchimento de dados pessoais até a geração do contrato PDF assinado. Os problemas envolviam assinatura digital, exibição de fotos de documentos, contratos duplicados, falha no carregamento de imagens privadas, e PDF incompleto com apenas 2 das 3 fotos esperadas.

---

## Problemas Resolvidos

---

### 1. Assinatura Digital — Substituição do Componente

**Problema:**  
O `MigmaCheckout` usava um componente de assinatura customizado (canvas HTML5 com texto escrito), enquanto o fluxo de `visa orders` anônimos usava a biblioteca profissional `signature_pad`. As assinaturas não eram equivalentes.

**Causa Raiz:**  
`Step1PersonalInfo.tsx` importava `SignatureCanvas` (componente interno simples), enquanto `signature-pad.tsx` usava `npm:signature_pad` com auto-confirmação por inatividade de 2.5s e geração de imagem PNG para salvar no bucket `visa-signatures`.

**Solução:**  
Substituído o `SignatureCanvas` pelo `SignaturePadComponent` em `src/pages/MigmaCheckout/components/Step1PersonalInfo.tsx`:

```tsx
// Antes
import SignatureCanvas from './SignatureCanvas';
<SignatureCanvas onChange={(dataUrl) => set('signature_data_url', dataUrl)} />

// Depois
import { SignaturePadComponent } from '../../../components/ui/signature-pad';
<SignaturePadComponent
  label="Assinatura Digital *"
  onSignatureChange={(dataUrl) => set('signature_data_url', dataUrl)}
  onSignatureConfirm={(dataUrl) => set('signature_data_url', dataUrl)}
  savedSignature={form.signature_data_url}
  isConfirmed={!!form.signature_data_url}
  height={160}
/>
```

**Arquivos alterados:**
- `src/pages/MigmaCheckout/components/Step1PersonalInfo.tsx`

---

### 2. "No Photos Found" no VisaContractApprovalPage

**Problema:**  
Contratos gerados via MigmaCheckout apareciam sem fotos na seção "Identification" da página `VisaContractApprovalPage`. Exibia "No photos found".

**Causa Raiz:**  
`VisaContractApprovalPage` busca fotos na tabela `identity_files` (indexada por `service_request_id`). O MigmaCheckout salvava os documentos apenas na tabela `student_documents` e no bucket `migma-student-documents`, mas nunca inseria na `identity_files`.

**Solução — duas frentes:**

**2a. Insert em `identity_files` no momento do upload** (`src/pages/MigmaCheckout/index.tsx`):

```typescript
if (state.serviceRequestId && docsForApi.length > 0) {
  const typeMap = {
    passport: 'document_front',
    passport_back: 'document_back',
    selfie_with_doc: 'selfie_doc',
  };
  const identityRows = docsForApi.map(doc => ({
    service_request_id: state.serviceRequestId,
    file_type: typeMap[doc.type] || doc.type,
    file_path: doc.file_url,
    file_name: doc.original_filename || doc.type,
    file_size: doc.file_size_bytes || 0,
  }));
  supabase.from('identity_files').insert(identityRows);
}
```

**2b. Fallback na UI** (`src/pages/VisaContractApprovalPage.tsx`):  
Se `identity_files` estiver vazio (ordens antigas), usa os campos da própria `visa_order`:

```tsx
const fallbackPhotos = [];
if (idFileList.length === 0) {
  if (order.contract_document_url)
    fallbackPhotos.push({ url: order.contract_document_url, label: 'Doc Front' });
  if (order.contract_document_back_url)
    fallbackPhotos.push({ url: order.contract_document_back_url, label: 'Doc Back' });
  if (order.contract_selfie_url)
    fallbackPhotos.push({ url: order.contract_selfie_url, label: 'Selfie' });
}
```

**Arquivos alterados:**
- `src/pages/MigmaCheckout/index.tsx`
- `src/pages/VisaContractApprovalPage.tsx`

---

### 3. Contratos Duplicados (Race Condition — React StrictMode)

**Problema:**  
Ao retornar do Stripe após o pagamento, dois contratos idênticos eram criados (ex: `MIGMA-COS-904564` e `MIGMA-COS-904575`) com o mesmo `service_request_id`.

**Causa Raiz:**  
O React StrictMode em desenvolvimento invoca `useEffect` duas vezes (mount → unmount → mount). O `handleStripeReturn` era chamado duas vezes em paralelo. A checagem de duplicidade no banco (`SELECT antes do INSERT`) não é atômica — ambas as chamadas passavam pela verificação antes de qualquer insert ser concluído.

**Solução:**  
Guard com `useRef` no frontend para garantir execução única:

```typescript
// src/pages/MigmaCheckout/index.tsx
const stripeHandledRef = useRef(false);

useEffect(() => {
  if (stripeSessionId) {
    if (stripeHandledRef.current) return; // segunda invocação ignorada
    stripeHandledRef.current = true;
    handleStripeReturn(stripeSessionId);
    window.history.replaceState({}, '', window.location.pathname);
  }
}, [stripeSessionId]);
```

**Arquivos alterados:**
- `src/pages/MigmaCheckout/index.tsx`

---

### 4. Fotos Falhando ao Carregar — Bucket Privado (403)

**Problema:**  
As fotos dos documentos apareciam com "Failed to load image. The file may be corrupted or inaccessible." na página de aprovação do contrato.

**Causa Raiz:**  
O bucket `migma-student-documents` é **privado** no Supabase Storage. A função `getSecureUrl()` em `src/lib/storage.ts` só fazia download seguro (via signed URL ou blob) para buckets listados em `privateBuckets`. O bucket `migma-student-documents` não estava na lista — a função retornava a URL pública direta, que resultava em HTTP 403.

**Solução:**  
Adicionado `migma-student-documents` ao array `privateBuckets` em `src/lib/storage.ts`:

```typescript
const privateBuckets = [
    'visa-documents',
    'visa-signatures',
    'contracts',
    'identity-photos',
    'partner-signatures',
    'cv-files',
    'migma-student-documents',  // ← ADICIONADO
];
```

Com isso, `getSecureUrl()` passa a tentar:
1. Download direto → `URL.createObjectURL()` (blob, melhor para iframes)
2. Signed URL com expiração de 1h (fallback)
3. Proxy via Edge Function (fallback final)

**Arquivos alterados:**
- `src/lib/storage.ts`

---

### 5. PDF do Contrato com Apenas 2 Fotos (Faltava o "Document Back")

**Problema:**  
O aluno faz upload de 3 documentos (frente, verso e selfie), mas o PDF gerado pelo contrato exibia apenas 2 fotos (frente + selfie). O verso do documento não aparecia.

**Causa Raiz:**  
Problema em cascata em 3 camadas:

| Camada | Problema |
|--------|----------|
| Banco de dados | Coluna `contract_document_back_url` não existia em `visa_orders` |
| Edge Function `migma-payment-completed` | Não buscava nem salvava a URL do `passport_back` |
| Edge Function `generate-visa-contract-pdf` | Sem fallback para `order.contract_document_back_url` — usava apenas `identity_files.document_back` |

**Solução — 3 passos encadeados (aplicados nesta ordem):**

**5a. Migration no banco de dados:**
```sql
ALTER TABLE public.visa_orders
ADD COLUMN IF NOT EXISTS contract_document_back_url TEXT;
```
Aplicado via `mcp__supabase__apply_migration` no projeto `ekxftwrjvxtpnqbraszv`.

**5b. Edge Function `migma-payment-completed` — deploy v23:**  
Adicionada busca do `passport_back` em `student_documents` e salvamento na nova coluna:

```typescript
const passportDoc     = docs?.find(d => d.type === 'passport')?.file_url || null;
const passportBackDoc = docs?.find(d => d.type === 'passport_back')?.file_url || null;  // ← NOVO
const selfieDoc       = docs?.find(d => d.type === 'selfie_with_doc')?.file_url || null;

// No insert da visa_orders:
contract_document_url:      passportDoc,
contract_document_back_url: passportBackDoc,  // ← NOVO
contract_selfie_url:        selfieDoc,
```

**5c. Edge Function `generate-visa-contract-pdf` — deploy v85:**  
Adicionado fallback para `order.contract_document_back_url` (linha 713):

```typescript
// Antes (v84):
const documentBackUrl = identityFiles.document_back || null;

// Depois (v85):
const documentBackUrl = identityFiles.document_back || order.contract_document_back_url || null;
```

A função já usa service role key, portanto consegue fazer download de imagens do bucket privado `migma-student-documents` via `supabase.storage.from(bucket).download(path)`.

**Arquivos alterados:**
- `supabase/functions/migma-payment-completed/index.ts` → deploy v23
- `supabase/functions/generate-visa-contract-pdf/index.ts` → deploy v85
- Migration SQL aplicada no banco `ekxftwrjvxtpnqbraszv`

---

### 6. Correções de TypeScript (TS2353)

**Problema:**  
Campos `service_type` e `service_request_id` passados no payload do checkout não estavam declarados nas interfaces TypeScript, gerando erros TS2353.

**Solução:**  
Adicionados campos opcionais nas interfaces em `src/lib/matriculaApi.ts`:

```typescript
// PaymentCompletedPayload:
service_type?: string;
service_request_id?: string;

// SaveDocumentsPayload:
service_request_id?: string;

// StudentStripeCheckoutPayload:
service_request_id?: string;
```

**Arquivos alterados:**
- `src/lib/matriculaApi.ts`

---

### 7. Persistência e Acesso da Assinatura Digital (Ajustes Finais)

**Problema:**  
Mesmo após a troca do componente, a assinatura digital continuava aparecendo como texto (email) no PDF final. Além disso, usuários logados que ainda não possuíam assinatura saltavam essa etapa sem assinar.

**Causa Raiz:**  
1. **Bucket Privado:** O bucket `visa-signatures` era privado, impedindo que o gerador de PDF (Edge Function) acessasse a imagem via URL pública.
2. **Pulo na Identificação:** Usuários identificados saltavam o campo de assinatura no Step 1, e se o perfil (tabela `user_profiles`) não tivesse uma assinatura salva, a ordem era criada com valor nulo.
3. **Falha no Upload (RLS/Formato):** O uso de `Blob` e a flag `upsert: true` no método de upload podiam causar falhas silenciosas dependendo do estado do RLS.

**Solução:**
- **Bucket Público:** Alterado o status do bucket `visa-signatures` para público (leitura).
- **Obrigatoriedade Inteligente:** No `Step1PersonalInfo.tsx`, a assinatura agora é obrigatória e exibida se `form.signature_data_url` (carregado do perfil) estiver vazio, mesmo para usuários logados.
- **Preview de Assinatura:** Adicionada uma prévia da assinatura existente com opção de "Re-assinar".
- **Refatoração do Upload:** Uso de `Uint8Array` e remoção da flag `upsert` para garantir compatibilidade máxima com o Supabase.

**Arquivos alterados:**
- `src/pages/MigmaCheckout/index.tsx`
- `src/pages/MigmaCheckout/components/Step1PersonalInfo.tsx`
- `src/pages/MigmaCheckout/components/SignatureCanvas.tsx` (remoção de delay)
- SQL Migration via MCP (Public Bucket)

---

## Resumo de Deployments

| Função | Versão Anterior | Versão Nova | Mudança Principal |
|--------|----------------|-------------|-------------------|
| `migma-payment-completed` | v22 | **v23** | Salva `contract_document_back_url` (passport_back) |
| `generate-visa-contract-pdf` | v84 | **v85** | Fallback `order.contract_document_back_url` no PDF |

---

## Resumo de Migrations SQL

| Banco | Tabela | Coluna Adicionada | Tipo |
|-------|--------|--------------------|------|
| `ekxftwrjvxtpnqbraszv` | `visa_orders` | `contract_document_back_url` | `TEXT` |

---

## Arquivos Modificados (Frontend)

| Arquivo | Mudança |
|---------|---------|
| `src/pages/MigmaCheckout/components/Step1PersonalInfo.tsx` | Componente de assinatura substituído por `SignaturePadComponent` |
| `src/pages/MigmaCheckout/index.tsx` | Guard `stripeHandledRef` + insert em `identity_files` após upload |
| `src/pages/VisaContractApprovalPage.tsx` | Fallback 3 fotos + interface `VisaOrder` com `contract_document_back_url` |
| `src/lib/storage.ts` | `migma-student-documents` adicionado a `privateBuckets` |
| `src/lib/matriculaApi.ts` | Campos opcionais nas interfaces TypeScript (TS2353) |

---

## Estado Atual

### Funcionando:
- ✅ Assinatura digital idêntica ao fluxo de visa orders (biblioteca `signature_pad`)
- ✅ Assinatura persistida corretamente e exibida no PDF (Bucket agora público)
- ✅ Fotos dos documentos aparecem no `VisaContractApprovalPage`
- ✅ Imagens do bucket privado `migma-student-documents` carregam corretamente
- ✅ Sem contratos duplicados — guard `useRef` previne double-invocation do React StrictMode
- ✅ PDF gerado com as 3 fotos para novos registros (v85 em produção)

### Pendências:
- ⏳ **PDFs existentes** gerados antes do deploy v85 ainda têm 2 fotos — precisam ser regenerados via botão "Regenerar Contrato" no painel admin (individualmente por ordem)
- ⏳ **Plano de Sync com Matricula USA** (`migma-create-student` refactoring) ainda pendente — aguardando env vars `MATRICULAUSA_SUPABASE_URL` e `MATRICULAUSA_SERVICE_ROLE_KEY` serem adicionadas nos Secrets do Supabase Dashboard

---

## Fluxo Completo do MigmaCheckout (Pós-Correções)

```
Step 1 — Dados Pessoais
  + Assinatura Digital (signature_pad — igual ao visa orders) ← CORRIGIDO
        ↓
  migma-create-student (v33)
  → Cria auth user no Migma
  → Upsert em user_profiles
        ↓
Step 2 — Upload de 3 Documentos (passport / passport_back / selfie_with_doc)
  → bucket: migma-student-documents (privado)
  → tabela: student_documents
  → tabela: identity_files                  ← NOVO (para exibição no admin)
        ↓
Step 3 — Pagamento
  [Stripe]
    migma-student-stripe-checkout (v4) → redireciona para Stripe
    stripe-visa-webhook (v78) → confirma pagamento
    useRef guard previne contrato duplicado ← CORRIGIDO

  [Zelle]
    submit manual → migma-payment-completed diretamente
        ↓
  migma-payment-completed (v23)
  → Upsert em user_profiles (has_paid_selection_process_fee: true)
  → INSERT em visa_orders:
      contract_document_url       (passport front)
      contract_document_back_url  (passport back)  ← NOVO
      contract_selfie_url         (selfie)
        ↓
  generate-visa-contract-pdf (v85)
  → Busca identity_files (se existir)
  → Fallback: order.contract_document_url / back_url / selfie_url
  → PDF com Document Front + Document Back + Selfie ← CORRIGIDO
  → Upload para bucket: contracts
        ↓
VisaContractApprovalPage (admin)
  → Fotos: identity_files OU fallback da visa_order
  → Imagens carregam via getSecureUrl() (signed URL/blob) ← CORRIGIDO
  → PDF disponível para download/aprovação
```
