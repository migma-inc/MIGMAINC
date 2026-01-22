# 🎯 Guia Rápido - Configurar E-mail de Reset de Senha no Supabase

## Caminho Correto no Dashboard:

```
Supabase Dashboard
  └─ Project Settings (ícone de engrenagem ⚙️)
      └─ Auth
          └─ Email Templates (role a página para baixo)
              └─ Reset Password (clique para editar)
```

---

## 📋 Passo a Passo Simplificado:

### PASSO 1: Navegue até Email Templates
1. Abra https://supabase.com/dashboard
2. Selecione seu projeto
3. Clique no ícone de **engrenagem** (⚙️) no menu lateral = **"Project Settings"**
4. No submenu lateral, clique em **"Auth"**
5. **Role a página para baixo** até ver a seção **"Email Templates"**

### PASSO 2: Edite o Template de Reset Password
1. Procure por **"Reset Password"** ou **"Change Email Address"**
2. Clique no botão de **editar** (ícone de lápis ou "Edit")

### PASSO 3: Configure o Subject
No campo **"Subject"**, cole:
```
Reset Your Password - MIGMA Seller Account
```

### PASSO 4: Cole o Template HTML
1. **APAGUE TODO** o conteúdo do campo **"Message (Body)"**
2. Abra o arquivo: `docs/SELLER_PASSWORD_RESET_EMAIL_TEMPLATE.html`
3. **Copie TODO** o HTML (Ctrl+A, Ctrl+C)
4. **Cole** no campo "Message (Body)" (Ctrl+V)

### PASSO 5: Configure URLs de Redirecionamento
1. Volte para **Project Settings** > **Auth**
2. Role até a seção **"URL Configuration"**
3. Configure:

**Site URL:**
```
http://localhost:5173
```
(ou `https://migmainc.com` para produção)

**Redirect URLs** (adicione uma por linha):
```
http://localhost:5173/reset-password
http://localhost:5173/reset-password/**
https://migmainc.com/reset-password
https://migmainc.com/reset-password/**
```

### PASSO 6: Salve
Clique em **"Save"** no canto superior direito

---

## 🧪 Testar

1. Acesse: `http://localhost:5173/seller/forgot-password`
2. Digite um e-mail de seller cadastrado
3. Clique em "Send Reset Link"
4. Verifique o e-mail (pode demorar 1-2 minutos)
5. Clique no botão "Reset Password" no e-mail
6. Você deve ser redirecionado para `/seller/reset-password`

---

## ⚠️ Troubleshooting

### "Não encontro Email Templates"
- Certifique-se de estar em **Project Settings** (ícone de engrenagem)
- Depois clique em **Auth** no submenu lateral
- **Role a página para baixo** - os templates ficam no final da página

### "E-mail não chega"
- Verifique spam/lixo eletrônico
- O Supabase tem limite de 3 e-mails/hora no plano gratuito
- Aguarde alguns minutos entre tentativas

### "Link não funciona"
- Verifique se adicionou as Redirect URLs corretamente
- Certifique-se de que `/seller/reset-password` existe nas suas rotas
- O link expira em 1 hora

---

## 📸 Referência Visual

Você deve ver algo assim no Dashboard:

```
Project Settings
├─ General
├─ Database
├─ API
├─ Auth  ← CLIQUE AQUI
│   ├─ Providers
│   ├─ Policies
│   ├─ URL Configuration
│   └─ Email Templates  ← ROLE ATÉ AQUI
│       ├─ Confirm signup
│       ├─ Invite user
│       ├─ Magic Link
│       ├─ Change Email Address
│       └─ Reset Password  ← EDITE ESTE
└─ Storage
```

---

**Última atualização**: 2026-01-22 15:01
