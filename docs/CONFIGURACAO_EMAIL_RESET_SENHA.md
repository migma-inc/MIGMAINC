# Configuração do Template de E-mail de Recuperação de Senha - Supabase

## 📧 Template Customizado para Password Reset

Este guia mostra como configurar o template de e-mail de recuperação de senha no Supabase Dashboard para manter a identidade visual da MIGMA.

---

## 🎯 Passos para Configuração

### 1. Acessar o Supabase Dashboard
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto MIGMA
3. No menu lateral (ícone de engrenagem), clique em **Project Settings**
4. No submenu lateral, clique em **Auth**
5. Role a página até encontrar a seção **"Email Templates"**

### 2. Selecionar o Template de Reset Password
1. Na seção "Email Templates", encontre **"Reset Password"** ou **"Change Email Address"**
2. Clique no dropdown ou no botão de editar ao lado do template

### 3. Configurar o Subject (Assunto)
Cole o seguinte assunto:
```
Reset Your Password - MIGMA Seller Account
```

### 4. Colar o Template HTML
1. No campo **"Message (Body)"**, **DELETE TODO o conteúdo existente**
2. Abra o arquivo: `docs/SELLER_PASSWORD_RESET_EMAIL_TEMPLATE.html`
3. **Copie TODO o conteúdo** do arquivo
4. **Cole** no campo "Message (Body)" do Supabase

### 5. Verificar Variáveis do Supabase
O template usa a variável padrão do Supabase:
- `{{ .ConfirmationURL }}` - Link de recuperação de senha (gerado automaticamente)

**NÃO ALTERE** essa variável! O Supabase a substitui automaticamente pelo link correto.

### 6. Configurar Redirect URL (Importante!)
1. Ainda em **Project Settings** > **Auth**, role até a seção **"URL Configuration"**
2. No campo **"Site URL"**, configure:
   - **Produção**: `https://migmainc.com`
   - **Desenvolvimento**: `http://localhost:5173`

3. No campo **"Redirect URLs"**, adicione (uma por linha):
   ```
   https://migmainc.com/seller/reset-password
   http://localhost:5173/seller/reset-password
   https://migmainc.com/seller/reset-password/**
   http://localhost:5173/seller/reset-password/**
   ```
   
   **Nota**: Os `/**` no final permitem que o Supabase aceite qualquer query parameter (como o token de reset).

### 7. Salvar as Alterações
1. Clique em **"Save"** no canto superior direito
2. Aguarde a confirmação de sucesso

---

## 🧪 Testar o Template

### Método 1: Via Interface do Seller
1. Acesse: `http://localhost:5173/seller/forgot-password`
2. Digite um e-mail de seller cadastrado
3. Clique em "Send Reset Link"
4. Verifique a caixa de entrada do e-mail

### Método 2: Via Supabase Dashboard
1. No Supabase Dashboard, vá em **Authentication** > **Users**
2. Encontre um usuário de teste
3. Clique nos 3 pontinhos (...) ao lado do usuário
4. Selecione **"Send password recovery"**
5. Verifique o e-mail

---

## 🎨 Características do Template

### Design
- ✅ Fundo preto (#000000) consistente com a identidade MIGMA
- ✅ Gradientes dourados (#8E6E2F, #CE9F48, #F3E196)
- ✅ Tipografia Plus Jakarta Sans (mesma dos outros e-mails)
- ✅ Botão CTA com gradiente dourado e sombra
- ✅ Box de aviso com borda dourada
- ✅ Logo MIGMA no topo
- ✅ Footer com disclaimer e copyright

### Funcionalidades
- ✅ Responsivo (funciona em mobile e desktop)
- ✅ Link clicável no botão
- ✅ Link alternativo em texto (para clientes de e-mail que bloqueiam botões)
- ✅ Aviso de expiração (1 hora)
- ✅ Mensagem de segurança (pode ignorar se não solicitou)

---

## ⚠️ Observações Importantes

1. **Rate Limit**: O Supabase tem limite de 3 e-mails/hora no plano gratuito. Para produção, configure SMTP customizado.

2. **SMTP Customizado**: Para evitar rate limits, configure SMTP próprio:
   - Vá em **Settings** > **Auth** > **SMTP Settings**
   - Configure com Resend ou SendGrid

3. **Variáveis do Template**: 
   - `{{ .ConfirmationURL }}` é substituída automaticamente
   - `{{ .Token }}` também está disponível se precisar
   - `{{ .TokenHash }}` para casos avançados

4. **Expiração do Link**: Por padrão, links expiram em 1 hora. Para alterar:
   - Vá em **Settings** > **Auth** > **Email Auth**
   - Ajuste "Mailer Autoconfirm" settings

---

## 🔧 Troubleshooting

### E-mail não chega
1. Verifique spam/lixo eletrônico
2. Confirme que o SMTP está configurado (ou use o padrão do Supabase)
3. Verifique logs em **Logs** > **Auth Logs** no Dashboard

### Link não funciona
1. Verifique se a "Site URL" está correta
2. Confirme que `/seller/reset-password` existe nas rotas
3. Verifique se o token não expirou (1 hora)

### Template não aparece formatado
1. Certifique-se de colar TODO o HTML (incluindo `<!DOCTYPE html>`)
2. Não modifique as variáveis `{{ .ConfirmationURL }}`
3. Salve e teste novamente

---

## 📝 Próximos Passos

Após configurar o template:
1. ✅ Teste com um e-mail real
2. ✅ Verifique se o link redireciona para `/seller/reset-password`
3. ✅ Confirme que a página de reset aceita o token
4. ✅ Configure SMTP customizado para produção (evitar rate limits)

---

**Criado em**: 2026-01-22  
**Última atualização**: 2026-01-22  
**Versão**: 1.0
