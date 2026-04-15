# 🛡️ Diagnóstico Técnico: Falha de Autenticação OTP

**Data:** 15 de Abril de 2026
**Status:** Bloqueio de Segurança no Supabase (403 Forbidden)
**Ambiente:** Localhost enviando para Projeto `ekxftwrjvxtpnqbraszv`

---

## 1. O Erro Principal
O frontend recebe um erro `403` imediatamente após o envio do código de 6 dígitos.
- **Mensagem:** `Token has expired or is invalid`
- **Tempo de Resposta:** ~275ms (rejeição instantânea pelo servidor)

## 2. Análise dos Logs Internos (Supabase Auth)
Ao analisar os logs brutos do servidor, identificamos os seguintes eventos correlacionados:

| Timestamp | Evento | Detalhe | Status |
| :--- | :--- | :--- | :--- |
| `19:10:50Z` | `POST /otp` | `user_recovery_requested` | 200 OK |
| `19:10:56Z` | `POST /verify` | `error_code: otp_expired` | 403 Forbidden |

### Descobertas Críticas:
1. **Conflito de Tipo:** Embora usemos o fluxo de Login, o Supabase dispara um evento de `user_recovery`. Isso ocorre porque as contas criadas no Checkout possuem uma senha gerada automaticamente, forçando o Supabase a tratar o OTP como "Recuperação".
2. **Duplicidade de Requisição:** Os logs mostram múltiplas tentativas de verificação no mesmo milissegundo. Isso "queima" o token instantaneamente.
3. **Divergência de Referer:** O referer registrado nos logs é `migmainc.com/`, mesmo quando o teste é feito em `localhost`.

---

## 3. Outras Falhas Detectadas (Workflow de Checkout)
Identificamos erros de timeout durante o processo de registro de novos alunos:

- **Edge Functions:** Chamadas para `migma-create-student` e `migma-save-documents` excederam o limite de 30 segundos (`EXCEDEU 30s! Abortando...`).
- **Consequência:** O aluno é criado no Auth, mas o perfil no banco de dados (`user_profiles`) ou os documentos podem não ser salvos corretamente por causa do timeout.

---

## 4. Plano de Ação Recomendado

### Passo A: Configuração no Dashboard (Supabase)
É altamente provável que o Supabase esteja bloqueando o `localhost` por segurança.
1. Vá em **Authentication > Settings > Redirect URLs**.
2. Adicione `http://localhost:5173/**` (ou a porta que você estiver usando).
3. Verifique se a opção **"Confirm Email"** em `Providers > Email` está exigindo clique em link (isso invalida logins por código puro se não clicado).

### Passo B: Mudanças no Código (Já Aplicadas)
1. **Trava de Concorrência:** Adicionado `isVerifying` no `StudentAuthContext` para impedir o envio triplo do código.
2. **Tipo Curinga:** Alterado de `magiclink/recovery` para `email` no `verifyOtp` para aumentar a compatibilidade.
3. **Limpeza de Form:** O campo de OTP é resetado em caso de erro para evitar reenvio de lixo.

---

> [!IMPORTANT]
> Se após configurar as URLs de Redirecionamento no Dashboard o erro persistir, o problema é uma restrição de política do Supabase para contas que possuem senha fixa, impedindo o login por OTP sem que o usuário converta a conta.
