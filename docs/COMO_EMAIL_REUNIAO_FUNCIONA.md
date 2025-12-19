# Como o Email de Reunião Funciona

## 📧 Visão Geral

O email de reunião é montado como um **template HTML** no frontend e enviado através de uma **Supabase Edge Function** que usa **SMTP Google** diretamente.

## 🎨 Como o Email Foi Montado

### 1. Template HTML (src/lib/emails.ts)

O email é construído como uma **string HTML** dentro da função `sendMeetingInvitationEmail()`:

```typescript
export async function sendMeetingInvitationEmail(
    email: string,
    fullName: string,
    meetingDate: string,
    meetingTime: string,
    meetingLink: string
): Promise<boolean> {
    // Formata a data para exibição
    const dateObj = new Date(meetingDate);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    // Monta o HTML do email
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        </head>
        <body style="...">
            <!-- Estrutura do email em tabelas HTML (compatível com clientes de email) -->
            ...
        </body>
        </html>
    `;

    // Chama a função que envia o email
    return sendEmail({
        to: email,
        subject: 'Your MIGMA Global Partner Application Has Been Approved - Meeting Scheduled',
        html: html,
    });
}
```

### 2. Estrutura do Template

O email usa **tabelas HTML** (não divs) porque clientes de email têm suporte limitado a CSS moderno:

- **Header**: Logo da MIGMA
- **Título**: "Your Application Has Been Approved!"
- **Mensagem personalizada**: Usa `${fullName}` para personalização
- **Card de Reunião**: 
  - Data formatada (ex: "Monday, January 20, 2025")
  - Horário (ex: "14:00")
  - Link da reunião (botão clicável + texto)
- **Instruções**: Lista de preparação para a reunião
- **Footer**: Informações legais e copyright

### 3. Estilização

O email usa **CSS inline** (estilos dentro das tags) porque:
- Muitos clientes de email ignoram `<style>` tags
- CSS inline garante compatibilidade máxima
- Cores e gradientes seguem a identidade visual MIGMA (dourado/preto)

**Cores principais**:
- Fundo: `#000000` (preto)
- Texto: `#e0e0e0` (cinza claro)
- Destaque: `#CE9F48` (dourado MIGMA)
- Gradiente: `#F3E196` → `#CE9F48` → `#8E6E2F`

## 📤 Como o Email É Enviado

### Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Admin aprova aplicação                                   │
│    src/lib/admin.ts → approveApplicationForMeeting()       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Chama função de email                                     │
│    src/lib/emails.ts → sendMeetingInvitationEmail()         │
│    - Monta HTML do email                                     │
│    - Formata dados (data, horário)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Chama função genérica de envio                            │
│    src/lib/emails.ts → sendEmail()                          │
│    - Prepara payload: { to, subject, html }                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Invoca Supabase Edge Function                             │
│    supabase.functions.invoke('send-email', {                 │
│      body: { to, subject, html }                            │
│    })                                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Edge Function processa (servidor)                          │
│    supabase/functions/send-email/index.ts                   │
│    - Lê secrets do Supabase (SMTP_USER, SMTP_PASS, etc.)    │
│    - Conecta ao SMTP do Google (smtp.gmail.com:587)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Envia via SMTP                                            │
│    - Autentica com Google                                    │
│    - Envia email usando protocolo SMTP                       │
│    - Retorna sucesso/erro                                    │
└─────────────────────────────────────────────────────────────┘
```

### Detalhamento Técnico

#### Passo 1-3: Frontend (src/lib/emails.ts)

```typescript
// Função genérica que envia qualquer email
async function sendEmail(options: EmailOptions): Promise<boolean> {
    // Chama a Edge Function do Supabase
    const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
            to: options.to,
            subject: options.subject,
            html: options.html,
        },
    });

    if (error || data?.error) {
        console.error('Erro ao enviar email:', error);
        return false;
    }

    return true;
}
```

#### Passo 4-6: Backend (supabase/functions/send-email/index.ts)

A Edge Function:

1. **Recebe o request**:
   ```typescript
   const { to, subject, html, from } = await req.json();
   ```

2. **Lê configurações SMTP dos Secrets do Supabase**:
   ```typescript
   const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
   const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
   const SMTP_USER = Deno.env.get("SMTP_USER"); // Email do Gmail
   const SMTP_PASS = Deno.env.get("SMTP_PASS"); // App Password do Google
   const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL") || SMTP_USER;
   const SMTP_FROM_NAME = Deno.env.get("SMTP_FROM_NAME") || "MIGMA";
   ```

3. **Conecta ao servidor SMTP do Google**:
   - Porta 587: Conexão não criptografada → STARTTLS → Autenticação
   - Porta 465: Conexão TLS direta

4. **Envia o email usando protocolo SMTP**:
   ```typescript
   // Comandos SMTP:
   EHLO smtp.gmail.com
   STARTTLS
   AUTH LOGIN
   MAIL FROM: <email@migma.com>
   RCPT TO: <destinatario@email.com>
   DATA
   Subject: ...
   From: ...
   To: ...
   Content-Type: text/html; charset=utf-8
   
   <HTML do email>
   .
   QUIT
   ```

5. **Retorna sucesso ou erro**:
   ```typescript
   return new Response(
       JSON.stringify({ success: true, message: "Email sent successfully" }),
       { status: 200 }
   );
   ```

## 🔐 Configuração Necessária

### Secrets do Supabase

No Supabase Dashboard → Settings → Edge Functions → Secrets, configure:

- `SMTP_HOST`: `smtp.gmail.com`
- `SMTP_PORT`: `587` (ou `465` para SSL direto)
- `SMTP_USER`: Seu email do Gmail (ex: `noreply@migma.com`)
- `SMTP_PASS`: **App Password do Google** (não a senha normal!)
- `SMTP_FROM_EMAIL`: Email que aparece como remetente
- `SMTP_FROM_NAME`: Nome que aparece como remetente (ex: "MIGMA")

### Como Gerar App Password do Google

1. Acesse: https://myaccount.google.com/apppasswords
2. Selecione "Mail" e "Other (Custom name)"
3. Digite "MIGMA Supabase"
4. Copie a senha gerada (16 caracteres)
5. Cole no secret `SMTP_PASS` do Supabase

## 📋 Exemplo de Email Enviado

**Subject**: `Your MIGMA Global Partner Application Has Been Approved - Meeting Scheduled`

**From**: `MIGMA <noreply@migma.com>`

**To**: `candidato@email.com`

**Body HTML**:
- Logo MIGMA no topo
- Título: "Your Application Has Been Approved!"
- Saudação personalizada: "Dear João Silva,"
- Card destacado com:
  - **Meeting Date**: Monday, January 20, 2025
  - **Meeting Time**: 14:00
  - **Meeting Link**: Botão "Join Meeting" + link completo
- Instruções de preparação
- Assinatura: "The MIGMA Team"
- Footer com copyright

## 🐛 Debugging

### Ver logs no console do navegador:

```javascript
// Logs automáticos quando email é enviado:
[EMAIL DEBUG] Attempting to send email: { to: "...", subject: "...", htmlLength: 1234 }
[EMAIL DEBUG] Email sent successfully: { success: true }
```

### Ver logs da Edge Function:

1. Acesse Supabase Dashboard
2. Vá em Edge Functions → `send-email`
3. Clique em "Logs"
4. Veja os logs em tempo real:
   ```
   [EDGE FUNCTION] Sending email to: candidato@email.com
   [EDGE FUNCTION] Sending email via SMTP: { from: "...", to: "...", ... }
   [EDGE FUNCTION] Email sent successfully via SMTP
   ```

### Erros Comuns

1. **"SMTP credentials not configured"**
   - Solução: Configure os secrets no Supabase

2. **"Authentication failed"**
   - Solução: Use App Password, não senha normal do Gmail

3. **"Connection timeout"**
   - Solução: Verifique se porta 587 está aberta (geralmente está)

4. **Email não chega**
   - Verifique spam/lixo eletrônico
   - Verifique logs da Edge Function
   - Teste com outro email

## 🧪 Como Testar

### Teste rápido no console do navegador:

```javascript
import { sendMeetingInvitationEmail } from '@/lib/emails';

await sendMeetingInvitationEmail(
    'seu-email@teste.com',
    'João Silva',
    '2025-01-20',
    '14:00',
    'https://zoom.us/j/123456789'
);
```

### Verificar se email foi enviado:

1. Console do navegador: Deve mostrar `[EMAIL DEBUG] Email sent successfully`
2. Logs do Supabase: Deve mostrar `[EDGE FUNCTION] Email sent successfully via SMTP`
3. Caixa de entrada: Email deve chegar em alguns segundos

## 📝 Resumo

1. **Template HTML**: Montado no frontend como string HTML
2. **Envio**: Via Supabase Edge Function que usa SMTP Google
3. **Configuração**: Secrets do Supabase com credenciais SMTP
4. **Protocolo**: SMTP direto (porta 587 com STARTTLS)
5. **Resultado**: Email chega na caixa de entrada do destinatário

O sistema é **100% funcional** e não depende de serviços externos pagos!

