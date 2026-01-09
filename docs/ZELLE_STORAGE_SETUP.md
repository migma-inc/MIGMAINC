# Setup do Bucket zelle_comprovantes

## ⚠️ IMPORTANTE: Criar o Bucket Primeiro

O bucket `zelle_comprovantes` **DEVE** ser criado manualmente no Supabase Dashboard antes de usar a funcionalidade. Se o bucket não existir, o sistema usará o bucket `visa-documents` como fallback, mas é recomendado criar o bucket específico.

## Criação do Bucket

### Passo 1: Criar o Bucket

1. Acesse o **Supabase Dashboard**
2. Vá em **Storage** > **Buckets**
3. Clique em **New bucket**
4. Configure:
   - **Name:** `zelle_comprovantes` (exatamente este nome)
   - **Public bucket:** ✅ **Sim** (IMPORTANTE: deve ser público para n8n acessar)
   - **File size limit:** 10 MB (ou conforme necessário)
   - **Allowed MIME types:** `image/*,application/pdf` (ou deixe vazio para permitir todos)

5. Clique em **Create bucket**

### Passo 2: Configurar Políticas RLS

Após criar o bucket, configure as políticas de acesso no **SQL Editor** do Supabase:

**Execute este SQL no SQL Editor do Supabase:**

```sql
-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Allow public uploads to zelle_comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to zelle_comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to zelle_comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage zelle_comprovantes" ON storage.objects;

-- Policy 1: Allow anonymous uploads for checkout flow
-- Only allows uploads to zelle-payments/ folder
CREATE POLICY "Allow public uploads to zelle_comprovantes"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'zelle_comprovantes' AND
  (storage.foldername(name))[1] = 'zelle-payments'
);

-- Policy 2: Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads to zelle_comprovantes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'zelle_comprovantes' AND
  (storage.foldername(name))[1] = 'zelle-payments'
);

-- Policy 3: Allow public read access (for n8n to access images)
CREATE POLICY "Allow public read access to zelle_comprovantes"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'zelle_comprovantes');

-- Policy 4: Allow service role full access
CREATE POLICY "Service role can manage zelle_comprovantes"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'zelle_comprovantes')
WITH CHECK (bucket_id = 'zelle_comprovantes');
```

**Como executar:**
1. No Supabase Dashboard, vá em **SQL Editor**
2. Cole o SQL acima
3. Clique em **Run** ou pressione `Ctrl+Enter`
4. Verifique se todas as políticas foram criadas sem erros

### Estrutura de Paths

Os arquivos serão armazenados com a seguinte estrutura:

```
zelle_comprovantes/
└── zelle-payments/
    └── {user_id}/
        └── zelle-payment-{timestamp}.{ext}
```

Exemplo:
```
zelle_comprovantes/zelle-payments/550e8400-e29b-41d4-a716-446655440000/zelle-payment-1705320000000.jpg
```

### Notas

- O bucket deve ser público para que o n8n possa acessar as URLs das imagens
- As políticas RLS garantem que apenas arquivos na pasta `zelle-payments/` possam ser enviados
- URLs públicas são geradas automaticamente pelo Supabase Storage

## ⚠️ IMPORTANTE

O bucket `zelle_comprovantes` **DEVE** ser criado antes de usar a funcionalidade. O sistema não possui fallback e falhará se o bucket não existir ou as políticas RLS não estiverem configuradas.

## Verificação

Para verificar se o bucket foi criado corretamente:

1. Vá em **Storage** > **Buckets**
2. Verifique se `zelle_comprovantes` aparece na lista
3. Clique no bucket e verifique se está marcado como **Public**
4. Teste fazendo upload de um arquivo de teste

## Troubleshooting

### Erro: "new row violates row-level security policy"

**Causa:** Bucket não existe ou políticas RLS não estão configuradas

**Solução:**
1. Verifique se o bucket `zelle_comprovantes` foi criado
2. Execute o SQL das políticas RLS no SQL Editor
3. Verifique se o bucket está marcado como **Public**

### Erro: "Bucket not found"

**Causa:** Bucket não foi criado

**Solução:**
1. Crie o bucket seguindo o Passo 1 acima
2. Configure as políticas RLS seguindo o Passo 2
3. Recarregue a página e tente novamente
