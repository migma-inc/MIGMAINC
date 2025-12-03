# 📧 Sistema de Envio de Emails - MIGMA Global Partner

## ✅ Status Atual

**✅ FUNCIONANDO EM PRODUÇÃO**

- ✅ Emails sendo enviados via SMTP Google direto
- ✅ Não cai em spam (configuração correta)
- ✅ Suporte a português e inglês
- ✅ Templates HTML responsivos
- ✅ Confirmação automática de aplicações

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Histórico e Problemas Resolvidos](#histórico-e-problemas-resolvidos)
4. [Configuração](#configuração)
5. [Implementação Técnica](#implementação-técnica)
6. [Testes](#testes)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O sistema de envio de emails do MIGMA Global Partner foi implementado usando **SMTP Google direto** através de uma **Supabase Edge Function**. Isso permite:

- ✅ Envio de emails sem depender de serviços externos (Resend, SendGrid, etc.)
- ✅ Controle total sobre o remetente e conteúdo
- ✅ Melhor deliverability (menos chance de ir para spam)
- ✅ Custo zero (usando Gmail/Google Workspace)
- ✅ Suporte completo a HTML e templates personalizados

---

## 🏗️ Arquitetura

```
┌─────────────────┐
│   Frontend      │
│  (React/Vite)   │
│                 │
│  GlobalPartner  │
│     Form        │
└────────┬────────┘
         │
         │ 1. Submit Form
         ▼
┌─────────────────┐
│  emails.ts      │
│  (Client)       │
│                 │
│  sendEmail()    │
└────────┬────────┘
         │
         │ 2. POST /functions/v1/send-email
         ▼
┌─────────────────────────────────┐
│  Supabase Edge Function          │
│  send-email/index.ts             │
│                                  │
│  - Recebe: to, subject, html    │
│  - Lê secrets: SMTP_*           │
│  - Conecta via SMTP direto      │
└────────┬────────────────────────┘
         │
         │ 3. SMTP Protocol (TLS)
         ▼
┌─────────────────┐
│  Gmail SMTP     │
│  smtp.gmail.com │
│  Port 587       │
└─────────────────┘
         │
         │ 4. Email Delivered
         ▼
┌─────────────────┐
│  Recipient      │
│  Inbox          │
└─────────────────┘
```

### Componentes Principais

1. **Frontend (`src/lib/emails.ts`)**
   - Função `sendEmail()` que chama a Edge Function
   - Função `sendApplicationConfirmationEmail()` para confirmações
   - Função `testEmailSending()` para testes

2. **Edge Function (`supabase/functions/send-email/index.ts`)**
   - Implementação SMTP direta usando sockets TLS do Deno
   - Suporta porta 587 (STARTTLS) e 465 (TLS direto)
   - Autenticação via Google App Password
   - Envio de emails HTML

3. **Supabase Secrets**
   - Armazenamento seguro das credenciais SMTP
   - Configuração via Dashboard

---

## 📜 Histórico e Problemas Resolvidos

### Problema Inicial: Resend com Limitações

**Situação:**
- Sistema inicial usava Resend API
- Resend só permitia enviar emails de teste para o próprio email cadastrado
- Para produção, exigia verificação de domínio
- Custo adicional para envio em produção

**Solução:**
- Migração completa para SMTP Google direto
- Remoção de todas as dependências do Resend
- Implementação de protocolo SMTP nativo no Deno

### Problemas Técnicos Enfrentados

1. **Erro: "SmtpClient is not a constructor"**
   - **Causa**: Tentativa de usar biblioteca externa incompatível
   - **Solução**: Implementação SMTP direta usando sockets nativos do Deno

2. **Erro: "Right-hand side of 'instanceof' is not an object"**
   - **Causa**: Uso incorreto de `instanceof` com tipos do Deno
   - **Solução**: Remoção de verificações de tipo desnecessárias, uso de `as any` para conversão de tipos

3. **Erro: "SMTP authentication failed"**
   - **Causa**: Uso de senha normal do Gmail ao invés de App Password
   - **Solução**: Documentação clara sobre necessidade de Google App Password

4. **Email indo para spam**
   - **Causa**: Configuração incorreta de headers SMTP
   - **Solução**: Implementação correta de headers MIME e estrutura de email

---

## ⚙️ Configuração

### Passo 1: Obter Google App Password

**IMPORTANTE**: Você precisa usar uma **Senha de App**, não a senha normal do Gmail!

1. **Ativar Verificação em Duas Etapas**
   - Acesse: https://myaccount.google.com/security
   - Ative a **Verificação em duas etapas** (obrigatório)

2. **Gerar Senha de App**
   - Acesse: https://myaccount.google.com/apppasswords
   - Selecione:
     - **App**: "Mail"
     - **Dispositivo**: "Outro (nome personalizado)"
     - Digite: "MIGMA SMTP" ou "Supabase Edge Function"
   - Clique em **"Gerar"**
   - **Copie a senha de 16 caracteres** (ex: `abcd efgh ijkl mnop`)
   - ⚠️ **IMPORTANTE**: Você só verá essa senha uma vez! Salve em local seguro.

### Passo 2: Configurar Supabase Secrets

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para: **Settings** > **Edge Functions** > **Secrets**

4. Adicione as seguintes variáveis:

| Nome da Variável | Valor | Descrição |
|-----------------|-------|-----------|
| `SMTP_HOST` | `smtp.gmail.com` | Servidor SMTP do Google |
| `SMTP_PORT` | `587` | Porta SMTP (TLS com STARTTLS) |
| `SMTP_USER` | `seu-email@gmail.com` | Seu email Gmail completo |
| `SMTP_PASS` | `abcdefghijklmnop` | Senha de app de 16 caracteres (sem espaços) |
| `SMTP_FROM_EMAIL` | `seu-email@gmail.com` | Email que aparecerá como remetente |
| `SMTP_FROM_NAME` | `MIGMA` | Nome que aparecerá como remetente |

**Exemplo de configuração:**

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=appsmigma@gmail.com
SMTP_PASS=cbtvlwmlgydsfahj
SMTP_FROM_EMAIL=appsmigma@gmail.com
SMTP_FROM_NAME=MIGMA
```

**⚠️ Importante:**
- ✅ Use a senha de app de **16 caracteres** (sem espaços)
- ❌ **NÃO** use sua senha normal do Gmail
- ❌ **NÃO** inclua espaços na senha de app
- ✅ `SMTP_FROM_EMAIL` deve ser o mesmo que `SMTP_USER` (ou alias do mesmo Gmail)

### Passo 3: Limpar .env Local

Remova estas linhas do seu `.env` (não são mais necessárias):

```env
# Remover estas linhas:
VITE_RESEND_API_KEY=...
VITE_FROM_EMAIL=onboarding@resend.dev
```

Seu `.env` deve conter apenas:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

---

## 🔧 Implementação Técnica

### Edge Function: SMTP Direto

A Edge Function implementa o protocolo SMTP diretamente usando sockets TLS do Deno:

```typescript
// Conexão SMTP
if (config.port === 465) {
  // Porta 465: TLS direto
  conn = await Deno.connectTls({
    hostname: config.host,
    port: config.port,
  });
} else {
  // Porta 587: conexão não criptografada primeiro
  conn = await Deno.connect({
    hostname: config.host,
    port: config.port,
  });
}

// STARTTLS (apenas para porta 587)
if (config.port === 587) {
  await sendCommand("STARTTLS");
  conn = await Deno.startTls(conn as any, {
    hostname: config.host,
  });
}

// Autenticação
await sendCommand("AUTH LOGIN");
await sendCommand(btoa(config.user)); // Usuário em base64
await sendCommand(btoa(config.pass)); // Senha em base64

// Envio
await sendCommand(`MAIL FROM:<${fromEmail}>`);
await sendCommand(`RCPT TO:<${config.to}>`);
await sendCommand("DATA");
await sendCommand(message); // Mensagem completa
await sendCommand("QUIT");
```

### Fluxo de Envio

1. **Frontend** (`src/lib/emails.ts`)
   ```typescript
   const { data, error } = await supabase.functions.invoke('send-email', {
     body: {
       to: options.to,
       subject: options.subject,
       html: options.html,
     },
   });
   ```

2. **Edge Function** recebe a requisição e:
   - Valida campos obrigatórios
   - Lê secrets do Supabase
   - Conecta ao servidor SMTP
   - Autentica usando App Password
   - Envia email via protocolo SMTP
   - Retorna sucesso/erro

3. **Gmail SMTP** processa e entrega o email

### Templates de Email

Os templates são gerados dinamicamente em `src/lib/emails.ts`:

- **Confirmação de Aplicação**: `sendApplicationConfirmationEmail()`
- **Email de Teste**: `testEmailSending()`

Todos os templates incluem:
- HTML responsivo
- Suporte a português e inglês
- Estilos inline para compatibilidade
- Estrutura MIME correta

---

## 🧪 Testes

### Teste Manual via Console

No console do navegador:

```javascript
import { testEmailSending } from './src/lib/emails.ts';

// Testar envio de email
await testEmailSending('seu-email@gmail.com');
```

### Teste via Formulário

1. Preencha o formulário de Global Partner
2. Submeta a aplicação
3. Verifique se o email de confirmação foi recebido
4. Verifique se não foi para spam

### Verificar Logs

1. No Supabase Dashboard, vá para: **Edge Functions** > **send-email** > **Logs**
2. Verifique mensagens como:
   - `[EDGE FUNCTION] Sending email via SMTP`
   - `[EDGE FUNCTION] Email sent successfully via SMTP`

---

## 🔍 Troubleshooting

### Erro: "SMTP authentication failed"

**Possíveis causas:**
- Senha de app incorreta
- Verificação em duas etapas não ativada
- Espaços na senha de app

**Solução:**
1. Verifique se a verificação em duas etapas está ativa
2. Gere uma nova senha de app
3. Copie a senha sem espaços
4. Atualize o secret `SMTP_PASS` no Supabase

### Erro: "SMTP connection failed"

**Possíveis causas:**
- `SMTP_HOST` incorreto
- `SMTP_PORT` incorreto
- Firewall bloqueando conexão

**Solução:**
1. Verifique se `SMTP_HOST=smtp.gmail.com`
2. Verifique se `SMTP_PORT=587` (ou `465` para TLS direto)
3. Teste conectividade de rede

### Erro: "STARTTLS failed"

**Possíveis causas:**
- Servidor SMTP não suporta STARTTLS
- Porta incorreta

**Solução:**
1. Use porta `587` para STARTTLS
2. Ou use porta `465` para TLS direto (mude no código se necessário)

### Email indo para spam

**Possíveis causas:**
- Headers SMTP incorretos
- Conteúdo suspeito
- Reputação do remetente

**Solução:**
1. Verifique se `SMTP_FROM_EMAIL` é válido
2. Verifique se `SMTP_FROM_NAME` está configurado
3. Use conteúdo profissional nos emails
4. Evite palavras suspeitas (spam, free, etc.)

### Edge Function retorna 500

**Possíveis causas:**
- Secrets não configurados
- Erro na conexão SMTP
- Erro na autenticação

**Solução:**
1. Verifique os logs da Edge Function
2. Confirme que todos os secrets estão configurados
3. Teste as credenciais manualmente

---

## 📊 Status e Métricas

### ✅ Funcionalidades Implementadas

- [x] Envio de emails via SMTP Google
- [x] Suporte a HTML
- [x] Templates personalizados
- [x] Confirmação de aplicações
- [x] Email de teste
- [x] Tratamento de erros
- [x] Logs detalhados
- [x] CORS configurado
- [x] Não cai em spam

### 🔄 Melhorias Futuras (Opcional)

- [ ] Suporte a anexos
- [ ] Fila de emails (retry automático)
- [ ] Templates mais elaborados
- [ ] Suporte a múltiplos idiomas dinâmicos
- [ ] Analytics de abertura/clique
- [ ] Suporte a outros provedores SMTP (Outlook, etc.)

---

## 🔒 Segurança

### Boas Práticas Implementadas

- ✅ Senha de app (mais segura que senha normal)
- ✅ Secrets armazenados no Supabase (não no código)
- ✅ Conexão TLS/SSL para SMTP
- ✅ Validação de entrada na Edge Function
- ✅ Tratamento seguro de erros (não expõe credenciais)

### Recomendações

- 🔄 Revogar e regenerar senha de app periodicamente
- 🔄 Monitorar logs para atividades suspeitas
- 🔄 Usar conta Gmail dedicada para produção
- 🔄 Considerar Google Workspace para domínio próprio

---

## 📚 Referências

- [Google App Passwords](https://support.google.com/accounts/answer/185833)
- [Supabase Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets)
- [SMTP Protocol RFC 5321](https://tools.ietf.org/html/rfc5321)
- [Deno TLS Documentation](https://deno.land/api?s=Deno.connectTls)

---

## 📝 Notas de Implementação

### Decisões Técnicas

1. **SMTP Direto vs Biblioteca**
   - Escolhido: SMTP direto usando sockets nativos
   - Motivo: Mais controle, menos dependências, compatibilidade garantida

2. **Porta 587 vs 465**
   - Escolhido: Porta 587 (STARTTLS)
   - Motivo: Mais compatível, suporta fallback

3. **Edge Function vs Client-side**
   - Escolhido: Edge Function
   - Motivo: Segurança (credenciais no servidor), CORS, melhor deliverability

### Arquivos Modificados/Criados

- ✅ `supabase/functions/send-email/index.ts` - Edge Function principal
- ✅ `src/lib/emails.ts` - Cliente de email no frontend
- ✅ `SMTP_SETUP.md` - Esta documentação

### Arquivos Removidos

- ❌ Referências ao Resend
- ❌ `VITE_RESEND_API_KEY` do `.env`
- ❌ `VITE_FROM_EMAIL=onboarding@resend.dev` do `.env`

---

## ✅ Checklist de Deploy

Antes de considerar o sistema pronto para produção:

- [x] Google App Password gerada
- [x] Secrets configurados no Supabase
- [x] Edge Function deployada
- [x] Teste de envio bem-sucedido
- [x] Email não vai para spam
- [x] Templates funcionando corretamente
- [x] Logs configurados
- [x] Documentação completa
- [x] `.env` limpo (sem referências ao Resend)

---

**Última atualização:** 03/12/2025  
**Status:** ✅ Funcionando em Produção  
**Versão Edge Function:** 12
