# ETAPA 5 - Preenchimento dos Dados Contratuais (Plano Detalhado)

## Objetivo

Implementar formulário completo com abas (tabs) na página `/partner-terms` para coletar dados contratuais obrigatórios antes do aceite final. O formulário deve aparecer após o contrato e antes dos uploads de documentos.

## Especificações do Cliente

### Campos Obrigatórios

**Identificação Pessoal:**
- Full legal name
- Date of birth
- Nationality
- Country of residence
- Phone / WhatsApp
- Email (pré-preenchido)

**Endereço:**
- Full address (street, city, state, zip, country)

**Estrutura Fiscal / Empresarial:**
- Business type: Individual / Company
- Tax ID type: CNPJ / NIF / Equivalent
- Tax ID number
- Company legal name (se aplicável)

**Pagamento:**
- Preferred payout method
- Payout details (campos mínimos)

## Estrutura da Implementação

### 1. Migration SQL

**Arquivo**: `supabase/migrations/20250118000003_add_contractual_data_fields.sql`

```sql
-- Migration: Add contractual data fields to partner_terms_acceptances table

-- Identificação Pessoal
ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS full_legal_name TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS nationality TEXT,
ADD COLUMN IF NOT EXISTS country_of_residence TEXT,
ADD COLUMN IF NOT EXISTS phone_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Endereço
ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS address_country TEXT;

-- Estrutura Fiscal/Empresarial
ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS business_type TEXT CHECK (business_type IN ('Individual', 'Company')),
ADD COLUMN IF NOT EXISTS tax_id_type TEXT,
ADD COLUMN IF NOT EXISTS tax_id_number TEXT,
ADD COLUMN IF NOT EXISTS company_legal_name TEXT;

-- Pagamento
ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS preferred_payout_method TEXT,
ADD COLUMN IF NOT EXISTS payout_details TEXT;

-- Comentários
COMMENT ON COLUMN partner_terms_acceptances.full_legal_name IS 'Full legal name as provided by contractor';
COMMENT ON COLUMN partner_terms_acceptances.date_of_birth IS 'Date of birth of the contractor';
COMMENT ON COLUMN partner_terms_acceptances.nationality IS 'Nationality of the contractor';
COMMENT ON COLUMN partner_terms_acceptances.country_of_residence IS 'Country where contractor currently resides';
COMMENT ON COLUMN partner_terms_acceptances.phone_whatsapp IS 'Phone or WhatsApp number for contact';
COMMENT ON COLUMN partner_terms_acceptances.email IS 'Email address (pre-filled from application but editable)';
COMMENT ON COLUMN partner_terms_acceptances.business_type IS 'Business structure: Individual or Company';
COMMENT ON COLUMN partner_terms_acceptances.tax_id_type IS 'Type of tax ID: CNPJ, NIF, Equivalent, etc.';
COMMENT ON COLUMN partner_terms_acceptances.preferred_payout_method IS 'Preferred payment method: Wise, Stripe, Other';
```

### 2. Criar Componente Tabs (se não existir)

**Arquivo**: `src/components/ui/tabs.tsx` (NOVO, se não existir)

Usar shadcn/ui tabs component padrão. Se já existir, pular esta etapa.

### 3. Atualizar PartnerTerms.tsx

**Arquivo**: `src/pages/PartnerTerms.tsx`

#### 3.1. Adicionar Estados

```typescript
// Identificação Pessoal
const [fullLegalName, setFullLegalName] = useState<string>('');
const [dateOfBirth, setDateOfBirth] = useState<string>('');
const [nationality, setNationality] = useState<string>('');
const [countryOfResidence, setCountryOfResidence] = useState<string>('');
const [phoneWhatsapp, setPhoneWhatsapp] = useState<string>('');
const [email, setEmail] = useState<string>('');

// Endereço
const [addressStreet, setAddressStreet] = useState<string>('');
const [addressCity, setAddressCity] = useState<string>('');
const [addressState, setAddressState] = useState<string>('');
const [addressZip, setAddressZip] = useState<string>('');
const [addressCountry, setAddressCountry] = useState<string>('');

// Estrutura Fiscal/Empresarial
const [businessType, setBusinessType] = useState<'Individual' | 'Company' | ''>('');
const [taxIdType, setTaxIdType] = useState<string>('');
const [taxIdNumber, setTaxIdNumber] = useState<string>('');
const [companyLegalName, setCompanyLegalName] = useState<string>('');

// Pagamento
const [preferredPayoutMethod, setPreferredPayoutMethod] = useState<string>('');
const [payoutDetails, setPayoutDetails] = useState<string>('');

// Estado para controlar aba ativa
const [activeTab, setActiveTab] = useState<string>('personal');

// Estados de validação
const [formErrors, setFormErrors] = useState<Record<string, string>>({});
```

#### 3.2. Pré-preenchimento de Dados

```typescript
useEffect(() => {
  if (tokenData?.application_id) {
    supabase
      .from('global_partner_applications')
      .select('email, full_name, phone, country')
      .eq('id', tokenData.application_id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setEmail(data.email || '');
          setFullLegalName(data.full_name || '');
          setPhoneWhatsapp(data.phone || '');
          setCountryOfResidence(data.country || '');
          setAddressCountry(data.country || '');
        }
      });
  }
}, [tokenData]);
```

#### 3.3. Validação Intermediária

```typescript
const validateForm = (): boolean => {
  const errors: Record<string, string> = {};

  // Identificação Pessoal
  if (!fullLegalName.trim()) errors.fullLegalName = 'Full legal name is required';
  if (!dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
  else {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    if (birthDate >= today) errors.dateOfBirth = 'Date of birth must be in the past';
  }
  if (!nationality.trim()) errors.nationality = 'Nationality is required';
  if (!countryOfResidence.trim()) errors.countryOfResidence = 'Country of residence is required';
  if (!phoneWhatsapp.trim()) errors.phoneWhatsapp = 'Phone/WhatsApp is required';
  else if (!/^[\d\s\-\+\(\)]+$/.test(phoneWhatsapp)) {
    errors.phoneWhatsapp = 'Invalid phone format';
  }
  if (!email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format';
  }

  // Endereço
  if (!addressStreet.trim()) errors.addressStreet = 'Street address is required';
  if (!addressCity.trim()) errors.addressCity = 'City is required';
  if (!addressCountry.trim()) errors.addressCountry = 'Country is required';

  // Estrutura Fiscal/Empresarial
  if (!businessType) errors.businessType = 'Business type is required';
  if (businessType === 'Company') {
    if (!companyLegalName.trim()) errors.companyLegalName = 'Company legal name is required';
    if (!taxIdNumber.trim()) errors.taxIdNumber = 'Tax ID number is required';
  }

  // Pagamento
  if (!preferredPayoutMethod) errors.preferredPayoutMethod = 'Preferred payout method is required';
  if (!payoutDetails.trim()) errors.payoutDetails = 'Payout details are required';

  setFormErrors(errors);
  return Object.keys(errors).length === 0;
};
```

#### 3.4. Estrutura do Formulário com Tabs

Adicionar após o Card do contrato (após linha ~1225):

```tsx
{/* Card 2: Contractual Information */}
<Card className="mb-6 shadow-lg border border-gold-medium/30 bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10">
  <CardHeader className="text-center border-b border-gold-medium/30 bg-gradient-to-r from-gold-dark via-gold-medium to-gold-dark rounded-t-lg pb-6 pt-8">
    <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2 text-white">
      <span className="bg-white text-black rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border border-gold-medium/50">2</span>
      Contractual Information
    </CardTitle>
    <CardDescription className="text-base mt-3 text-gold-light">
      Please fill in all required contractual information
    </CardDescription>
  </CardHeader>
  <CardContent className="p-6 sm:p-8">
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6 bg-black/30">
        <TabsTrigger value="personal">Personal</TabsTrigger>
        <TabsTrigger value="address">Address</TabsTrigger>
        <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
        <TabsTrigger value="payment">Payment</TabsTrigger>
      </TabsList>

      {/* Tab 1: Personal Information */}
      <TabsContent value="personal" className="space-y-4">
        {/* Campos de identificação pessoal */}
      </TabsContent>

      {/* Tab 2: Address */}
      <TabsContent value="address" className="space-y-4">
        {/* Campos de endereço */}
      </TabsContent>

      {/* Tab 3: Fiscal/Business */}
      <TabsContent value="fiscal" className="space-y-4">
        {/* Campos fiscais/empresariais */}
      </TabsContent>

      {/* Tab 4: Payment */}
      <TabsContent value="payment" className="space-y-4">
        {/* Campos de pagamento */}
      </TabsContent>
    </Tabs>
  </CardContent>
</Card>
```

#### 3.5. Atualizar handleAccept

Adicionar validação e salvamento dos dados:

```typescript
// No início de handleAccept, antes de salvar
if (!validateForm()) {
  // Scroll para primeira aba com erro
  const firstErrorTab = getFirstErrorTab();
  setActiveTab(firstErrorTab);
  alert('Please fill in all required fields correctly');
  return;
}

// No updateData, adicionar:
const updateData: any = {
  // ... campos existentes ...
  
  // Dados contratuais
  full_legal_name: fullLegalName.trim(),
  date_of_birth: dateOfBirth || null,
  nationality: nationality.trim(),
  country_of_residence: countryOfResidence.trim(),
  phone_whatsapp: phoneWhatsapp.trim(),
  email: email.trim(),
  address_street: addressStreet.trim(),
  address_city: addressCity.trim(),
  address_state: addressState.trim(),
  address_zip: addressZip.trim(),
  address_country: addressCountry.trim(),
  business_type: businessType || null,
  tax_id_type: taxIdType.trim() || null,
  tax_id_number: taxIdNumber.trim() || null,
  company_legal_name: businessType === 'Company' ? companyLegalName.trim() : null,
  preferred_payout_method: preferredPayoutMethod || null,
  payout_details: payoutDetails.trim() || null,
};
```

#### 3.6. Atualizar Validação do Botão "I ACCEPT"

Adicionar verificação de formulário completo:

```typescript
disabled={
  !accepted || 
  !documentFrontUrl || 
  !documentBackUrl || 
  !identityPhotoPath || 
  !signatureName.trim() ||
  !isFormComplete() // Nova função
}
```

## Ordem de Execução Detalhada

1. **Criar migration SQL** (`20250118000003_add_contractual_data_fields.sql`)
2. **Aplicar migration** via MCP Supabase
3. **Verificar/criar componente Tabs** (`src/components/ui/tabs.tsx`)
4. **Adicionar todos os estados** em PartnerTerms.tsx
5. **Implementar pré-preenchimento** com useEffect
6. **Criar função de validação** validateForm()
7. **Criar função helper** getFirstErrorTab() para navegação
8. **Criar função helper** isFormComplete() para verificar se formulário está completo
9. **Implementar Tab 1: Personal Information** com todos os campos
10. **Implementar Tab 2: Address** com todos os campos
11. **Implementar Tab 3: Fiscal/Business** com campos condicionais
12. **Implementar Tab 4: Payment** com todos os campos
13. **Atualizar handleAccept** para validar e salvar dados
14. **Atualizar validação do botão** para incluir formulário
15. **Testar fluxo completo** com validações

## Validações Implementadas

### Validação Intermediária

- **Email**: Formato válido (regex básico)
- **Telefone**: Apenas caracteres permitidos (dígitos, espaços, hífens, parênteses, +)
- **Data de nascimento**: Deve ser no passado
- **Campos obrigatórios**: Todos marcados com `*`
- **Condicional**: Se `business_type = 'Company'`, `company_legal_name` e `tax_id_number` obrigatórios

## Estrutura Visual

### Layout em Tabs

- **4 abas**: Personal, Address, Fiscal, Payment
- **Indicadores visuais**: Mostrar quais abas estão completas
- **Navegação**: Permitir navegação livre entre abas
- **Validação visual**: Mostrar erros em campos específicos
- **Design consistente**: Usar cores gold, gradientes, manter estilo da página

### Campos por Aba

**Tab 1 - Personal:**
- Full Legal Name *
- Date of Birth * (input type="date")
- Nationality *
- Country of Residence *
- Phone / WhatsApp *
- Email * (pré-preenchido, editável)

**Tab 2 - Address:**
- Street Address *
- City *
- State/Province
- ZIP/Postal Code
- Country *

**Tab 3 - Fiscal:**
- Business Type * (Select: Individual / Company)
- Tax ID Type (Select: CNPJ / NIF / Equivalent / Other)
- Tax ID Number
- Company Legal Name * (condicional, só aparece se Company)

**Tab 4 - Payment:**
- Preferred Payout Method * (Select: Wise / Stripe / Other)
- Payout Details * (Textarea)

## Notas Importantes

- Email pré-preenchido mas editável
- `company_legal_name` só aparece se `business_type = 'Company'`
- Todos os dados salvos no mesmo registro `partner_terms_acceptances`
- Validação não bloqueia navegação entre abas, mas impede aceite se incompleto
- Manter design consistente com resto da página (gold theme, gradientes)

