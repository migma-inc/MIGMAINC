# 📊 Status da Integração Wise - Checkout de Produtos

**Data de Criação**: 2026-01-12  
**Última Atualização**: 2026-01-12  
**Status Geral**: 🟡 **Aguardando Configuração de Variáveis de Ambiente**

---

## ✅ O QUE JÁ FOI IMPLEMENTADO

### 1. Estrutura de Código ✅

#### Frontend (`src/lib/wise/`)
- ✅ `wise-types.ts` - Tipos TypeScript completos
- ✅ `wise-client.ts` - Cliente da API Wise com Personal Token
- ✅ `wise-quotes.ts` - Gerenciamento de quotes
- ✅ `wise-recipients.ts` - Gerenciamento de recipients
- ✅ `wise-transfers.ts` - Gerenciamento de transfers
- ✅ `wise-checkout.ts` - Integração com checkout de produtos

#### Backend (Edge Functions)
- ✅ `supabase/functions/create-wise-checkout/index.ts` - Cria checkout Wise
- ✅ `supabase/functions/wise-webhook/index.ts` - Processa webhooks Wise

#### Integração no Checkout
- ✅ `VisaCheckout.tsx` - Adicionado Wise como opção de pagamento
- ✅ Função `handleWisePayment` implementada
- ✅ UI com instruções de pagamento Wise
- ✅ Botão "Pay with Wise" estilizado

### 2. Banco de Dados ✅

#### Migrations Aplicadas
- ✅ `20260110000003_add_wise_fields_to_visa_orders.sql`
  - Adiciona campos `wise_transfer_id`, `wise_quote_uuid`, `wise_recipient_id`, `wise_payment_status`
  - Cria índice em `wise_transfer_id`
  
- ✅ `20260110000004_create_wise_transfers_table.sql`
  - Cria tabela `wise_transfers` com todos os campos necessários
  - Cria índices para performance
  - Cria trigger para atualizar `updated_at`

### 3. Edge Functions Deployadas ✅

- ✅ `create-wise-checkout` (versão 4) - **Deployado**
- ✅ `wise-webhook` (versão 5) - **Deployado**

### 4. Logs e Debugging ✅

- ✅ Logs detalhados em todas as etapas da Edge Function `create-wise-checkout`
- ✅ Logs de todas as requisições à API Wise
- ✅ Tratamento de erros com mensagens claras

---

## ⏸️ ONDE PARAMOS

### **Ponto de Bloqueio Atual**

**Data**: 2026-01-12  
**Status**: ✅ **Informações obtidas - Pronto para configurar**

**Informações Obtidas**:
- ✅ Dados bancários da Migma (ABA, Account Number, etc.)
- ✅ Account Holder Name, Currency, Account Type, Legal Type
- ✅ Informações do banco (nome, endereço, cidade)
- ⚠️ `WISE_PERSONAL_TOKEN` - Precisa do valor completo (não apenas placeholder)

**Próximo Passo**: Configurar todas as variáveis no Supabase Dashboard

**Documento de Configuração**: Ver `docs/WISE_CONFIGURACAO_COMPLETA.md`

---

## 🔴 O QUE FALTA FAZER

### 1. Configuração de Variáveis de Ambiente (BLOQUEADOR)

**Local**: Supabase Dashboard > Project Settings > Edge Functions > Secrets

**Variáveis Obrigatórias que Faltam**:

| Variável | Status | Valor |
|----------|--------|-------|
| `WISE_PERSONAL_TOKEN` | ⚠️ Precisa valor completo | `<seu_token>` - Ver instruções abaixo |
| `WISE_ENVIRONMENT` | ⚠️ **ATENÇÃO** | `production` (token foi criado em produção) |
| `WISE_MIGMA_ACCOUNT_HOLDER_NAME` | ✅ Obtido | `MIGMA INC / @migmainc` |
| `WISE_MIGMA_CURRENCY` | ✅ Obtido | `USD` |
| `WISE_MIGMA_ACCOUNT_TYPE` | ✅ Obtido | `aba` |
| `WISE_MIGMA_LEGAL_TYPE` | ✅ Obtido | `BUSINESS` |
| `WISE_MIGMA_ABA` | ✅ Obtido | `084009519` |
| `WISE_MIGMA_ACCOUNT_NUMBER` | ✅ Obtido | `777855076826940` |

**Variáveis Opcionais** (recomendadas):
- `WISE_PROFILE_ID` - Será buscado automaticamente se não configurado
- `WISE_MIGMA_BANK_NAME` - Nome do banco
- `WISE_MIGMA_BANK_ADDRESS` - Endereço do banco
- `WISE_MIGMA_CITY` - Cidade
- `WISE_MIGMA_COUNTRY` - País (default: "US")

**Ação Necessária**: 
- ✅ Dados bancários obtidos
- ⏸️ Configurar todas as variáveis no Supabase Dashboard
- ⚠️ Obter `WISE_PERSONAL_TOKEN` completo (se ainda não tiver)

**Ver**: `docs/WISE_CONFIGURACAO_COMPLETA.md` para instruções detalhadas

---

### 2. Configuração do Webhook na Conta Wise (PARCIALMENTE CONCLUÍDO)

**Status**: ✅ Webhook criado | ⏸️ **Webhook Secret não encontrado**

**O que foi feito**:
- ✅ Webhook criado com sucesso na conta Wise
- ✅ Nome: "Intregação Migma"
- ✅ Versão: 2.0.0
- ✅ Eventos: "Transfer updates"
- ✅ URL configurada: `https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/wise-webhook`
- ✅ Data de criação: 12/01/2026

**Problema Identificado**: 
- ❌ **Webhook Secret não está visível na interface da Wise**
- A interface não exibe nenhum campo ou informação sobre "Webhook Secret"

**Possíveis Causas**:

1. **Secret foi gerado mas não está visível** (mais provável):
   - Muitas plataformas de webhook exibem o secret **apenas uma vez** no momento da criação
   - Por segurança, o secret não é exibido novamente após a criação
   - O secret pode ter sido gerado mas não foi copiado no momento da criação

2. **Wise pode usar outro método de autenticação**:
   - Algumas versões da API Wise podem usar **RSA com chave pública** em vez de HMAC com secret
   - Neste caso, não haveria um "secret" tradicional, mas sim uma chave pública para verificação

3. **Personal Token pode não gerar secret**:
   - Com Personal Tokens, a Wise pode não gerar um webhook secret
   - A autenticação pode ser feita apenas via Personal Token no header

**Soluções Possíveis**:

**Opção 1: Regenerar o Webhook Secret** (Recomendado)
1. Acessar o webhook criado na interface da Wise
2. Procurar por opção "Regenerate secret" ou "Gerar novo segredo"
3. Ao regenerar, o novo secret será exibido **apenas uma vez**
4. **Copiar imediatamente** e configurar como `WISE_WEBHOOK_SECRET` no Supabase

**Opção 2: Verificar se há opção de visualizar secret**
1. Clicar no webhook criado para ver detalhes
2. Procurar por botão "Show secret" ou "Reveal secret"
3. Algumas plataformas escondem o secret mas permitem revelá-lo com confirmação

**Opção 3: Verificar documentação da Wise**
1. Consultar documentação oficial sobre webhook secrets para Personal Tokens
2. Verificar se Personal Tokens usam método diferente de autenticação
3. Pode ser necessário usar OAuth 2.0 + mTLS para ter webhook secrets

**Observação Importante**: 
- A Edge Function `wise-webhook` está configurada para aceitar requisições **sem secret** (para testes)
- Isso permite que o webhook funcione mesmo sem o secret configurado
- **Porém, para produção, é recomendado configurar o secret para segurança**

**Ação Necessária**: 
- ⏸️ Verificar se é possível regenerar ou visualizar o webhook secret na interface Wise
- ⏸️ Se não for possível, verificar documentação sobre autenticação de webhooks com Personal Token
- ⏸️ Configurar `WISE_WEBHOOK_SECRET` no Supabase Dashboard quando obtido

---

### 3. Testes do Fluxo Completo (PENDENTE)

**Após configurar variáveis de ambiente**:

- [ ] Testar criação de quote na API Wise
- [ ] Testar criação de recipient na API Wise
- [ ] Testar criação de transfer na API Wise
- [ ] Testar redirect para Wise para pagamento
- [ ] Testar webhook de confirmação de pagamento
- [ ] Validar atualização de status no banco de dados
- [ ] Validar geração de PDF de contrato após pagamento
- [ ] Validar envio de email de confirmação

---

### 4. Ajustes e Melhorias (FUTURO)

**Melhorias Opcionais** (não bloqueiam):
- [ ] Implementar cache de recipient (reutilizar recipient existente)
- [ ] Adicionar suporte a múltiplas moedas de pagamento
- [ ] Melhorar tratamento de erros da API Wise
- [ ] Adicionar retry logic para falhas temporárias
- [ ] Implementar validação de dados bancários antes de criar recipient
- [ ] Adicionar suporte a diferentes tipos de conta (IBAN, SWIFT, Sort Code)

---

## 📋 CHECKLIST DE CONFIGURAÇÃO

### Fase 1: Variáveis de Ambiente (PRONTO PARA CONFIGURAR)

- [x] Obter dados bancários da Migma ✅
- [ ] Obter `WISE_PERSONAL_TOKEN` completo (se ainda não tiver)
- [ ] Configurar todas as variáveis no Supabase Dashboard
- [ ] Testar se Edge Function `create-wise-checkout` funciona

**Valores para configurar**:
- `WISE_PERSONAL_TOKEN` = [token completo]
- `WISE_ENVIRONMENT` = `sandbox`
- `WISE_MIGMA_ACCOUNT_HOLDER_NAME` = `MIGMA INC`
- `WISE_MIGMA_CURRENCY` = `USD`
- `WISE_MIGMA_ACCOUNT_TYPE` = `aba`
- `WISE_MIGMA_LEGAL_TYPE` = `BUSINESS`
- `WISE_MIGMA_ABA` = `084009519`
- `WISE_MIGMA_ACCOUNT_NUMBER` = `777855076826940`

### Fase 2: Webhook Wise (PARCIALMENTE CONCLUÍDO)

- [x] Setor de TI testa criação do webhook na conta Wise ✅
- [x] Webhook criado com sucesso ✅
- [ ] **Copiar `WISE_WEBHOOK_SECRET` gerado** ⏸️ **PROBLEMA: Secret não visível**
- [ ] Configurar `WISE_WEBHOOK_SECRET` no Supabase Dashboard
- [ ] Testar se webhook recebe eventos corretamente

**Ação Imediata**: 
- Verificar se é possível regenerar o webhook secret na interface Wise
- Se não for possível, verificar documentação sobre autenticação de webhooks

### Fase 3: Testes Completos

- [ ] Testar fluxo completo de checkout com Wise
- [ ] Validar criação de quote, recipient e transfer
- [ ] Validar redirect para Wise
- [ ] Validar confirmação via webhook
- [ ] Validar geração de PDF e emails

### Fase 4: Produção

- [ ] Migrar variáveis de ambiente para produção
- [ ] Configurar webhook em produção
- [ ] Testar em ambiente de produção
- [ ] Documentar para usuários finais

---

## 🔍 DIAGNÓSTICO ATUAL

### Problema Atual: Webhook Secret Não Visível

**Data**: 2026-01-12  
**Status**: Webhook criado com sucesso, mas secret não está visível na interface

**Observações**:
- Webhook foi criado corretamente na conta Wise
- URL está configurada corretamente
- Eventos estão configurados corretamente ("Transfer updates")
- **Interface não exibe nenhum campo de "Webhook Secret"**

**Próximos Passos**:
1. Tentar regenerar o webhook secret na interface Wise
2. Verificar documentação da Wise sobre webhook secrets para Personal Tokens
3. Se não for possível obter secret, verificar se Personal Tokens usam outro método de autenticação

---

### Último Erro Encontrado (Anterior)

**Data**: 2026-01-12  
**Erro**: `Missing required bank details for ABA account type`

**Logs**:
```
[Wise Checkout] ========== REQUEST RECEIVED ==========
[Wise Checkout] Method: POST
[Wise Checkout] Environment: sandbox
[Wise Checkout] Has Personal Token: true
[Wise Checkout] Account Type: aba
[Wise Checkout] Has ABA: false
[Wise Checkout] Has Account Number: false
[Wise Checkout] ❌ Missing required bank details for ABA account type
```

**Causa**: Variáveis `WISE_MIGMA_ABA` e `WISE_MIGMA_ACCOUNT_NUMBER` não configuradas

**Solução**: Configurar variáveis no Supabase Dashboard

---

## 📝 NOTAS IMPORTANTES

### Decisões Técnicas Tomadas

1. **Autenticação**: Personal Token (não precisa contato com Wise)
2. **Fluxo de Pagamento**: Cliente paga diretamente na plataforma Wise (redirect flow)
3. **Webhook**: Aceita requisições de teste sem secret para permitir criação do webhook

### Limitações Aceitas

- ❌ Não pode fundar transfers via API (devido PSD2)
- ❌ Cliente precisa fazer o pagamento na plataforma Wise
- ✅ Webhook confirma quando pagamento é recebido

### Arquivos Modificados

**Criados**:
- `src/lib/wise/*` (6 arquivos)
- `supabase/functions/create-wise-checkout/index.ts`
- `supabase/functions/wise-webhook/index.ts`
- `supabase/migrations/20260110000003_add_wise_fields_to_visa_orders.sql`
- `supabase/migrations/20260110000004_create_wise_transfers_table.sql`
- `docs/WISE_API_INTEGRATION_PLAN.md`
- `docs/WISE_ENV_VARIABLES.md`
- `docs/WISE_INTEGRATION_STATUS.md` (este arquivo)

**Modificados**:
- `src/pages/VisaCheckout.tsx` - Adicionado suporte a Wise

---

## 🚀 PRÓXIMOS PASSOS (Quando Retomar)

### Passo 1: Configurar Variáveis de Ambiente

1. Obter dados bancários da Migma:
   - ABA (routing number)
   - Account Number
   - Account Holder Name
   - Bank Name
   - City, Country

2. Obter `WISE_PERSONAL_TOKEN` da conta Wise

3. Configurar no Supabase Dashboard:
   - Acessar: **Project Settings** > **Edge Functions** > **Secrets**
   - Adicionar todas as variáveis listadas em `docs/WISE_ENV_VARIABLES.md`

4. Testar criação de checkout:
   - Tentar criar um pedido com Wise
   - Verificar logs no Supabase Dashboard
   - Validar se quote, recipient e transfer são criados

### Passo 2: Configurar Webhook

1. Setor de TI acessa conta Wise
2. Cria webhook apontando para: `https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/wise-webhook`
3. Seleciona evento: "Transfer update events"
4. Copia o Webhook Secret gerado
5. Configura `WISE_WEBHOOK_SECRET` no Supabase Dashboard

### Passo 3: Testes Completos

1. Criar pedido de teste no checkout
2. Validar redirect para Wise
3. Simular pagamento (sandbox)
4. Validar webhook recebe evento
5. Validar status atualizado no banco
6. Validar PDF e email gerados

---

## 📞 CONTATOS E RESPONSABILIDADES

### Dados Necessários

**Setor Financeiro/Contábil**:
- Dados bancários da Migma (ABA, Account Number, etc.)

**Setor de TI**:
- Acesso à conta Wise
- Configuração do webhook
- Obtenção do Personal Token

**Desenvolvimento**:
- ✅ Código implementado
- ✅ Migrations aplicadas
- ✅ Edge Functions deployadas
- ⏸️ Aguardando configuração de variáveis

---

## 📚 DOCUMENTAÇÃO RELACIONADA

- `docs/WISE_API_INTEGRATION_PLAN.md` - Plano completo de integração
- `docs/WISE_ENV_VARIABLES.md` - Lista completa de variáveis de ambiente
- `docs/VISA_CHECKOUT_SETUP.md` - Documentação do sistema de checkout existente

---

## ✅ RESUMO EXECUTIVO

**Status**: 🟡 **75% Completo - Aguardando Configuração**

**O que funciona**:
- ✅ Todo o código está implementado
- ✅ Banco de dados configurado
- ✅ Edge Functions deployadas
- ✅ Integração no checkout pronta

**O que falta**:
- ⏸️ Configurar variáveis de ambiente (dados bancários + token)
- ⏸️ Configurar webhook na conta Wise
- ⏸️ Testes do fluxo completo

**Bloqueadores**:
1. Dados bancários da Migma (setor financeiro)
2. Personal Token da conta Wise (setor de TI)
3. Configuração do webhook (setor de TI)

**Estimativa para Retomar**: 
- Depende da disponibilidade dos dados bancários e acesso à conta Wise
- Após obter dados, configuração leva ~15 minutos
- Testes completos: ~1-2 horas

---

**Última atualização**: 2026-01-12  
**Próxima revisão**: Após configurar variáveis no Supabase

**📌 AÇÃO IMEDIATA**: 
- Ver `docs/WISE_CONFIGURACAO_RAPIDA.md` para configurar variáveis no Supabase Dashboard
- Todas as informações necessárias já foram obtidas

---

## 🎉 ATUALIZAÇÃO: Dados Bancários Obtidos (12/01/2026)

**Status**: ✅ **Informações obtidas - Pronto para configurar**

### Dados Obtidos:

**Conta ABA (ACH/Wire)**:
- Routing Number (ABA): `084009519`
- Account Number: `777855076826940`
- Account Holder: `MIGMA INC` (nome legal da empresa)
- Banco: Column National Association
- Endereço: A4-700 1 Letterman Drive, San Francisco CA 94129

**Informações Adicionais**:
- Membership Number: `P99300169`
- Referência: `807064`
- Swift/BIC: `TRWIUS35XXX` (para referência futura)

### Próximos Passos:

1. ⚠️ **Obter `WISE_PERSONAL_TOKEN` completo** (se ainda não tiver):
   - Acesse: Conta Wise > Integrations and Tools > API tokens
   - Copie o token completo

2. ✅ **Configurar variáveis no Supabase Dashboard**:
   - Ver instruções detalhadas em: `docs/WISE_CONFIGURACAO_COMPLETA.md`
   - Todas as informações necessárias já foram obtidas

3. 🧪 **Testar criação de checkout**:
   - Após configurar, testar o fluxo completo

---

## 📌 ATUALIZAÇÃO: Webhook Secret (12/01/2026)

**Situação**: Webhook criado com sucesso, mas webhook secret não está visível na interface da Wise.

**Análise da Interface**:
- Webhook nomeado como "Intregação Migma" foi criado
- Versão 2.0.0
- Eventos: "Transfer updates"
- URL: `https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/wise-webhook`
- **Nenhum campo de "Webhook Secret" visível na interface**

**Possíveis Explicações**:
1. Secret foi gerado mas exibido apenas uma vez (comportamento padrão de segurança)
2. Personal Tokens podem não usar webhook secrets (usar outro método)
3. Secret pode estar em outra seção da interface

**Recomendações**:
1. Tentar editar o webhook e procurar opção "Regenerate secret"
2. Verificar se há botão "Show secret" ou similar
3. Consultar documentação oficial da Wise sobre webhook authentication
4. Se não for possível obter secret, verificar se webhook funciona sem ele (já configurado para aceitar)
