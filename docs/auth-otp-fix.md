# Fix: Falha de Autenticação OTP — Portal do Aluno

**Data:** 15 de Abril de 2026
**Branch:** `tracking-paulo`
**Arquivo alterado:** `src/contexts/StudentAuthContext.tsx`

---

## Problema

O login via OTP na página `/student/login` retornava `Token has expired or is invalid` (HTTP 403) em ~275ms — rejeição instantânea pelo Supabase, mesmo com código recém-recebido por e-mail.

---

## Diagnóstico

### 1. Tipo de token incompatível (causa raiz)

Contas de alunos são criadas no Checkout com `signUp()` + senha auto-gerada. Quando um usuário com senha chama `signInWithOtp`, o Supabase internamente dispara o fluxo de **recuperação de senha** — o evento registrado nos logs do servidor é `user_recovery_requested`, não `otp_sent`.

O token gerado é do tipo `recovery`. Porém o código chamava `verifyOtp` com `type: 'email'`, que é o tipo correto apenas para contas criadas sem senha (pure OTP/magic link). A divergência de tipo causa rejeição instantânea no servidor.

```
signInWithOtp(email)       → Supabase gera token tipo: 'recovery'
verifyOtp(type: 'email')   → Supabase rejeita: tipo não bate → 403
```

### 2. Configuração do Dashboard (bloqueio secundário)

O Supabase bloqueia requests originados de origens não autorizadas. Em testes locais, o `localhost` precisava estar na lista de Redirect URLs do projeto. Sem isso, o PKCE flow falha antes mesmo do verify.

### 3. Requisições duplicadas (resolvido anteriormente)

Os logs mostravam múltiplas tentativas de verificação no mesmo milissegundo, "queimando" o token antes que a resposta chegasse ao cliente. Isso foi corrigido com um lock `isVerifying` no `StudentAuthContext`, impedindo chamadas concorrentes ao `verifyOtp`.

---

## Causa Raiz #2 — OTP length mismatch (causa confirmada)

O Supabase estava configurado com **Email OTP length = 8**, mas o formulário aceitava apenas **6 dígitos** (`maxLength={6}`). O usuário digitava o código truncado → token sempre inválido.

---

## Solução Aplicada

### Código — `src/pages/StudentLogin.tsx`

**Antes:**
```tsx
maxLength={6}
placeholder="000000"
if (!otp || otp.length < 6 || loading) return;
disabled={loading || otp.length < 6}
```

**Depois:**
```tsx
maxLength={8}
placeholder="00000000"
if (!otp || otp.length < 8 || loading) return;
disabled={loading || otp.length < 8}
```

### Código — `src/contexts/StudentAuthContext.tsx`

**Antes:**
```ts
const { data, error } = await supabase.auth.verifyOtp({
  email,
  token,
  type: 'email',
});
```

**Depois:**
```ts
// Contas criadas via Checkout possuem senha auto-gerada.
// O Supabase trata signInWithOtp para esses usuários como fluxo de
// "recovery" (não "email"), então o token só é válido com type: 'recovery'.
const { data, error } = await supabase.auth.verifyOtp({
  email,
  token,
  type: 'recovery',
});
```

### Dashboard Supabase (configuração manual obrigatória)

1. **Authentication → URL Configuration → Redirect URLs** — adicionar:
   - `http://localhost:5173/**`
   - `http://localhost:5173`
   - URL de produção correspondente se ainda não estiver cadastrada

2. **Authentication → Providers → Email** — confirmar que **"Enable Email OTP"** está ativado. Se desativado, o Supabase envia magic link (`type: 'magiclink'`) mesmo sem `emailRedirectTo` definido.

---

## Por que `type: 'recovery'` e não `type: 'email'`?

| Tipo de conta | `signInWithOtp` dispara | `verifyOtp` deve usar |
|---|---|---|
| Criada sem senha (magic link puro) | OTP de login | `'email'` |
| Criada com senha (Checkout) | Token de recovery | `'recovery'` |

Todos os alunos da Migma passam pelo Checkout, que usa `signUp()` com senha. Logo, **100% dos usuários do portal** precisam de `type: 'recovery'`.

---

## Arquivos relacionados

| Arquivo | Papel |
|---|---|
| `src/contexts/StudentAuthContext.tsx` | Lógica de OTP (alterado) |
| `src/pages/StudentLogin.tsx` | UI do login, chama `signInOtp` e `verifyOtp` |
| `src/pages/MigmaCheckout/index.tsx` | Cria usuários com `signUp` + senha |

---

## Observações futuras

- Se no futuro houver alunos criados sem senha (fluxo diferente do Checkout), o `type: 'recovery'` vai falhar para eles. Nesse caso, implementar tentativa dupla: tenta `recovery`, se falhar, tenta `email`.
- O lock `isVerifying` em `StudentAuthContext:140` deve ser mantido — sem ele, rerenders rápidos do React podem disparar o verify múltiplas vezes.
