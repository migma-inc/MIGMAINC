# generate-institution-forms — Documentação Técnica

Edge Function Supabase (Deno) responsável por gerar os PDFs de formulários institucionais preenchidos com dados do aluno e salvá-los no Storage.

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Arquitetura — fluxo completo](#2-arquitetura--fluxo-completo)
3. [Secrets / variáveis de ambiente](#3-secrets--variáveis-de-ambiente)
4. [Storage](#4-storage)
5. [Sistema de coordenadas dos PDFs](#5-sistema-de-coordenadas-dos-pdfs)
6. [Tipos de campo](#6-tipos-de-campo)
7. [Como adicionar um novo formulário (passo a passo)](#7-como-adicionar-um-novo-formulário-passo-a-passo)
8. [Como editar coordenadas de um formulário existente](#8-como-editar-coordenadas-de-um-formulário-existente)
9. [Formulários implementados](#9-formulários-implementados)
10. [Fontes de dados disponíveis](#10-fontes-de-dados-disponíveis)
11. [Testes locais](#11-testes-locais)
12. [Testes em produção](#12-testes-em-produção)
13. [Deploy](#13-deploy)
14. [Gaps conhecidos](#14-gaps-conhecidos)

---

## 1. Visão geral

Os formulários das instituições são PDFs visuais — sem campos AcroForm. O preenchimento é feito sobrepondo texto e checkboxes ("X") diretamente nas coordenadas corretas do template usando a biblioteca **pdf-lib**.

A function:
1. Recebe um `application_id`
2. Busca dados do aluno no banco (perfil, identidade, survey, supplemental)
3. Determina quais formulários gerar com base na instituição
4. Para cada formulário: monta os dados, gera o PDF preenchido, faz upload no Storage
5. Salva os registros em `institution_forms` com as URLs públicas
6. Notifica o aluno via `migma-notify`

---

## 2. Arquitetura — fluxo completo

```
POST /generate-institution-forms
  { application_id: "uuid" }
        │
        ▼
  Busca institution_applications + institutions + institution_scholarships + institution_courses
        │
        ▼
  Valida status === "payment_confirmed"  (rejeita se não)
        │
        ▼
  Busca user_profiles + selection_survey_responses + user_identity
        │
        ▼
  Determina lista de forms pelo slug da instituição:
    - "caroline" → CAROLINE_FORMS
    - "oikos"    → OIKOS_FORMS
    - outros     → fallback genérico
        │
        ▼
  Para cada form_type:
    buildFormData(formType, ...)   → Record<string, any>  (dados normalizados)
    generateFormPdf(formType, ...) → Uint8Array            (bytes do PDF)
    supabase.storage.upload(...)                           (salva no Storage)
    supabase.from("institution_forms").upsert(...)         (salva URL no DB)
        │
        ▼
  Atualiza application.forms_status = "generated"
        │
        ▼
  Invoca migma-notify com trigger "forms_generated"
        │
        ▼
  Retorna { success, forms_generated, form_types, form_ids }
```

### Principais funções internas

| Função | Responsabilidade |
|---|---|
| `buildFormData(formType, ...)` | Dispatcher — chama o builder correto para cada form_type |
| `buildCarolineApplicationFormData(...)` | Monta dados para o Application for Admission da Caroline |
| `buildCarolineI20RequestFormData(...)` | Monta dados para o I-20 Request da Caroline |
| `buildOikosApplicationPacketData(...)` | Monta dados para o Application Packet da Oikos |
| `generateFormPdf(formType, ...)` | Dispatcher — chama o gerador correto para cada form_type |
| `generateCarolineApplicationFormPdf(...)` | Gera o PDF de admissão da Caroline |
| `generateCarolineI20RequestFormPdf(...)` | Gera o PDF I-20 da Caroline |
| `loadPdfTemplate(filename)` | Carrega o PDF template do Storage ou do sistema de arquivos |
| `drawPacketTextField(...)` | Desenha texto sobreposto no PDF |
| `drawPacketCheckbox(...)` | Desenha "X" de checkbox no PDF |
| `resolveOverlayTextValue(...)` | Resolve o valor de um campo de texto pelo `source` (dot-notation) |
| `getValueAtPath(obj, path)` | Navegação dot-notation: `"student.firstName"`, `"dependents.0.name"` |

---

## 3. Secrets / variáveis de ambiente

| Secret | Obrigatório em prod | Descrição |
|---|---|---|
| `SUPABASE_URL` | Auto-injetado | URL da instância Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injetado | Chave de serviço do Supabase |
| `REMOTE_SUPABASE_URL` | Opcional | Sobrescreve `SUPABASE_URL` — usado em modo híbrido local |
| `REMOTE_SUPABASE_SERVICE_ROLE_KEY` | Opcional | Sobrescreve `SUPABASE_SERVICE_ROLE_KEY` |
| `PDF_TEMPLATE_BASE_URL` | **Obrigatório em prod** | URL base do bucket `pdf-templates` no Storage. Em produção: `https://<project>.supabase.co/storage/v1/object/public/pdf-templates/`. Em dev local: `http://host.docker.internal:8011/` |
| `APP_BASE_URL` | Opcional | URL base do frontend para notificações. Padrão: `https://migmainc.com` |

> `PDF_TEMPLATE_BASE_URL` é crítico em produção. Sem ele, a function tenta ler os PDFs do sistema de arquivos local da edge, onde eles não existem — resultando em erro "template file not found".

---

## 4. Storage

Dois buckets são usados:

| Bucket | Visibilidade | Conteúdo |
|---|---|---|
| `pdf-templates` | **Público** | Templates em branco dos formulários (fonte de leitura pela function) |
| `institution-forms` | **Público** | PDFs gerados e preenchidos com dados dos alunos |

### Caminho dos arquivos gerados

```
institution-forms/{profile_id}/{application_id}/{form_type}.pdf
```

Exemplo:
```
institution-forms/68f96a83-.../a7402309-.../application_for_admission.pdf
```

### Adicionar um novo template ao Storage

Após colocar o arquivo PDF em `templates/`, é necessário fazer upload para o bucket `pdf-templates` antes de fazer deploy:

```powershell
$file = "C:\...\templates\NomeDoTemplate.pdf"
$encoded = [Uri]::EscapeDataString("NomeDoTemplate.pdf")
Invoke-WebRequest `
  -Uri "https://<project>.supabase.co/storage/v1/object/pdf-templates/$encoded" `
  -Method POST `
  -Headers @{ Authorization = "Bearer <SERVICE_ROLE_KEY>"; "Content-Type" = "application/pdf" } `
  -InFile $file
```

---

## 5. Sistema de coordenadas dos PDFs

Os templates são PDFs visuais. As coordenadas são medidas em **pontos tipográficos** (1 pt ≈ 0,35 mm).

### Origem do sistema usado no código

- `x`: distância do lado **esquerdo** da página
- `top`: distância do **topo** da página

A função `topToPdfY(page, top, fontSize)` converte para o sistema interno do pdf-lib (que usa origem no canto inferior esquerdo):

```typescript
return page.getHeight() - top - fontSize;
```

### Offset de fontSize

`topToPdfY` subtrai `fontSize` além do `top`. Por isso, ao mapear coordenadas com o `pdf_mapper.py`:

**Campos de texto:** o `top` mapeado deve ter o `fontSize` subtraído antes de entrar no código.
```
top_no_código = top_mapeado - fontSize
```

**Checkboxes:** `drawPacketCheckbox` usa internamente `fontSize = 10`, então o mesmo offset de 10 se aplica.

> Atenção: o mapeador `pdf_mapper.py` em `pdf-local-tests/` pode já exportar os valores com o offset subtraído ou não. Sempre confirme com quem fez o mapeamento antes de subtrair.

### Ferramenta de mapeamento — `pdf_mapper.py`

GUI interativa (PyMuPDF + tkinter) para obter as coordenadas exatas de qualquer ponto de um PDF template.

#### Dependências

```bash
pip install pymupdf pillow
# tkinter já vem com Python no Windows; no Linux: sudo apt install python3-tk
```

#### Como abrir

```bash
cd pdf-local-tests

# Abrindo diretamente com o arquivo (recomendado)
python pdf_mapper.py "../pdf-template/NomeDoArquivo.pdf"

# Sem argumento — abre um seletor de arquivo
python pdf_mapper.py
```

#### Interface

```
┌─────────────────────────────────────────────────────────────┐
│ [Abrir PDF] [◀ Pág anterior] [Próxima pág ▶] [Limpar] [Exportar JSON]   Pág 1/2 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Grade de referência (azul = x, laranja = top, a cada 50pt)│
│                                                             │
│   ● ponto marcado (vermelho) com label "1: x=120.0 top=182.0"│
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ pág 1 | x=243.5  top=181.0  (canvas 487,362)               │ ← status bar
└─────────────────────────────────────────────────────────────┘
```

- **Hover** → status bar mostra `x` e `top` em tempo real (em pontos tipográficos)
- **Clique esquerdo** → captura o ponto, marca com círculo vermelho na tela e copia `{"x": ..., "top": ...}` para o clipboard
- **Exportar JSON** → salva todos os pontos clicados (de todas as páginas) em um arquivo `.json`
- **Limpar pontos da página** → apaga os markers da página atual (sem afetar outras páginas)
- **◀ / ▶** → navega entre páginas do PDF

#### Formato exportado

```json
{
  "pdf": "../pdf-template/NomeDoArquivo.pdf",
  "dpi": 144,
  "coordinate_system": "x=from_left, top=from_top (index.ts compatible)",
  "page_size_pt": {
    "1": { "width": 612.0, "height": 792.0 }
  },
  "points": {
    "1": [
      { "x": 120.5, "top": 182.0 },
      { "x": 363.5, "top": 134.5 }
    ]
  }
}
```

As coordenadas já estão no sistema do `index.ts` (`x` da esquerda, `top` do topo) — não há conversão necessária. O DPI interno é 144 (2× o padrão de 72), mas as coordenadas exportadas são sempre em **pontos tipográficos**, não em pixels.

#### Offset de fontSize — regra crítica

O mapper exporta o `top` do ponto clicado **sem nenhum desconto de fonte**. Mas `topToPdfY` (usada internamente) subtrai `fontSize` do `top`. Isso significa:

| Tipo de campo | O que fazer com o `top` do mapper |
|---|---|
| Texto (`OverlayTextField`) | Subtrair o `fontSize` do campo antes de colocar no código |
| Checkbox (`PacketCheckboxField`) | Subtrair `10` (fontSize fixo interno do `drawPacketCheckbox`) |

Exemplo: mapper exportou `top: 192` para um campo de texto com `fontSize: 10` → no código usar `top: 182`.

> Exceção: se quem fez o mapeamento já subtraiu o offset antes de exportar, usar os valores diretamente. **Sempre confirmar** com quem gerou o JSON antes de aplicar o desconto.

#### Workflow típico para um novo form

```text
1. python pdf_mapper.py "../pdf-template/NomeDoForm.pdf"
2. Navegar até a página correta com ◀ ▶
3. Clicar no início de cada campo (canto superior esquerdo do texto)
4. Adicionar comentário no JSON exportado indicando qual campo é qual
5. Subtrair fontSize de cada top antes de colocar na constante V1 do index.ts
6. Testar visualmente com testar_pdf.ps1
7. Ajustar top/x iterativamente até alinhar
```

---

## 6. Tipos de campo

### `OverlayTextField`

Campo de texto sobreposto. Propriedades:

```typescript
{
  page: 0,           // índice da página (0-based)
  x: 120,            // posição horizontal em pt
  top: 182,          // distância do topo em pt (já com fontSize subtraído)
  maxWidth: 200,     // largura máxima disponível em pt
  fontSize: 10,      // tamanho da fonte
  minFontSize: 8,    // encolhe automaticamente até aqui para caber no maxWidth
  source: "student.firstName",  // caminho dot-notation no objeto de dados
  optional: true,    // se true, não loga erro quando o valor for vazio
  align: "left",     // "left" (default), "right", "center"
  transform: "date_mm",  // (opcional) transformação do valor
}
```

**Transforms disponíveis:**

| Transform | Resultado |
|---|---|
| `"date_mm"` | Extrai mês de uma data no formato `MM/DD/YYYY` |
| `"date_dd"` | Extrai dia |
| `"date_yyyy"` | Extrai ano |
| `"student_display_name"` | Monta `firstName + lastName` a partir de `student.*` |

### `PacketCheckboxField`

Checkbox (renderiza "X" se a condição for verdadeira). Propriedades:

```typescript
{
  page: 0,
  x: 59,
  top: 400,          // já com 10 subtraído (drawPacketCheckbox usa fontSize=10 internamente)
  source: "student.degreeProgram",
  equals: "mba",     // renderiza "X" se source === equals (case-insensitive)
}
```

O `equals` também suporta comparação com booleanos: `equals: true` ou `equals: false`.

---

## 7. Como adicionar um novo formulário (passo a passo)

### Passo 1 — Definir constante do nome do template

No topo do `index.ts`, junto com os outros `*_TEMPLATE_FILENAME`:

```typescript
const CAROLINE_XPTO_TEMPLATE_FILENAME = "NomeExato.pdf";
```

### Passo 2 — Copiar template para dois lugares

```powershell
# Para uso em dev local (servidor Python)
Copy-Item "pdf-template\NomeExato.pdf" "pdf-template\"   # já está lá

# Para bundling com a function
Copy-Item "pdf-template\NomeExato.pdf" `
  "MIGMAINC\supabase\functions\generate-institution-forms\templates\"
```

Fazer upload para o bucket `pdf-templates` no Supabase (ver seção 4).

### Passo 3 — Criar constante de layout `V1`

Inserir **após** a última constante `CAROLINE_*_V1` existente e **antes** de `OIKOS_APPLICATION_PACKET_V1`. Buscar `const OIKOS_APPLICATION_PACKET_V1` para achar o ponto exato.

```typescript
const CAROLINE_XPTO_V1: {
  text: Record<string, OverlayTextField>;
  checkboxes: Record<string, PacketCheckboxField>;
} = {
  text: {
    nome_do_campo: {
      page: 0,
      x: 120,
      top: 182,        // top_mapeado - fontSize
      maxWidth: 200,
      fontSize: 10,
      minFontSize: 8,
      source: "student.firstName",
      optional: true,
      align: "left",
    },
  },
  checkboxes: {
    degree_mba: {
      page: 0,
      x: 59,
      top: 400,        // top_mapeado - 10
      source: "student.degreeProgram",
      equals: "mba",
    },
  },
};
```

### Passo 4 — Registrar no catálogo de forms

Em `CAROLINE_FORMS` (ou `OIKOS_FORMS`), adicionar o `form_type` string:

```typescript
const CAROLINE_FORMS = [
  // ... existentes ...
  "xpto_form",
] as const;
```

E em `FORM_LABELS`:

```typescript
const FORM_LABELS: Record<string, string> = {
  // ... existentes ...
  xpto_form: "Nome de Exibição do Formulário",
};
```

### Passo 5 — Criar o builder de dados

```typescript
function buildCarolineXptoData(
  profile: Record<string, any>,
  course: Record<string, any> | null,
  supplemental: SupplementalData,
  identity: Record<string, any> | null,
): Record<string, any> {
  const splitName = splitFullName(profile.full_name);
  return {
    student: {
      firstName: splitName.firstName,
      lastName: splitName.lastName,
      degreeProgram: inferCarolineDegreeProgram(course),
      // ...outros campos
    },
  };
}
```

**Utilitários disponíveis:**

| Função | Retorno |
|---|---|
| `splitFullName(fullName)` | `{ firstName, middleName, lastName }` |
| `parsePreferredStart(value)` | `{ startSemester, startYear }` a partir de `"Fall 2025"` |
| `maybeFormatDate(isoDate)` | `"MM/DD/YYYY"` ou `""` |
| `inferCarolineDegreeProgram(course)` | `"bba" \| "mba" \| "mcis" \| "mphil" \| "dba" \| "dphil"` |
| `compact(value)` | String sem espaços em branco (null-safe) |
| `asString(value)` | String segura — nunca retorna null |
| `joinAddress([...parts])` | Concatena partes de endereço |

### Passo 6 — Conectar o builder em `buildFormData`

Dentro do `switch (formType)` (ou nos `if` anteriores ao switch):

```typescript
case "xpto_form":
  if ((institution.slug ?? institution.name ?? "").toLowerCase().includes("caroline")) {
    return buildCarolineXptoData(profile, course, supplemental, identity);
  }
  return { ...base };
```

### Passo 7 — Criar o gerador de PDF

```typescript
async function generateCarolineXptoPdf(
  formData: Record<string, any>,
): Promise<Uint8Array> {
  const templateBytes = await loadPdfTemplate(CAROLINE_XPTO_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(CAROLINE_XPTO_V1.text)) {
    const value = resolveOverlayTextValue(formData, field);
    if (!value) continue;
    drawPacketTextField(pages[field.page], font, value, {
      page: field.page, x: field.x, top: field.top,
      maxWidth: field.maxWidth, source: field.source,
      align: field.align, fontSize: field.fontSize,
      minFontSize: field.minFontSize,
    });
  }

  for (const field of Object.values(CAROLINE_XPTO_V1.checkboxes)) {
    const current = normalizeCheckboxValue(getValueAtPath(formData, field.source));
    const expected = normalizeCheckboxValue(field.equals);
    if (current === expected) {
      drawPacketCheckbox(pages[field.page], font, field.x, field.top);
    }
  }

  return await doc.save();
}
```

### Passo 8 — Registrar em `generateFormPdf`

Dentro da função `generateFormPdf`, junto com os outros `if`:

```typescript
if (formType === "xpto_form" && institutionSlug?.includes("caroline")) {
  return await generateCarolineXptoPdf(formData);
}
```

### Passo 9 — Fazer deploy

```bash
cd MIGMAINC
supabase functions deploy generate-institution-forms --project-ref <project_ref>
```

---

## 8. Como editar coordenadas de um formulário existente

1. Abrir `index.ts` e localizar a constante `V1` do formulário (ex: `CAROLINE_APPLICATION_FORM_V1`)
2. Ajustar `x` ou `top` do campo desejado
3. Referência de direção:
   - Aumentar `top` → campo desce
   - Diminuir `top` → campo sobe
   - Aumentar `x` → campo vai para a direita
   - Diminuir `x` → campo vai para a esquerda
4. Fazer deploy (passo 9 acima)
5. Testar via prod ou local (ver seções 11 e 12)

Para ajustes finos de posição, usar o `pdf_mapper.py` para obter coordenadas precisas.

---

## 9. Formulários implementados

### Caroline University

| Form type | Template | Constante de layout | Builder | Gerador |
|---|---|---|---|---|
| `application_for_admission` | `Caroline_Form_Application_2024 (1).pdf` | `CAROLINE_APPLICATION_FORM_V1` | `buildCarolineApplicationFormData` | `generateCarolineApplicationFormPdf` |
| `i20_request_form` | `CU_Form_I-20 Request_2024 (1).pdf` | `CAROLINE_I20_REQUEST_FORM_V1` | `buildCarolineI20RequestFormData` | `generateCarolineI20RequestFormPdf` |
| `letter_of_recommendation` | `Caroline Form Letter of Recommendation (1).pdf` | `CAROLINE_LETTER_OF_RECOMMENDATION_V1` | `buildCarolineLetterOfRecommendationData` | `generateCarolineLetterOfRecommendationPdf` |
| `affidavit_of_financial_support` | `Caroline_Affidavit of Financial Support_2024 (1).pdf` | `CAROLINE_AFFIDAVIT_OF_FINANCIAL_SUPPORT_V1` | via `base` | `generateCarolineAffidavitOfFinancialSupportPdf` |
| `tuition_refund_policy` | `CU_Form_Tuition Refund_2024 (1).pdf` | — (texto fixo) | via `base` | `generateCarolineTuitionRefundPolicyPdf` |
| `statement_of_institutional_purpose` | `CU_Form_Statement of Institutional Purpose_2024 (1).pdf` | — (texto fixo) | via `base` | `generateCarolineStatementOfInstitutionalPurposePdf` |
| `scholarship_support_compliance_agreement` | `SCHOLARSHIP SUPPORT AND COMPLIANCE AGREEMENT (2).pdf` | — (texto fixo) | via `base` | `generateCarolineScholarshipSupportComplianceAgreementPdf` |

### Oikos University

| Form type | Template | Constante de layout | Builder | Gerador |
|---|---|---|---|---|
| `application_packet` | `1. Application Packet - OIKOS (1).pdf` | `OIKOS_APPLICATION_PACKET_V1` | `buildOikosApplicationPacketData` | `generateOikosApplicationPacketPdf` |
| `affidavit_of_financial_support` | `5. Verification of Financial  (1).pdf` | — | `buildOikosVerificationFinancialData` | `generateOikosVerificationOfFinancialPdf` |
| `enrollment_agreement` | `Enrollment Agreement (1).pdf` | — | via `base` | `generateOikosEnrollmentAgreementPdf` |
| `all_statements_and_agreement` | `All Statement and agreement  (1).pdf` | `OIKOS_ALL_STATEMENTS_AND_AGREEMENT_V1` | `buildOikosAllStatementsAgreementData` | `generateOikosAllStatementsAgreementPdf` |

### Compartilhado (todas as instituições)

| Form type | Descrição |
|---|---|
| `termo_responsabilidade_estudante` | Documento interno MIGMA — nunca enviado à universidade |

---

## 10. Fontes de dados disponíveis

A function busca as seguintes tabelas:

| Tabela | Dados disponíveis |
|---|---|
| `institution_applications` | `status`, `supplemental_data`, `scholarship_level_id` |
| `institutions` | `name`, `slug`, `city`, `state`, `modality`, `cpt_opt`, `accepts_cos`, `accepts_transfer` |
| `institution_scholarships` | `scholarship_level`, `placement_fee_usd`, `discount_percent`, `tuition_annual_usd`, `monthly_migma_usd`, `installments_total` |
| `institution_courses` | `course_name`, `degree_level`, `area`, `duration_months` |
| `user_profiles` | `full_name`, `email`, `phone`, `whatsapp`, `num_dependents`, `student_process_type`, `service_type`, `signature_url` |
| `selection_survey_responses` | `answers` (JSONB), `academic_formation`, `english_level` |
| `user_identity` | `birth_date`, `nationality`, `marital_status`, `address`, `city`, `state`, `zip_code`, `country` |

### `supplemental_data`

Dados adicionais enviados no payload ou salvos na application. Podem ser enviados no request para sobrescrever os do banco.

```typescript
interface SupplementalData {
  emergency_contact?: { name, phone, relationship, address };
  has_sponsor?: boolean;
  sponsor?: {
    full_name, relationship, phone, address, city, state, zip,
    employer, position, years_employed, annual_income_usd, committed_amount_usd,
    signature_text, signature_date
  };
  notary?: {
    sponsor_oath_signature_text, subscribed_day, subscribed_month,
    subscribed_location, commission_expires_on, officer_signature_text, officer_title
  };
  work_experience?: Array<{ company, period, position }>;
  recommenders?: Array<{
    name, position, contact, email, telephone, date,
    institution, address, city, state, zip
  }>;
  preferred_start_term?: string;   // ex: "Fall 2025"
}
```

---

## 11. Testes locais

### Pré-requisitos (subir uma vez por sessão)

```
1. Iniciar Docker Desktop
2. cd MIGMAINC/
   supabase functions serve --env-file .env.local    ← deixar rodando
3. cd pdf-template/
   python -m http.server 8011                         ← deixar rodando
```

O `supabase functions serve` tem **hot-reload automático** — ao salvar `index.ts` ele recompila em ~2 segundos. Não é necessário reiniciar entre edições.

### Criar fixture de teste

`pdf-local-tests/fixtures/nome-do-form.json`:

```json
{
  "local_test": {
    "enabled": true,
    "return_resolved_form_data": true,
    "form_types": ["xpto_form"],
    "institution": { "name": "Caroline University", "slug": "caroline-university" },
    "course": { "course_name": "Master of Business Administration", "degree_level": "Master" },
    "profile": {
      "full_name": "Jhonatan Pereira Silva",
      "email": "jhonatan@example.com",
      "phone": "+1 213 555-7890",
      "service_type": "transfer"
    },
    "identity": {
      "birth_date": "1998-06-15",
      "address": "456 Maple Ave Apt 2C",
      "city": "Los Angeles", "state": "CA", "zip_code": "90001",
      "nationality": "Brazilian"
    },
    "supplemental_data": {
      "preferred_start_term": "Fall 2025"
    }
  }
}
```

> Usar apenas hífen simples `-` nos valores — nunca en dash `–`. PowerShell lê o arquivo como ANSI e o UTF-8 do en dash corrompido causa erro de JSON.

### Rodar o teste

```powershell
cd pdf-local-tests
.\testar_pdf.ps1 -FixturePath ".\fixtures\nome-do-form.json"
```

O PDF é salvo em `pdf-local-tests/output/`. Fechar o leitor antes de abrir o novo — o Windows trava o arquivo.

---

## 12. Testes em produção

### Chamada direta via curl

```bash
SERVICE_KEY="<SUPABASE_SERVICE_ROLE_KEY>"

curl -X POST \
  "https://<project>.supabase.co/functions/v1/generate-institution-forms" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"application_id": "<uuid>"}'
```

A `application_id` deve pertencer a uma application com `status = "payment_confirmed"`.

### Resposta de sucesso

```json
{
  "success": true,
  "institution": "Caroline University",
  "local_test": false,
  "forms_generated": 7,
  "forms_total": 7,
  "form_types": ["application_for_admission", "i20_request_form", "..."],
  "form_ids": ["uuid1", "uuid2", "..."]
}
```

### Debug de ambiente

```bash
curl -X POST ... -d '{"debug_env": true}'
```

Retorna informações sobre qual URL/keys estão sendo usadas e se o template principal é acessível.

### Obter URLs dos PDFs gerados

```sql
SELECT form_type, template_url
FROM institution_forms
WHERE application_id = '<uuid>'
ORDER BY generated_at;
```

---

## 13. Deploy

```bash
cd MIGMAINC
supabase functions deploy generate-institution-forms --project-ref <project_ref>
```

O bundle inclui o `index.ts` compilado. Os PDFs em `templates/` **não são bundlados** automaticamente — a function os busca via HTTP a partir da secret `PDF_TEMPLATE_BASE_URL` (bucket `pdf-templates` no Storage).

Ao adicionar um novo template:
1. Copiar o PDF para `templates/` (para dev local)
2. Fazer upload para o bucket `pdf-templates` no Storage (para produção)
3. Fazer deploy da function

---

## 14. Gaps conhecidos

| Gap | Descrição |
|---|---|
| `christian_faith_statement` em branco | O campo é lido de `answers.christian_faith_statement` na survey, mas nenhum formulário de survey captura essa resposta. A spec diz que a IA deveria gerar um rascunho automaticamente — essa geração não foi implementada. |
| Sem suporte a novos slugs de instituição | Instituições que não são Caroline nem Oikos caem no fallback genérico (`application_for_admission`, `i20_request_form`, `termo_responsabilidade_estudante`). Para adicionar uma nova instituição com forms próprios, é necessário adicionar a constante de formulários e o bloco de roteamento. |
