# 📄 Documentação Completa: Sistema de Formulário, Aprovação, Email e Geração de PDF com Selfie

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Fluxo Completo](#fluxo-completo)
4. [Componentes Frontend](#componentes-frontend)
5. [Edge Functions](#edge-functions)
6. [Banco de Dados](#banco-de-dados)
7. [Storage (Supabase)](#storage-supabase)
8. [Sistema de Email](#sistema-de-email)
9. [Sistema de Tokens](#sistema-de-tokens)
10. [Implementação Passo a Passo](#implementação-passo-a-passo)
11. [Exemplos de Código](#exemplos-de-código)
12. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

Este sistema permite que:
1. **Usuário preenche um formulário** de aplicação (Global Partner)
2. **Admin aprova** a aplicação manualmente
3. **Sistema envia email** com link único e tokenizado
4. **Usuário acessa o link** e visualiza os termos do contrato
5. **Usuário faz upload de selfie** com documento de identidade
6. **Usuário aceita os termos** eletronicamente
7. **Sistema gera PDF automaticamente** com a selfie embutida no documento

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO COMPLETO                            │
└─────────────────────────────────────────────────────────────┘

1. FORMULÁRIO
   ┌──────────────────┐
   │ GlobalPartner    │  Usuário preenche formulário
   │ Component        │  → Salva em global_partner_applications
   └────────┬─────────┘
            │
            ▼
2. APROVAÇÃO ADMIN
   ┌──────────────────┐
   │ Dashboard/Admin  │  Admin aprova aplicação
   │                  │  → Chama approveCandidateAndSendTermsLink()
   └────────┬─────────┘
            │
            ▼
3. GERAÇÃO DE TOKEN
   ┌──────────────────┐
   │ generateTermsToken│  Gera token único
   │                  │  → Salva em partner_terms_acceptances
   └────────┬─────────┘
            │
            ▼
4. ENVIO DE EMAIL
   ┌──────────────────┐
   │ sendTermsLinkEmail│  Envia email com link
   │                  │  → Link: /partner-terms?token={token}
   └────────┬─────────┘
            │
            ▼
5. ACESSO DO USUÁRIO
   ┌──────────────────┐
   │ PartnerTerms     │  Usuário acessa link
   │ Component        │  → Valida token
   │                  │  → Mostra termos
   └────────┬─────────┘
            │
            ▼
6. UPLOAD DE SELFIE
   ┌──────────────────┐
   │ IdentityPhotoUpload│ Usuário faz upload
   │                  │  → Chama Edge Function upload-identity-photo
   │                  │  → Salva em identity-photos bucket
   └────────┬─────────┘
            │
            ▼
7. ACEITE DE TERMOS
   ┌──────────────────┐
   │ handleAccept()   │  Usuário aceita termos
   │                  │  → Atualiza partner_terms_acceptances
   │                  │  → Salva identity_photo_path
   │                  │  → Salva IP, user_agent, accepted_at
   └────────┬─────────┘
            │
            ▼
8. GERAÇÃO DE PDF
   ┌──────────────────┐
   │ generate-contract-pdf│ Edge Function
   │                  │  → Busca dados da aplicação
   │                  │  → Busca selfie do storage
   │                  │  → Gera PDF com jsPDF
   │                  │  → Embuta selfie no PDF
   │                  │  → Salva PDF em contracts bucket
   │                  │  → Atualiza contract_pdf_url
   └──────────────────┘
```

---

## 🔄 Fluxo Completo

### **Etapa 1: Preenchimento do Formulário**

**Componente:** `src/pages/GlobalPartner.tsx`

```
Usuário acessa /global-partner
  ↓
Preenche formulário com:
  - Nome completo
  - Email
  - Telefone
  - Experiência
  - Por que quer trabalhar com MIGMA
  - Outros campos necessários
  ↓
Submete formulário
  ↓
Dados salvos em: global_partner_applications
  - status: 'pending'
  - created_at: NOW()
```

### **Etapa 2: Aprovação pelo Admin**

**Componente:** `src/pages/Dashboard.tsx` ou `src/pages/ApplicationDetailPage.tsx`

```
Admin acessa dashboard
  ↓
Visualiza aplicações pendentes
  ↓
Clica em "Aprovar"
  ↓
Chama: approveApplication(applicationId)
  ↓
Atualiza status: 'approved'
  ↓
Chama: approveCandidateAndSendTermsLink(applicationId)
```

### **Etapa 3: Geração de Token e Envio de Email**

**Função:** `src/lib/partner-terms.ts` → `approveCandidateAndSendTermsLink()`

```
1. Busca dados da aplicação (email, nome)
  ↓
2. Gera token único:
   token = `migma_${timestamp}_${random1}_${random2}`
  ↓
3. Calcula expiração (30 dias)
  ↓
4. Insere em partner_terms_acceptances:
   - application_id
   - token
   - expires_at
   - accepted_at: null (ainda não aceito)
  ↓
5. Envia email via sendTermsLinkEmail():
   - Link: https://app.com/partner-terms?token={token}
   - Template HTML com botão CTA
```

### **Etapa 4: Usuário Acessa o Link**

**Componente:** `src/pages/PartnerTerms.tsx`

```
Usuário clica no link do email
  ↓
Acessa: /partner-terms?token={token}
  ↓
Componente valida token:
  1. Busca token no banco
  2. Verifica se não expirou
  3. Verifica se ainda não foi aceito
  ↓
Se válido:
  - Mostra termos do contrato
  - Mostra seção de upload de selfie
  - Mostra checkbox de aceite
```

### **Etapa 5: Upload da Selfie**

**Componente:** `src/components/IdentityPhotoUpload.tsx`

```
Usuário faz upload da selfie:
  1. Seleciona arquivo (JPG/PNG, max 5MB)
  2. Valida tipo e tamanho
  3. Cria preview
  4. Upload automático via Edge Function
  ↓
Edge Function: upload-identity-photo
  - Recebe arquivo via FormData
  - Valida (tipo, tamanho)
  - Gera nome único: {timestamp}-{random}-identity.{ext}
  - Upload para bucket: identity-photos/photos/
  - Retorna: { success: true, filePath, fileName }
  ↓
Componente recebe:
  - filePath: "photos/1234567890-abc123-identity.jpg"
  - fileName: "selfie.jpg"
  ↓
Salva em state:
  - identityPhotoPath
  - identityPhotoName
```

### **Etapa 6: Aceite dos Termos**

**Função:** `handleAccept()` em `PartnerTerms.tsx`

```
Usuário:
  1. Marca checkbox "Aceito os termos"
  2. Clica em "I Agree and Accept These Terms"
  ↓
Validações:
  - ✅ Checkbox marcado
  - ✅ Selfie foi enviada
  - ✅ Token válido
  ↓
Captura dados:
  - IP address (via api.ipify.org)
  - User Agent (navigator.userAgent)
  - Data/hora atual
  ↓
Atualiza banco (partner_terms_acceptances):
  - accepted_at: NOW()
  - ip_address: "xxx.xxx.xxx.xxx"
  - user_agent: "Mozilla/5.0..."
  - identity_photo_path: "photos/1234567890-abc123-identity.jpg"
  - identity_photo_name: "selfie.jpg"
  ↓
Aguarda 2 segundos (para garantir persistência)
  ↓
Chama Edge Function: generate-contract-pdf
  - application_id
  - term_acceptance_id
  ↓
Redireciona para: /partner-terms/success
```

### **Etapa 7: Geração do PDF**

**Edge Function:** `supabase/functions/generate-contract-pdf/index.ts`

```
Recebe:
  {
    application_id: "uuid",
    term_acceptance_id: "uuid"
  }
  ↓
1. Busca dados da aplicação (global_partner_applications)
   - full_name, email, phone, etc.
  ↓
2. Busca dados do aceite (partner_terms_acceptances)
   - identity_photo_path
   - accepted_at
   - ip_address
   - user_agent
  ↓
3. Busca termos ativos (application_terms)
   - term_type: 'partner_contract'
   - is_active: true
   - Versão mais recente
  ↓
4. Carrega selfie do Storage
   - Bucket: identity-photos
   - Path: identity_photo_path
   - Converte para base64
  ↓
5. Gera PDF com jsPDF:
   - Header: "TERMS ACCEPTANCE DOCUMENT"
   - Informações do contratado
   - Termos e condições (HTML → texto)
   - Seção de assinatura
   - **SELFIE EMBUTIDA NO PDF**
   - Detalhes de aceite (IP, data, user agent)
   - Footer em todas as páginas
  ↓
6. Upload do PDF
   - Bucket: contracts
   - Path: contracts/contract_{name}_{date}_{timestamp}.pdf
  ↓
7. Atualiza banco
   - partner_terms_acceptances.contract_pdf_path
   - partner_terms_acceptances.contract_pdf_url
  ↓
Retorna:
  {
    success: true,
    pdf_url: "https://...",
    file_path: "contracts/..."
  }
```

---

## 🎨 Componentes Frontend

### **1. GlobalPartner Component**

**Localização:** `src/pages/GlobalPartner.tsx`

**Responsabilidades:**
- Exibir página de informações sobre o programa
- Formulário de aplicação
- Validação de campos
- Submissão para banco de dados

**Campos do Formulário:**
- Nome completo
- Email
- Telefone
- Experiência profissional
- Por que quer trabalhar com MIGMA
- Outros campos específicos

**Submissão:**
```typescript
const handleSubmit = async (formData) => {
  const { data, error } = await supabase
    .from('global_partner_applications')
    .insert({
      full_name: formData.name,
      email: formData.email,
      phone: formData.phone,
      // ... outros campos
      status: 'pending',
    });
  
  if (!error) {
    navigate('/global-partner/thank-you');
  }
};
```

### **2. PartnerTerms Component**

**Localização:** `src/pages/PartnerTerms.tsx`

**Responsabilidades:**
- Validar token da URL
- Exibir termos do contrato
- Gerenciar upload de selfie
- Processar aceite dos termos

**Validação de Token:**
```typescript
useEffect(() => {
  const validateToken = async () => {
    const token = searchParams.get('token');
    
    const { data } = await supabase
      .from('partner_terms_acceptances')
      .select('*, application_id')
      .eq('token', token)
      .single();
    
    // Verifica expiração
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    if (now > expiresAt) {
      setTokenValid(false);
      return;
    }
    
    // Verifica se já foi aceito
    if (data.accepted_at) {
      setTokenValid(false);
      return;
    }
    
    setTokenValid(true);
    setTokenData(data);
  };
  
  validateToken();
}, [token]);
```

**Aceite dos Termos:**
```typescript
const handleAccept = async () => {
  // Validações
  if (!accepted || !identityPhotoPath) return;
  
  // Captura IP e User Agent
  const ipAddress = await getClientIP();
  const userAgent = navigator.userAgent;
  
  // Atualiza banco
  const { data: updatedAcceptance } = await supabase
    .from('partner_terms_acceptances')
    .update({
      accepted_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
      identity_photo_path: identityPhotoPath,
      identity_photo_name: identityPhotoName,
    })
    .eq('token', token)
    .select()
    .single();
  
  // Chama Edge Function para gerar PDF
  await fetch(`${SUPABASE_URL}/functions/v1/generate-contract-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      application_id: tokenData.application_id,
      term_acceptance_id: updatedAcceptance.id,
    }),
  });
  
  navigate('/partner-terms/success');
};
```

### **3. IdentityPhotoUpload Component**

**Localização:** `src/components/IdentityPhotoUpload.tsx`

**Responsabilidades:**
- Interface de upload de selfie
- Validação de arquivo
- Upload via Edge Function
- Preview da imagem
- Feedback visual

**Upload:**
```typescript
const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  
  // Validação
  if (!ALLOWED_TYPES.includes(file.type)) {
    setError('Only JPG and PNG images are allowed');
    return;
  }
  
  if (file.size > MAX_FILE_SIZE) {
    setError('File size must be less than 5MB');
    return;
  }
  
  // Preview
  const reader = new FileReader();
  reader.onloadend = () => setPreview(reader.result as string);
  reader.readAsDataURL(file);
  
  // Upload
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/upload-identity-photo`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: formData,
    }
  );
  
  const result = await response.json();
  
  if (result.success) {
    onUploadSuccess(result.filePath, result.fileName);
  }
};
```

**Props:**
```typescript
interface IdentityPhotoUploadProps {
  onUploadSuccess: (filePath: string, fileName: string) => void;
  onUploadError?: (error: string) => void;
  onRemove?: () => void;
}
```

---

## ⚡ Edge Functions

### **1. upload-identity-photo**

**Localização:** `supabase/functions/upload-identity-photo/index.ts`

**Descrição:** Recebe arquivo de selfie e faz upload para o Storage.

**Input:**
```
FormData:
  file: File (JPG/PNG, max 5MB)
```

**Output:**
```json
{
  "success": true,
  "filePath": "photos/1234567890-abc123-identity.jpg",
  "fileName": "selfie.jpg"
}
```

**Processo:**
```typescript
Deno.serve(async (req) => {
  // 1. Recebe FormData
  const formData = await req.formData();
  const file = formData.get("file") as File;
  
  // 2. Validação
  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response(
      JSON.stringify({ success: false, error: "Only JPG and PNG allowed" }),
      { status: 400 }
    );
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return new Response(
      JSON.stringify({ success: false, error: "File too large" }),
      { status: 400 }
    );
  }
  
  // 3. Gera nome único
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${timestamp}-${randomString}-identity.${fileExtension}`;
  const filePath = `photos/${fileName}`;
  
  // 4. Upload para Storage
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase.storage
    .from('identity-photos')
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });
  
  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500 }
    );
  }
  
  // 5. Retorna path
  return new Response(
    JSON.stringify({ success: true, filePath: data.path, fileName: file.name }),
    { status: 200 }
  );
});
```

### **2. generate-contract-pdf**

**Localização:** `supabase/functions/generate-contract-pdf/index.ts`

**Descrição:** Gera PDF do contrato com selfie embutida.

**Input:**
```json
{
  "application_id": "uuid",
  "term_acceptance_id": "uuid"
}
```

**Output:**
```json
{
  "success": true,
  "pdf_url": "https://...",
  "file_path": "contracts/contract_..."
}
```

**Processo Detalhado:**

#### **1. Buscar Dados**
```typescript
// Busca aplicação
const { data: application } = await supabase
  .from('global_partner_applications')
  .select('*')
  .eq('id', application_id)
  .single();

// Busca aceite (com retry para garantir que foto foi salva)
let termAcceptance = null;
let attempts = 0;
while (attempts < 5 && (!termAcceptance || !termAcceptance.identity_photo_path)) {
  const { data } = await supabase
    .from('partner_terms_acceptances')
    .select('*')
    .eq('id', term_acceptance_id)
    .single();
  
  if (data && data.identity_photo_path) {
    termAcceptance = data;
    break;
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  attempts++;
}

// Busca termos ativos
const { data: termsData } = await supabase
  .from('application_terms')
  .select('title, content')
  .eq('term_type', 'partner_contract')
  .eq('is_active', true)
  .order('version', { ascending: false })
  .limit(1)
  .maybeSingle();
```

#### **2. Carregar Selfie**
```typescript
const loadIdentityPhoto = async () => {
  if (!termAcceptance.identity_photo_path) return null;
  
  // Download do Storage
  const { data: imageData, error } = await supabase.storage
    .from('identity-photos')
    .download(termAcceptance.identity_photo_path);
  
  let imageArrayBuffer: ArrayBuffer;
  let mimeType: string;
  
  if (error || !imageData) {
    // Fallback: tenta URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('identity-photos')
      .getPublicUrl(termAcceptance.identity_photo_path);
    
    const imageResponse = await fetch(publicUrl);
    const imageBlob = await imageResponse.blob();
    imageArrayBuffer = await imageBlob.arrayBuffer();
    mimeType = imageBlob.type;
  } else {
    imageArrayBuffer = await imageData.arrayBuffer();
    const ext = termAcceptance.identity_photo_path.split('.').pop();
    mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
  }
  
  // Converter para base64
  const bytes = new Uint8Array(imageArrayBuffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  const imageBase64 = btoa(binary);
  const imageFormat = mimeType.includes('png') ? 'PNG' : 'JPEG';
  const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;
  
  return { dataUrl: imageDataUrl, format: imageFormat };
};
```

#### **3. Gerar PDF**
```typescript
import { jsPDF } from "npm:jspdf@^2.5.1";

const pdf = new jsPDF();
const pageWidth = pdf.internal.pageSize.getWidth();
const pageHeight = pdf.internal.pageSize.getHeight();
const margin = 20;
let currentY = margin;

// Header
pdf.setFontSize(20);
pdf.setFont('helvetica', 'bold');
pdf.text('TERMS ACCEPTANCE DOCUMENT', pageWidth / 2, currentY, { align: 'center' });
currentY += 15;

// Informações do Contratado
pdf.setFontSize(14);
pdf.setFont('helvetica', 'bold');
pdf.text('CONTRACTOR INFORMATION', margin, currentY);
currentY += 12;

pdf.setFontSize(11);
pdf.setFont('helvetica', 'bold');
pdf.text('Name:', margin, currentY);
pdf.setFont('helvetica', 'normal');
pdf.text(application.full_name, margin + 30, currentY);
currentY += 8;
// ... outros campos

// Termos e Condições
if (termsData) {
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TERMS AND CONDITIONS', margin, currentY);
  currentY += 12;
  
  // Converter HTML para texto
  const textContent = convertHtmlToText(termsData.content);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  currentY = addWrappedText(textContent, margin, currentY, pageWidth - margin * 2, 10);
  currentY += 20;
}

// Seção de Assinatura com Selfie
const identityPhoto = await loadIdentityPhoto();
if (identityPhoto) {
  // Verifica se precisa de nova página
  if (currentY > pageHeight - margin - 80) {
    pdf.addPage();
    currentY = margin;
  }
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('IDENTITY PHOTO WITH DOCUMENT', margin, currentY);
  currentY += 8;
  
  // Adiciona imagem (max 60mm de largura, centralizada)
  const maxWidth = 60;
  const maxHeight = 45;
  pdf.addImage(
    identityPhoto.dataUrl,
    identityPhoto.format,
    margin,
    currentY,
    maxWidth,
    maxHeight
  );
  currentY += maxHeight + 10;
}

// Linha de assinatura
pdf.setFontSize(14);
pdf.text('⸻', pageWidth / 2, currentY, { align: 'center' });
currentY += 12;

// Nome do contratado
pdf.setFontSize(10);
pdf.setFont('helvetica', 'normal');
pdf.text('Signature:', margin, currentY);
pdf.setFont('helvetica', 'bold');
pdf.text(application.full_name, margin + 50, currentY);

// Detalhes de aceite
pdf.setFontSize(12);
pdf.setFont('helvetica', 'bold');
pdf.text('ACCEPTANCE DETAILS', margin, currentY);
currentY += 10;

if (termAcceptance.accepted_at) {
  const acceptedDate = new Date(termAcceptance.accepted_at);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Accepted on:', margin, currentY);
  pdf.setFont('helvetica', 'normal');
  pdf.text(acceptedDate.toLocaleString('en-US'), margin + 55, currentY);
  currentY += 10;
}

if (termAcceptance.ip_address) {
  pdf.setFont('helvetica', 'bold');
  pdf.text('IP Address:', margin, currentY);
  pdf.setFont('helvetica', 'normal');
  pdf.text(termAcceptance.ip_address, margin + 55, currentY);
  currentY += 10;
}

// Footer em todas as páginas
addFooter();

// Upload do PDF
const pdfBlob = pdf.output('blob');
const pdfArrayBuffer = await pdfBlob.arrayBuffer();
const pdfBuffer = new Uint8Array(pdfArrayBuffer);

const normalizedName = application.full_name
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '_');
const dateStr = new Date().toISOString().split('T')[0];
const timestamp = Date.now();
const fileName = `contract_${normalizedName}_${dateStr}_${timestamp}.pdf`;
const filePath = `contracts/${fileName}`;

const { error: uploadError } = await supabase.storage
  .from('contracts')
  .upload(filePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  });

const { data: { publicUrl } } = supabase.storage
  .from('contracts')
  .getPublicUrl(filePath);

// Atualiza banco
await supabase
  .from('partner_terms_acceptances')
  .update({
    contract_pdf_path: filePath,
    contract_pdf_url: publicUrl,
  })
  .eq('id', term_acceptance_id);

return new Response(
  JSON.stringify({ success: true, pdf_url: publicUrl, file_path: filePath }),
  { status: 200 }
);
```

---

## 🗄️ Banco de Dados

### **Tabela: global_partner_applications**

Armazena aplicações de parceiros globais.

```sql
CREATE TABLE global_partner_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  experience TEXT,
  why_migma TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Tabela: partner_terms_acceptances**

Armazena tokens e aceites de termos.

```sql
CREATE TABLE partner_terms_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES global_partner_applications(id),
  
  -- Token para acesso único
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Dados de aceite
  accepted_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  
  -- Foto de identidade
  identity_photo_path TEXT,  -- Path no storage: "photos/123-abc-identity.jpg"
  identity_photo_name TEXT,  -- Nome original: "selfie.jpg"
  
  -- PDF gerado
  contract_pdf_path TEXT,   -- Path do PDF: "contracts/contract_..."
  contract_pdf_url TEXT,     -- URL pública do PDF
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Tabela: application_terms**

Armazena versões dos termos do contrato.

```sql
CREATE TABLE application_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  term_type TEXT NOT NULL,  -- 'partner_contract'
  title TEXT NOT NULL,
  content TEXT NOT NULL,    -- HTML
  version TEXT NOT NULL,    -- 'v1.0-2025-01-15'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📦 Storage (Supabase)

### **Bucket: identity-photos**

Armazena fotos de identidade (selfies com documento).

**Estrutura:**
```
identity-photos/
└── photos/
    └── {timestamp}-{random}-identity.{ext}
```

**Exemplo:**
```
photos/1704067200000-abc123def456-identity.jpg
```

**Políticas RLS:**
- Upload: Apenas Edge Functions (service role)
- Leitura: Público (para URLs públicas)

### **Bucket: contracts**

Armazena PDFs de contratos gerados.

**Estrutura:**
```
contracts/
└── contracts/
    └── contract_{name}_{date}_{timestamp}.pdf
```

**Exemplo:**
```
contracts/contract_joao_silva_2025-01-15_1704067200000.pdf
```

**Políticas RLS:**
- Upload: Apenas Edge Functions (service role)
- Leitura: Público (para URLs públicas)

---

## 📧 Sistema de Email

### **Função: sendTermsLinkEmail**

**Localização:** `src/lib/emails.ts`

**Responsabilidades:**
- Enviar email de aprovação
- Incluir link com token
- Template HTML responsivo

**Template:**
```typescript
export async function sendTermsLinkEmail(
  email: string,
  fullName: string,
  token: string,
  baseUrl?: string
): Promise<boolean> {
  const origin = baseUrl || getBaseUrl();
  const termsUrl = `${origin}/partner-terms?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
      <h1>Congratulations!</h1>
      <p>Your application has been approved</p>
      <p>Dear ${fullName},</p>
      <p>We are thrilled to inform you that your application has been approved!</p>
      <ol>
        <li>Review our Global Independent Contractor Terms & Conditions</li>
        <li>Upload a photo of yourself with your identity document</li>
        <li>Accept the terms to finalize your partnership</li>
      </ol>
      <a href="${termsUrl}">Review and Accept Terms</a>
      <p>Or copy and paste: ${termsUrl}</p>
    </body>
    </html>
  `;
  
  // Envia via Edge Function send-email
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      to: email,
      subject: 'Congratulations! Your Application Has Been Approved',
      html: html,
    }),
  });
  
  return response.ok;
}
```

---

## 🔐 Sistema de Tokens

### **Geração de Token**

**Função:** `generateTermsToken()`

```typescript
export async function generateTermsToken(
  applicationId: string,
  expiresInDays: number = 30
): Promise<{ token: string; expiresAt: Date } | null> {
  // Gera token único
  const token = `migma_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
  
  // Calcula expiração
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  
  // Insere no banco
  const { error } = await supabase
    .from('partner_terms_acceptances')
    .insert({
      application_id: applicationId,
      token: token,
      expires_at: expiresAt.toISOString(),
    });
  
  if (error) return null;
  
  return { token, expiresAt };
}
```

### **Validação de Token**

**Função:** `validateTermsToken()`

```typescript
export async function validateTermsToken(token: string) {
  const { data, error } = await supabase
    .from('partner_terms_acceptances')
    .select('*, application_id')
    .eq('token', token)
    .single();
  
  if (error || !data) return null;
  
  // Verifica expiração
  const now = new Date();
  const expiresAt = new Date(data.expires_at);
  if (now > expiresAt) return null;
  
  // Verifica se já foi aceito
  if (data.accepted_at) return null;
  
  return data;
}
```

---

## 🛠️ Implementação Passo a Passo

### **Passo 1: Criar Tabelas no Banco**

```sql
-- Tabela de aplicações
CREATE TABLE IF NOT EXISTS global_partner_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  experience TEXT,
  why_migma TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de aceites
CREATE TABLE IF NOT EXISTS partner_terms_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES global_partner_applications(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  identity_photo_path TEXT,
  identity_photo_name TEXT,
  contract_pdf_path TEXT,
  contract_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de termos
CREATE TABLE IF NOT EXISTS application_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  term_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Passo 2: Criar Buckets no Storage**

1. Acesse Supabase Dashboard > Storage
2. Crie bucket `identity-photos`
3. Crie bucket `contracts`
4. Configure políticas RLS (público para leitura, service role para escrita)

### **Passo 3: Criar Edge Functions**

**upload-identity-photo:**
```bash
supabase functions new upload-identity-photo
# Copie código da função
supabase functions deploy upload-identity-photo
```

**generate-contract-pdf:**
```bash
supabase functions new generate-contract-pdf
# Copie código da função
supabase functions deploy generate-contract-pdf
```

### **Passo 4: Criar Componentes Frontend**

1. **GlobalPartner.tsx** - Formulário de aplicação
2. **PartnerTerms.tsx** - Página de aceite de termos
3. **IdentityPhotoUpload.tsx** - Componente de upload

### **Passo 5: Criar Funções de Apoio**

1. **partner-terms.ts** - Geração e validação de tokens
2. **emails.ts** - Envio de emails
3. **admin.ts** - Funções administrativas

### **Passo 6: Integrar no Dashboard Admin**

```typescript
// No componente de admin
const handleApprove = async (applicationId: string) => {
  const { success } = await approveApplication(applicationId);
  if (success) {
    // Atualiza UI
    refreshApplications();
  }
};
```

---

## 💻 Exemplos de Código

### **Exemplo 1: Aprovar Aplicação e Enviar Email**

```typescript
import { approveCandidateAndSendTermsLink } from '@/lib/partner-terms';

const approveApplication = async (applicationId: string) => {
  // 1. Atualiza status
  await supabase
    .from('global_partner_applications')
    .update({ status: 'approved' })
    .eq('id', applicationId);
  
  // 2. Gera token e envia email
  const token = await approveCandidateAndSendTermsLink(applicationId);
  
  if (token) {
    console.log('Email sent with token:', token);
  }
};
```

### **Exemplo 2: Validar Token na Página**

```typescript
const [searchParams] = useSearchParams();
const token = searchParams.get('token');

useEffect(() => {
  const validateToken = async () => {
    if (!token) {
      setTokenValid(false);
      return;
    }
    
    const { data } = await supabase
      .from('partner_terms_acceptances')
      .select('*, application_id')
      .eq('token', token)
      .single();
    
    if (!data) {
      setTokenValid(false);
      return;
    }
    
    // Verifica expiração
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    if (now > expiresAt) {
      setTokenValid(false);
      return;
    }
    
    // Verifica se já foi aceito
    if (data.accepted_at) {
      setTokenValid(false);
      return;
    }
    
    setTokenValid(true);
    setTokenData(data);
  };
  
  validateToken();
}, [token]);
```

### **Exemplo 3: Capturar IP do Cliente**

```typescript
const getClientIP = async (): Promise<string | null> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || null;
  } catch (error) {
    console.warn('Could not fetch IP address:', error);
    return null;
  }
};
```

### **Exemplo 4: Carregar Selfie no PDF (Edge Function)**

```typescript
const loadIdentityPhoto = async (photoPath: string) => {
  // Download do Storage
  const { data: imageData, error } = await supabase.storage
    .from('identity-photos')
    .download(photoPath);
  
  if (error || !imageData) {
    // Fallback: URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('identity-photos')
      .getPublicUrl(photoPath);
    
    const response = await fetch(publicUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const mimeType = blob.type;
    
    // Converter para base64
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    
    const base64 = btoa(binary);
    const format = mimeType.includes('png') ? 'PNG' : 'JPEG';
    
    return {
      dataUrl: `data:${mimeType};base64,${base64}`,
      format: format
    };
  }
  
  // Mesmo processo se download direto funcionou
  // ...
};
```

---

## 🔧 Troubleshooting

### **Problema 1: Token Inválido ou Expirado**

**Sintomas:**
- Página mostra "Invalid or expired token"
- Token não encontrado no banco

**Soluções:**
```typescript
// Verificar se token existe
const { data } = await supabase
  .from('partner_terms_acceptances')
  .select('*')
  .eq('token', token)
  .single();

// Verificar expiração
const now = new Date();
const expiresAt = new Date(data.expires_at);
if (now > expiresAt) {
  console.error('Token expired');
}

// Verificar se já foi usado
if (data.accepted_at) {
  console.error('Token already used');
}
```

### **Problema 2: Selfie Não Aparece no PDF**

**Sintomas:**
- PDF gerado mas sem imagem
- Erro ao carregar imagem

**Soluções:**
```typescript
// Verificar path no banco
console.log('Photo path:', termAcceptance.identity_photo_path);

// Tentar múltiplos métodos de carregamento
// 1. Download direto
const { data } = await supabase.storage
  .from('identity-photos')
  .download(photoPath);

// 2. URL pública
const { data: { publicUrl } } = supabase.storage
  .from('identity-photos')
  .getPublicUrl(photoPath);

// 3. Verificar se arquivo existe
const { data: files } = await supabase.storage
  .from('identity-photos')
  .list('photos');
```

### **Problema 3: Email Não Enviado**

**Sintomas:**
- Aplicação aprovada mas email não chega
- Erro na Edge Function send-email

**Soluções:**
```typescript
// Verificar logs da Edge Function
// Supabase Dashboard > Edge Functions > Logs

// Verificar configuração SMTP
// Verificar se função send-email está deployada

// Testar envio manual
const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANON_KEY}`,
  },
  body: JSON.stringify({
    to: 'test@example.com',
    subject: 'Test',
    html: '<p>Test</p>',
  }),
});
```

### **Problema 4: PDF Não Gerado**

**Sintomas:**
- Aceite salvo mas PDF não aparece
- Erro na Edge Function

**Soluções:**
```typescript
// Verificar se função foi chamada
console.log('Calling PDF generation:', {
  application_id,
  term_acceptance_id
});

// Verificar logs
// Supabase Dashboard > Edge Functions > generate-contract-pdf > Logs

// Verificar se dados estão completos
const { data: acceptance } = await supabase
  .from('partner_terms_acceptances')
  .select('*')
  .eq('id', term_acceptance_id)
  .single();

console.log('Acceptance data:', acceptance);
console.log('Photo path:', acceptance.identity_photo_path);
```

---

## ✅ Checklist de Implementação

- [ ] Criar tabelas no banco de dados
- [ ] Criar buckets no Storage
- [ ] Configurar políticas RLS
- [ ] Criar Edge Function upload-identity-photo
- [ ] Criar Edge Function generate-contract-pdf
- [ ] Criar componente GlobalPartner (formulário)
- [ ] Criar componente PartnerTerms (aceite)
- [ ] Criar componente IdentityPhotoUpload
- [ ] Implementar geração de tokens
- [ ] Implementar validação de tokens
- [ ] Implementar envio de emails
- [ ] Integrar no dashboard admin
- [ ] Testar fluxo completo end-to-end
- [ ] Adicionar tratamento de erros
- [ ] Adicionar logs para debugging
- [ ] Documentar para outros desenvolvedores

---

## 🎓 Conclusão

Este sistema fornece uma solução completa para:
- ✅ Formulário de aplicação
- ✅ Aprovação administrativa
- ✅ Geração de tokens únicos
- ✅ Envio de emails com links seguros
- ✅ Upload seguro de selfies
- ✅ Assinatura eletrônica de contratos
- ✅ Geração automática de PDFs com selfie embutida
- ✅ Rastreamento completo (IP, data/hora, user agent)

A arquitetura é escalável, segura e pode ser adaptada para diferentes casos de uso, mantendo a integridade e rastreabilidade das assinaturas eletrônicas.


