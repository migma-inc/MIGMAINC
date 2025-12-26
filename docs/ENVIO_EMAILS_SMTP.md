# 📧 Como Funciona o Envio de Emails via SMTP

## 🎯 Visão Geral

O sistema envia emails usando **SMTP do Google** através de uma **Supabase Edge Function**. Isso permite enviar emails de forma segura e confiável.

---

## 🔄 Como Funciona

### Fluxo Simplificado

```
1. Frontend (React)
   ↓ Chama função sendEmail()
   
2. Supabase Edge Function (send-email)
   ↓ Usa credenciais SMTP
   
3. Servidor SMTP do Google (smtp.gmail.com)
   ↓ Entrega o email
   
4. Destinatário recebe o email
```

### Passo a Passo

1. **No código frontend**, você chama uma função como `sendApplicationConfirmationEmail()`
2. **A função** prepara o HTML do email e chama a Edge Function `send-email`
3. **A Edge Function** conecta ao servidor SMTP do Google usando as credenciais configuradas
4. **O email é enviado** e entregue ao destinatário

---

## ⚙️ Configuração Necessária

### 1. Obter Senha de App do Google

⚠️ **IMPORTANTE**: Você precisa de uma **Senha de App**, não a senha normal do Gmail!

1. Ative a **Verificação em duas etapas** no Google: https://myaccount.google.com/security
2. Gere uma **Senha de App**: https://myaccount.google.com/apppasswords
   - Selecione: "Mail" → "Outro" → Digite "MIGMA SMTP"
   - Copie a senha de 16 caracteres (ex: `abcdefghijklmnop`)

### 2. Configurar no Supabase

1. Acesse: **Supabase Dashboard** → Seu Projeto → **Settings** → **Edge Functions** → **Secrets**
2. Adicione estas variáveis:

| Variável | Valor | Exemplo |
|----------|-------|---------|
| `SMTP_HOST` | `smtp.gmail.com` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` | `587` |
| `SMTP_USER` | Seu email Gmail | `seu-email@gmail.com` |
| `SMTP_PASS` | Senha de app (16 caracteres) | `abcdefghijklmnop` |
| `SMTP_FROM_EMAIL` | Email remetente | `seu-email@gmail.com` |
| `SMTP_FROM_NAME` | Nome remetente | `MIGMA` |

---

## 💻 Como Usar no Código

### Exemplo Básico

```typescript
import { sendApplicationConfirmationEmail } from '@/lib/emails';

// Enviar email de confirmação
await sendApplicationConfirmationEmail('cliente@email.com', 'Nome do Cliente');
```

### Funções Disponíveis

- `sendApplicationConfirmationEmail(email, nome)` - Confirmação de aplicação
- `sendApprovalEmail(email, nome, token)` - Aprovação com link de termos
- `sendMeetingInvitationEmail(email, nome, data, hora, link)` - Convite para reunião
- `sendTermsAcceptanceConfirmationEmail(email, nome)` - Confirmação de aceite
- `sendContractRejectionEmail(email, nome, orderNumber, token)` - Rejeição de contrato

### Testar Envio de Email

```typescript
import { testEmailSending } from '@/lib/emails';

// No console do navegador
await testEmailSending('seu-email@gmail.com');
```

---

## 📁 Arquivos Principais

- **`src/lib/emails.ts`** - Funções para enviar emails (frontend)
- **`supabase/functions/send-email/index.ts`** - Edge Function que faz o envio via SMTP

---

## ✅ Checklist

Antes de usar, verifique:

- [ ] Verificação em duas etapas ativada no Google
- [ ] Senha de app gerada (16 caracteres)
- [ ] Secrets configurados no Supabase
- [ ] Edge Function `send-email` deployada
- [ ] Teste de envio funcionando

---

## 🔍 Troubleshooting Rápido

**Erro: "SMTP authentication failed"**
- Use senha de app, não a senha normal do Gmail
- Verifique se a verificação em duas etapas está ativa

**Email não chega**
- Verifique a pasta de spam
- Confirme que os secrets estão corretos no Supabase
- Veja os logs da Edge Function no Supabase Dashboard

**Edge Function retorna erro 500**
- Verifique se todos os secrets estão configurados
- Confirme que a senha de app não tem espaços

---

## 📝 Notas Importantes

- ✅ As credenciais SMTP ficam **seguras** no Supabase (não no código)
- ✅ O envio é feito **server-side** (mais seguro)
- ✅ Suporta HTML completo nos emails
- ✅ Não cai em spam (configuração correta)

---

**Última atualização:** Janeiro 2025






