# 📝 Análise Completa: Fluxo de Assinatura Global Partner

## 🎯 Objetivo
Documentar o fluxo completo de assinatura do Global Partner para replicar no Visa Service, especialmente a funcionalidade de **assinatura desenhada** (Signature Pad).

---

## 📋 FLUXO COMPLETO - GLOBAL PARTNER

### **1. Acesso à Página de Termos**
- Usuário recebe email com link contendo `token` único
- URL: `/partner-terms?token=migma_xxx...`
- Token é validado no banco (`partner_terms_acceptances`)
- Se válido, carrega template de contrato do banco

### **2. Proteção de Conteúdo**
- Hook `useContentProtection` ativado
- Bloqueio de:
  - Botão direito
  - Cópia/seleção de texto
  - Impressão (CSS + JS)
  - Screenshots (Netflix-style)
  - APIs de captura de tela

### **3. Aceite de Termos**
- Checkbox "I accept the terms and conditions"
- Estado: `accepted = true/false`

### **4. Preenchimento de Formulário (4 Steps)**
- **Step 1: Personal Information**
  - Full Legal Name
  - Date of Birth
  - Nationality
  - Country of Residence
  - Phone/WhatsApp
  - Email

- **Step 2: Address**
  - Street
  - City
  - State
  - ZIP
  - Country

- **Step 3: Fiscal/Business Data**
  - Business Type (Individual/Company)
  - Tax ID Type
  - Tax ID Number
  - Company Legal Name (se Company)

- **Step 4: Payment**
  - Preferred Payout Method
  - Payout Details

### **5. Upload de Documentos**
- **Document Front** (frente do documento)
- **Document Back** (verso do documento)
- **Selfie with Document** (selfie segurando documento)
- Componente: `DocumentUpload`
- Upload para bucket: `visa-documents`
- Estados: `documentFrontUrl`, `documentBackUrl`, `identityPhotoPath`

### **6. Assinatura Digital (Signature Pad)** ⭐ **PRINCIPAL**

#### **6.1. Componente**
- `SignaturePadComponent` (`src/components/ui/signature-pad.tsx`)
- Biblioteca: `signature_pad` (npm)
- Canvas HTML5 para desenho

#### **6.2. Estados**
```typescript
const [signatureImageDataUrl, setSignatureImageDataUrl] = useState<string | null>(null); // Base64
const [signatureConfirmed, setSignatureConfirmed] = useState<boolean>(false); // Botão Done clicado
```

#### **6.3. Fluxo de Uso**
1. Usuário desenha assinatura no canvas
2. `onSignatureChange` é chamado enquanto desenha (atualiza `signatureImageDataUrl`)
3. Usuário clica "Done" → `onSignatureConfirm` é chamado
4. `signatureConfirmed = true`
5. Componente se esconde (mostra apenas "✓ Confirmed")

#### **6.4. Validação**
- Antes de aceitar contrato, valida:
  ```typescript
  if (!signatureImageDataUrl || !signatureConfirmed) {
    // Erro: "You have not signed the contract..."
  }
  ```

#### **6.5. Upload para Storage**
- No `handleAccept()`:
  1. Converte base64 para Blob
  2. Cria File object
  3. Upload para bucket `partner-signatures`
  4. Path: `signatures/{timestamp}-{random}.png`
  5. Salva URL pública em `signature_image_url`

```typescript
// Converter base64 para blob
const base64Data = signatureImageDataUrl.split(',')[1];
const byteCharacters = atob(base64Data);
const byteNumbers = new Array(byteCharacters.length);
for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
}
const byteArray = new Uint8Array(byteNumbers);
const blob = new Blob([byteArray], { type: 'image/png' });

// Criar File
const fileName = `signatures/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
const file = new File([blob], fileName, { type: 'image/png' });

// Upload
const { error: uploadError } = await supabase.storage
    .from('partner-signatures')
    .upload(fileName, file, {
        contentType: 'image/png',
        upsert: false,
    });

// Obter URL pública
const { data: { publicUrl } } = supabase.storage
    .from('partner-signatures')
    .getPublicUrl(fileName);

updateData.signature_image_url = publicUrl;
```

### **7. Salvamento no Banco**
- Tabela: `partner_terms_acceptances`
- Campos salvos:
  - `accepted_at`: timestamp
  - `ip_address`: IP do cliente
  - `user_agent`: User agent
  - `identity_photo_path`: URL da selfie
  - `document_front_url`: URL documento frente
  - `document_back_url`: URL documento verso
  - `signature_image_url`: **URL da assinatura desenhada** ⭐
  - `signature_name`: Nome digitado (backward compatibility)
  - Dados contratuais (full_legal_name, address, etc.)
  - Dados legais (contract_version, contract_hash, geolocation)

### **8. Geração de PDF**
- Edge Function: `generate-contract-pdf`
- Busca `signature_image_url` do banco
- Carrega imagem do Storage
- Adiciona no PDF na seção de assinatura:

```typescript
const loadSignatureImage = async () => loadImage(termAcceptance.signature_image_url);

if (signatureImage) {
    pdf.addImage(
        signatureImage.dataUrl,
        signatureImage.format,
        margin,
        currentY,
        maxWidth: 45,
        maxHeight: 20
    );
}
```

---

## 🔄 DIFERENÇAS: Global Partner vs Visa Service

| Aspecto | Global Partner | Visa Service (Atual) |
|---------|---------------|---------------------|
| **Assinatura** | ✅ Signature Pad (desenhada) | ❌ Apenas nome digitado |
| **Selfie** | ✅ Upload obrigatório | ✅ Upload obrigatório |
| **Documentos** | ✅ Frente + Verso | ✅ Frente + Verso |
| **Template** | ✅ Dinâmico do banco | ✅ Dinâmico do banco |
| **PDF** | ✅ Inclui assinatura desenhada | ❌ Não inclui assinatura desenhada |
| **Storage** | `partner-signatures` | ❌ Não tem bucket para assinaturas |

---

## 📊 ESTRUTURA DO BANCO

### **Global Partner**
```sql
-- Tabela: partner_terms_acceptances
signature_image_url TEXT  -- URL da assinatura PNG
signature_name TEXT       -- Nome digitado (backward compatibility)
```

### **Visa Service (Atual)**
```sql
-- Tabela: visa_orders
contract_document_url TEXT      -- URL documento
contract_selfie_url TEXT        -- URL selfie
contract_signed_at TIMESTAMPTZ  -- Timestamp
contract_accepted BOOLEAN       -- Aceite
-- ❌ FALTA: signature_image_url
```

---

## 🎨 COMPONENTE SIGNATURE PAD

### **Props**
```typescript
interface SignaturePadComponentProps {
  onSignatureChange: (signatureDataUrl: string | null) => void;
  onSignatureConfirm?: (signatureDataUrl: string) => void;
  label?: string;
  required?: boolean;
  savedSignature?: string | null;  // Para restaurar
  isConfirmed?: boolean;            // Estado de confirmação
  width?: number;
  height?: number;
}
```

### **Funcionalidades**
- ✅ Canvas responsivo
- ✅ Suporte touch (mobile)
- ✅ Restauração de assinatura salva
- ✅ Validação de assinatura vazia
- ✅ Botão "Clear" para limpar
- ✅ Botão "Done" para confirmar
- ✅ Esconde componente após confirmação
- ✅ Salva automaticamente no localStorage

---

## 📝 PRÓXIMOS PASSOS - IMPLEMENTAÇÃO NO VISA SERVICE

### **1. Migration: Adicionar campo `signature_image_url`**
```sql
ALTER TABLE visa_orders
ADD COLUMN IF NOT EXISTS signature_image_url TEXT;
```

### **2. Criar bucket para assinaturas (ou usar existente)**
- Opção A: Criar `visa-signatures` (similar a `partner-signatures`)
- Opção B: Usar `visa-documents` com pasta `signatures/`

### **3. Adicionar SignaturePadComponent no Step 3**
- Local: `src/pages/VisaCheckout.tsx`
- Após aceitar termos, antes do botão de pagamento
- Estados: `signatureImageDataUrl`, `signatureConfirmed`

### **4. Validação antes de pagar**
- Verificar se assinatura foi confirmada
- Bloquear pagamento se não assinou

### **5. Upload da assinatura**
- Antes de criar `visa_order`
- Converter base64 → blob → file
- Upload para storage
- Salvar URL em `signature_image_url`

### **6. Atualizar geração de PDF**
- Edge Function: `generate-visa-contract-pdf`
- Buscar `signature_image_url` da ordem
- Carregar imagem
- Adicionar no PDF (similar ao Global Partner)

---

## 🔍 ARQUIVOS RELEVANTES

### **Global Partner**
- `src/pages/PartnerTerms.tsx` - Página principal
- `src/components/ui/signature-pad.tsx` - Componente de assinatura
- `supabase/functions/generate-contract-pdf/index.ts` - Geração PDF
- `supabase/migrations/20250119000001_add_signature_image_url.sql` - Migration

### **Visa Service (para atualizar)**
- `src/pages/VisaCheckout.tsx` - Checkout (adicionar SignaturePad)
- `supabase/functions/generate-visa-contract-pdf/index.ts` - PDF (adicionar assinatura)
- `supabase/migrations/` - Criar migration para `signature_image_url`

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Criar migration para adicionar `signature_image_url` em `visa_orders`
- [ ] Adicionar estados `signatureImageDataUrl` e `signatureConfirmed` no `VisaCheckout`
- [ ] Importar e adicionar `SignaturePadComponent` no Step 3
- [ ] Adicionar validação de assinatura antes de pagar
- [ ] Implementar upload da assinatura (base64 → blob → storage)
- [ ] Salvar `signature_image_url` ao criar `visa_order`
- [ ] Atualizar `generate-visa-contract-pdf` para buscar e incluir assinatura
- [ ] Testar fluxo completo: desenhar → confirmar → pagar → gerar PDF

---

## 🎯 RESULTADO ESPERADO

Após implementação, o fluxo de Visa Service terá:
1. ✅ Assinatura desenhada no Step 3
2. ✅ Validação obrigatória de assinatura
3. ✅ Upload automático para storage
4. ✅ Assinatura incluída no PDF gerado
5. ✅ Experiência idêntica ao Global Partner

