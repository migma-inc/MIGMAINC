# 📧 Guia Completo de Configuração de Templates de E-mail

Este guia explica como configurar todos os templates de e-mail do sistema MIGMA no Supabase para garantir uma identidade visual consistente e premium.

## 📍 Onde Configurar
1. Acesse o **Supabase Dashboard**
2. Selecione seu projeto **MIGMA**
3. Clique no ícone de engrenagem **⚙️ Project Settings** (menu lateral esquerdo)
4. Clique em **Auth**
5. Role a página até encontrar a seção **Email Templates**

---

## 1. Confirm Email (Novo Cadastro)

Este e-mail é enviado quando um seller se cadastra.

1. Clique em **"Confirm Signup"**
2. **Subject:** `Confirm your registration - MIGMA`
3. Copie o HTML abaixo e cole no campo "Body":

*(Use o mesmo estilo visual, mas com texto de boas-vindas)*

---

## 2. Reset Password (Esqueci Minha Senha)

Este e-mail é enviado quando o usuário solicita a recuperação de senha.

1. Clique em **"Reset Password"**
2. **Subject:** `Reset Your Password - MIGMA`
3. Copie o HTML do arquivo: `docs/SELLER_PASSWORD_RESET_EMAIL_TEMPLATE.html`
4. Cole no campo "Body"

---

## 3. Change Email Address (Troca de E-mail)

Este e-mail é enviado quando o seller altera seu e-mail no painel.

1. Clique em **"Change Email Address"**
2. **Subject:** `Confirm Your Email Change - MIGMA`
3. Copie o HTML do arquivo: `docs/CHANGE_EMAIL_TEMPLATE.html`
4. Cole no campo "Body"

---

## 4. Invite User (Convite)

Este e-mail é enviado quando você convida um novo usuário.

1. Clique em **"Invite User"**
2. **Subject:** `You have been invited to MIGMA`
3. Use o mesmo estilo visual, adaptando o texto para "You have been invited".

---

## 🔗 Configuração de URLs

Para que os links funcionem corretamente, configure as **Redirect URLs** na mesma página de Auth:

Role até **"URL Configuration"** e adicione:

**Site URL:**
`https://migmainc.com` (Produção)
ou `http://localhost:5173` (Desenvolvimento)

**Redirect URLs:**
```
http://localhost:5173/reset-password
https://migmainc.com/reset-password
http://localhost:5173/seller/login
https://migmainc.com/seller/login
```

---

## ⚠️ Dicas Importantes
- **Identidade Visual:** Agora os templates utilizam o logo oficial hospedado no Supabase.
- **Código Limpo:** Os templates mantêm um código limpo e sem scripts para melhor entrega.
- **URLs Claras:** As URLs de redirecionamento foram simplificadas.

Sempre que salvar, verifique se não aparece nenhum aviso de erro no Supabase!
