# 📋 TASKS PARA TRELLO - 24 DE DEZEMBRO 2025

---

## TASK 1: Sistema de Templates de Contratos Dinâmicos

**Título:** Implementar sistema de templates de contratos dinâmicos para Visa Service

**Descrição:**
Criar um sistema que permite aos administradores criar e gerenciar templates de contratos específicos para cada produto do Visa Service.

**Checklist:**
- [x] Migration criada (`20250124000000_add_visa_service_templates.sql`)
- [x] Editor de templates implementado (`ContractTemplateEditor.tsx`)
- [x] Preview em tempo real
- [x] Sistema de templates por tipo: `global_partner` ou `visa_service`
- [x] Seleção de produto ativo para `visa_service`
- [x] Editor duplo (texto simples + HTML direto)
- [x] Validação: apenas um template ativo por `product_slug`
- [x] Sistema de ativação/desativação
- [x] Duplicação de templates
- [x] Interface administrativa completa com filtros e busca
- [x] Integração com PDF generation

**Arquivos:**
- `supabase/migrations/20250124000000_add_visa_service_templates.sql`
- `src/components/admin/ContractTemplateEditor.tsx`
- `src/lib/contract-templates.ts`
- `src/pages/ContractTemplatesPage.tsx`

**Área:** Visa Service

---

## TASK 2: Correção do PDF do Contrato (Lorem Ipsum)

**Título:** Corrigir PDF do contrato que mostrava conteúdo antigo "lorem ipsum"

**Descrição:**
PDF gerado mostrava conteúdo antigo "lorem ipsum" em vez do template dinâmico do banco de dados. Atualizar Edge Function para buscar template ativo.

**Checklist:**
- [x] Atualização da Edge Function `generate-visa-contract-pdf`
- [x] Implementação de função `convertHtmlToText`
- [x] Remoção de todo conteúdo hardcoded
- [x] Integração com sistema de templates dinâmicos
- [x] Fallback para texto padrão se template não for encontrado

**Arquivos:**
- `supabase/functions/generate-visa-contract-pdf/index.ts`

**Área:** Visa Service

---

## TASK 3: Assinatura Desenhada no Visa Checkout

**Título:** Implementar assinatura desenhada no checkout do Visa Service

**Descrição:**
Permitir que clientes desenhem sua assinatura diretamente no checkout, similar ao fluxo do Global Partner.

**Checklist:**
- [x] Migration criada (`20250125000000_add_signature_image_url_to_visa_orders.sql`)
- [x] Componente `SignaturePadComponent` integrado no Step 3
- [x] Canvas interativo para desenhar assinatura
- [x] Botões "Clear" e "Confirm"
- [x] Validação obrigatória antes do pagamento
- [x] Upload automático para Supabase Storage
- [x] Persistência no `localStorage`
- [x] Salvamento da URL no banco (`visa_orders.signature_image_url`)
- [x] Exibição da assinatura no PDF gerado
- [x] Fallback: exibe nome do cliente se assinatura não carregar

**Arquivos:**
- `supabase/migrations/20250125000000_add_signature_image_url_to_visa_orders.sql`
- `src/pages/VisaCheckout.tsx`
- `src/components/ui/signature-pad.tsx`
- `supabase/functions/create-visa-checkout-session/index.ts`
- `supabase/functions/generate-visa-contract-pdf/index.ts`

**Área:** Visa Service

---

## TASK 4: ANNEX I - Sistema Completo (Frontend)

**Título:** Implementar exibição do ANNEX I no frontend do Visa Checkout

**Descrição:**
Criar sistema para produtos `-scholarship` e `-i20-control` que exibem apenas o termo de anti-chargeback (ANNEX I) em vez do contrato completo.

**Checklist:**
- [x] Detecção automática de produtos que requerem ANNEX I
- [x] Exibição do texto do ANNEX I no Step 3
- [x] Texto fixo armazenado em `src/lib/annex-text.ts`
- [x] Ajuste de tamanho de fonte do título (1.25rem)
- [x] Checkbox de termos adaptado para mencionar ANNEX I

**Arquivos:**
- `src/lib/annex-text.ts` (NOVO)
- `src/pages/VisaCheckout.tsx`

**Área:** Visa Service

---

## TASK 5: ANNEX I - Geração de PDF (Backend)

**Título:** Criar Edge Function para gerar PDF do ANNEX I

**Descrição:**
Criar Edge Function que gera PDF completo do ANNEX I com todas as informações do pedido, texto completo, documentos de identidade e assinatura.

**Checklist:**
- [x] Migration criada (`20250126000000_add_annex_pdf_url_to_visa_orders.sql`)
- [x] Nova Edge Function `generate-annex-pdf` criada
- [x] PDF com header "ANNEX I – PAYMENT AUTHORIZATION & NON-DISPUTE AGREEMENT"
- [x] Informações do pedido (número, serviço, valor, método de pagamento, cliente)
- [x] Texto completo do ANNEX I (8 seções)
- [x] Seção "IDENTITY DOCUMENTS" com 3 imagens
- [x] Seção de assinatura desenhada
- [x] Informações técnicas (IP, datas, status)
- [x] Footer em todas as páginas
- [x] Upload automático para Supabase Storage (`contracts/visa-annexes/`)
- [x] Atualização do campo `annex_pdf_url` na tabela `visa_orders`

**Arquivos:**
- `supabase/migrations/20250126000000_add_annex_pdf_url_to_visa_orders.sql`
- `supabase/functions/generate-annex-pdf/index.ts` (NOVO)

**Área:** Visa Service

---

## TASK 6: ANNEX I - Integração com Webhooks

**Título:** Integrar geração de ANNEX I com webhooks Stripe e Zelle

**Descrição:**
Atualizar webhooks para detectar produtos `-scholarship` ou `-i20-control` e gerar apenas ANNEX I (não contrato completo).

**Checklist:**
- [x] Webhook Stripe atualizado (`stripe-visa-webhook`)
- [x] Webhook Zelle atualizado (`send-zelle-webhook`)
- [x] Detecção de produtos `-scholarship` ou `-i20-control`
- [x] Lógica condicional: gera apenas ANNEX I para esses produtos
- [x] Lógica aplicada em ambos os eventos:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`

**Arquivos:**
- `supabase/functions/stripe-visa-webhook/index.ts`
- `supabase/functions/send-zelle-webhook/index.ts`

**Área:** Visa Service

---

## TASK 7: ANNEX I - Busca de Documentos do Pedido Anterior

**Título:** Implementar busca inteligente de documentos do pedido anterior

**Descrição:**
Para produtos `-scholarship` e `-i20-control`, buscar documentos de identidade do pedido anterior de `-selection-process` do mesmo cliente.

**Checklist:**
- [x] Lógica para detectar produtos `-scholarship` ou `-i20-control`
- [x] Busca pedido anterior de `-selection-process` do mesmo cliente (mesmo email)
- [x] Extração do `service_request_id` do pedido anterior
- [x] Busca arquivos de identidade usando esse `service_request_id`
- [x] Inclusão das 3 imagens no PDF do ANNEX I:
  - Selfie com documento
  - Documento frente
  - Documento verso
- [x] Logs detalhados para debugging

**Arquivos:**
- `supabase/functions/generate-annex-pdf/index.ts`

**Área:** Visa Service

---

## TASK 8: Sistema de Edição de Meeting

**Título:** Permitir edição de informações de meeting já agendadas

**Descrição:**
Permitir que administradores editem informações de meeting já agendadas para aplicações do Global Partner.

**Checklist:**
- [x] Função `updateMeetingInfo()` criada em `src/lib/admin.ts`
- [x] Botão "Edit Meeting" visível apenas para status `approved_for_meeting`
- [x] Modal `MeetingScheduleModal` com modo de edição (`isEditMode`)
- [x] Pré-preenchimento dos campos com dados existentes
- [x] Validação de status: apenas permite edição se status é `approved_for_meeting`
- [x] Atualização de campos no banco:
  - `meeting_date`
  - `meeting_time`
  - `meeting_link`
  - `meeting_scheduled_by` (opcional)
  - `meeting_scheduled_at` (atualizado para agora)
- [x] Interface atualizada em Dashboard e ApplicationDetailPage
- [x] Botão de edição na lista de aplicações

**Arquivos:**
- `src/lib/admin.ts`
- `src/components/admin/MeetingScheduleModal.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/ApplicationDetailPage.tsx`
- `src/components/admin/ApplicationsList.tsx`

**Área:** Global Partner

---

## TASK 9: Email de Atualização de Meeting

**Título:** Criar email automático de atualização de meeting

**Descrição:**
Enviar email HTML automático ao candidato quando meeting for editado, com novos detalhes e link para join.

**Checklist:**
- [x] Função `sendMeetingUpdateEmail()` criada em `src/lib/emails.ts`
- [x] Template HTML responsivo
- [x] Formatação de data em timezone local (corrigido)
- [x] Card destacado com novos detalhes do meeting
- [x] Botão "Join Meeting" com link
- [x] Instruções para atualizar calendário
- [x] Design consistente com outros emails do sistema
- [x] Integração automática com `updateMeetingInfo()`

**Arquivos:**
- `src/lib/emails.ts`

**Área:** Global Partner

---

## TASK 10: Correção de Bugs do Calendário (Timezone)

**Título:** Corrigir problemas de timezone nas datas de meeting

**Descrição:**
Datas de meeting eram exibidas incorretamente devido a problemas de conversão de timezone. Parsing de datas causava deslocamento de um dia.

**Checklist:**
- [x] Correção do parsing de datas em múltiplos componentes
- [x] Uso de parsing local (sem conversão de timezone)
- [x] Datas exibidas corretamente em todos os componentes
- [x] Sem deslocamento de dias
- [x] Formatação consistente em toda a aplicação

**Arquivos:**
- `src/components/admin/MeetingScheduleModal.tsx`
- `src/pages/ApplicationDetailPage.tsx`
- `src/components/admin/ApplicationsList.tsx`
- `src/lib/emails.ts` (funções `sendMeetingInvitationEmail` e `sendMeetingUpdateEmail`)

**Área:** Global Partner

---

## TASK 11: Correção UI - "0" não aparecia no dropdown de dependentes

**Título:** Corrigir display de "0" dependentes no dropdown

**Descrição:**
Quando "0" dependentes era selecionado, o campo ficava vazio visualmente. Implementar overlay para exibir "0" quando selecionado.

**Checklist:**
- [x] Implementação de overlay com `span` absoluto
- [x] Aplicado em `VisaCheckout.tsx`
- [x] Aplicado em `SellerLinks.tsx`

**Arquivos:**
- `src/pages/VisaCheckout.tsx`
- `src/pages/seller/SellerLinks.tsx`

**Área:** Visa Service / Seller Dashboard

---

## TASK 12: Correção UI - Campos de nomes de dependentes

**Título:** Adicionar campos para nomes de dependentes no Seller Dashboard

**Descrição:**
Faltavam campos para inserir nomes quando havia dependentes no formulário de prefill. Adicionar campos dinâmicos que aparecem automaticamente.

**Checklist:**
- [x] Campos dinâmicos de nomes de dependentes
- [x] Campos aparecem automaticamente quando `extraUnits > 0`
- [x] Array `dependentNames` adicionado ao estado
- [x] Inputs dinâmicos gerados baseados em `extraUnits`
- [x] Validação de nomes obrigatórios
- [x] Integração completa com prefill token
- [x] Salvamento e carregamento dos nomes via prefill

**Arquivos:**
- `src/pages/seller/SellerLinks.tsx`
- `src/pages/VisaCheckout.tsx`

**Área:** Seller Dashboard

---

## TASK 13: Ajuste de Estilo - Título do ANNEX I

**Título:** Reduzir tamanho da fonte do título do ANNEX I

**Descrição:**
Reduzir o tamanho da fonte do título "ANNEX I – PAYMENT AUTHORIZATION & NON-DISPUTE AGREEMENT" de `1.5rem` para `1.25rem`.

**Checklist:**
- [x] Tamanho de fonte ajustado de `1.5rem` para `1.25rem`

**Arquivos:**
- `src/lib/annex-text.ts`

**Área:** Visa Service

---

## TASK 14: Correção de Geração de PDF - Scholarship/I20-Control

**Título:** Corrigir geração duplicada de PDF para produtos scholarship/i20-control

**Descrição:**
Para produtos `-scholarship` e `-i20-control`, estava gerando o contrato completo em vez de apenas o ANNEX I. Implementar lógica condicional no webhook.

**Checklist:**
- [x] Lógica condicional no webhook para verificar tipo de produto
- [x] Para `-scholarship` e `-i20-control`: gera apenas ANNEX I
- [x] Para `-selection-process`: gera apenas o contrato completo
- [x] Lógica aplicada em ambos os eventos do webhook

**Arquivos:**
- `supabase/functions/stripe-visa-webhook/index.ts`

**Área:** Visa Service

---

## TASK 15: Correção de Imagens no PDF do ANNEX I

**Título:** Adicionar seção "IDENTITY DOCUMENTS" com 3 imagens no PDF do ANNEX I

**Descrição:**
PDF do ANNEX I mostrava apenas 2 imagens (assinatura e selfie). Faltavam documento frente e documento verso. Adicionar seção completa com as 3 imagens de identidade.

**Checklist:**
- [x] Adição da seção "IDENTITY DOCUMENTS"
- [x] Busca de arquivos na tabela `identity_files`
- [x] Seção completa no PDF com as 3 imagens:
  - Selfie com documento
  - Documento frente
  - Documento verso
- [x] Busca inteligente de documentos do pedido anterior

**Arquivos:**
- `supabase/functions/generate-annex-pdf/index.ts`

**Área:** Visa Service

---

## TASK 16: Logs e Debugging - ANNEX I

**Título:** Adicionar logs detalhados na Edge Function generate-annex-pdf

**Descrição:**
Adicionar logs detalhados para facilitar debugging e rastreabilidade do processo de geração do ANNEX I.

**Checklist:**
- [x] Log de busca de pedido anterior
- [x] Log de quantidade de arquivos encontrados
- [x] Log de resumo de quais arquivos foram encontrados/faltando
- [x] Log de carregamento de cada imagem
- [x] Log de sucesso/falha ao adicionar imagens ao PDF
- [x] Log de upload do PDF para storage

**Arquivos:**
- `supabase/functions/generate-annex-pdf/index.ts`

**Área:** Visa Service

---

## 📊 RESUMO POR ÁREA

### Global Partner (3 tasks)
- TASK 8: Sistema de Edição de Meeting
- TASK 9: Email de Atualização de Meeting
- TASK 10: Correção de Bugs do Calendário (Timezone)

### Visa Service (11 tasks)
- TASK 1: Sistema de Templates de Contratos Dinâmicos
- TASK 2: Correção do PDF do Contrato (Lorem Ipsum)
- TASK 3: Assinatura Desenhada no Visa Checkout
- TASK 4: ANNEX I - Sistema Completo (Frontend)
- TASK 5: ANNEX I - Geração de PDF (Backend)
- TASK 6: ANNEX I - Integração com Webhooks
- TASK 7: ANNEX I - Busca de Documentos do Pedido Anterior
- TASK 11: Correção UI - "0" não aparecia no dropdown
- TASK 13: Ajuste de Estilo - Título do ANNEX I
- TASK 14: Correção de Geração de PDF - Scholarship/I20-Control
- TASK 15: Correção de Imagens no PDF do ANNEX I
- TASK 16: Logs e Debugging - ANNEX I

### Seller Dashboard (1 task)
- TASK 12: Correção UI - Campos de nomes de dependentes

### Compartilhado (1 task)
- TASK 11: Correção UI - "0" não aparecia no dropdown (Visa Service + Seller Dashboard)

---

**Total de Tasks:** 16 tasks
**Status:** ✅ Todas concluídas
**Data:** 24 de Dezembro de 2025






