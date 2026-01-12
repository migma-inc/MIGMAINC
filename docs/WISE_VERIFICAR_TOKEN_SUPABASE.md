# ✅ Verificar Token no Supabase - Guia Rápido

**Data**: 2026-01-12

---

## 🔍 PROBLEMA IDENTIFICADO

Você mencionou que salvou: `api = wise 727f104a-72b3-498c-ad40-2dc705df95d2`

**⚠️ PROBLEMA**: O token pode ter sido salvo com o texto `api = wise` antes dele!

O token correto deve ser **APENAS**: `727f104a-72b3-498c-ad40-2dc705df95d2`

---

## ✅ SOLUÇÃO RÁPIDA

### Passo 1: Editar no Supabase Dashboard

1. Acesse: Supabase Dashboard > **Project Settings** > **Edge Functions** > **Secrets**
2. Encontre `WISE_PERSONAL_TOKEN`
3. Clique em **"Edit"** ou **"Update"**

### Passo 2: Verificar o Conteúdo Atual

Verifique se o campo contém:
- ❌ `api = wise 727f104a-72b3-498c-ad40-2dc705df95d2` (ERRADO - tem texto extra)
- ✅ `727f104a-72b3-498c-ad40-2dc705df95d2` (CORRETO - só o token)

### Passo 3: Corrigir

1. **Selecione TODO o conteúdo** (Ctrl+A)
2. **Delete tudo**
3. **Cole APENAS o token**: `727f104a-72b3-498c-ad40-2dc705df95d2`
4. **Verifique que não há**:
   - Texto antes do token (`api = wise`)
   - Espaços antes ou depois
   - Quebras de linha
5. Clique em **"Save"**

---

## 📋 VERIFICAÇÃO FINAL

O campo `WISE_PERSONAL_TOKEN` deve conter **EXATAMENTE**:

```
727f104a-72b3-498c-ad40-2dc705df95d2
```

**NÃO deve ter**:
- ❌ `api = wise` antes
- ❌ Espaços antes ou depois
- ❌ Quebras de linha
- ❌ Aspas ou outros caracteres

---

## 🧪 TESTAR

Após corrigir:

1. Tente criar um checkout Wise novamente
2. Verifique os logs no Supabase Dashboard
3. Deve aparecer: `✅ Profile ID fetched from API: [número]`

---

## 🔍 COMO VERIFICAR SE ESTÁ CORRETO

### No Supabase Dashboard:

1. Vá em: **Project Settings** > **Edge Functions** > **Secrets**
2. Encontre `WISE_PERSONAL_TOKEN`
3. Clique para ver/editar
4. O valor deve ser **exatamente**: `727f104a-72b3-498c-ad40-2dc705df95d2`
5. **Sem nenhum texto antes ou depois**

---

## ⚠️ IMPORTANTE

O token que você mencionou (`727f104a-72b3-498c-ad40-2dc705df95d2`) parece estar correto em formato, mas:

1. **Certifique-se de que foi salvo SEM o texto "api = wise"**
2. **Certifique-se de que não há espaços extras**
3. **Certifique-se de que está no campo correto** (`WISE_PERSONAL_TOKEN`)

---

**Última atualização**: 2026-01-12
