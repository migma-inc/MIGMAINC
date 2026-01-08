# 🔧 Correção Rápida: Erro "row-level security policy" no Upload Zelle

## Erro Encontrado

```
Error: Failed to upload receipt: new row violates row-level security policy
POST .../storage/v1/object/zelle_comprovantes/... 400 (Bad Request)
```

## Causa

O bucket `zelle_comprovantes` não existe ou as políticas RLS não estão configuradas.

## Solução

### Opção 1: Criar o Bucket (Recomendado)

**Passo 1: Criar o Bucket**
1. Acesse **Supabase Dashboard** → **Storage** → **Buckets**
2. Clique em **New bucket**
3. Configure:
   - **Name:** `zelle_comprovantes`
   - **Public bucket:** ✅ **Sim** (IMPORTANTE!)
   - **File size limit:** 10 MB
4. Clique em **Create bucket**

**Passo 2: Configurar Políticas RLS**
1. Vá em **SQL Editor** no Supabase Dashboard
2. Execute este SQL:

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public uploads to zelle_comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to zelle_comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to zelle_comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage zelle_comprovantes" ON storage.objects;

-- Create policies
CREATE POLICY "Allow public uploads to zelle_comprovantes"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'zelle_comprovantes' AND
  (storage.foldername(name))[1] = 'zelle-payments'
);

CREATE POLICY "Allow authenticated uploads to zelle_comprovantes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'zelle_comprovantes' AND
  (storage.foldername(name))[1] = 'zelle-payments'
);

CREATE POLICY "Allow public read access to zelle_comprovantes"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'zelle_comprovantes');

CREATE POLICY "Service role can manage zelle_comprovantes"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'zelle_comprovantes')
WITH CHECK (bucket_id = 'zelle_comprovantes');
```

3. Clique em **Run**

**Passo 3: Testar**
- Recarregue a página do checkout
- Tente fazer upload do comprovante Zelle novamente

### ⚠️ Sem Fallback

O sistema **NÃO** possui fallback. O bucket `zelle_comprovantes` **DEVE** ser criado e configurado corretamente para que a funcionalidade funcione.

## Verificação

Para verificar se está funcionando:

1. Abra o console do navegador (F12)
2. Tente fazer upload de um comprovante
3. Verifique os logs:
   - Se não houver erro → Bucket foi criado corretamente
   - Se ver erro de RLS → Execute o SQL das políticas novamente
   - Se ver "Bucket not found" → Crie o bucket no Dashboard

## Documentação Completa

Para mais detalhes, consulte: `docs/ZELLE_STORAGE_SETUP.md`
