-- Script para migrar URLs antigas de storage e invalidar acesso público
-- Este script atualiza as URLs no banco para usar apenas o path (sem /public/)
-- O getSecureUrl() no frontend vai gerar Signed URLs automaticamente

-- 1. Atualizar identity_files
UPDATE identity_files
SET file_path = REPLACE(file_path, '/storage/v1/object/public/', '')
WHERE file_path LIKE '%/storage/v1/object/public/%';

-- 2. Atualizar visa_orders - zelle_proof_url
UPDATE visa_orders
SET zelle_proof_url = REPLACE(zelle_proof_url, '/storage/v1/object/public/', '')
WHERE zelle_proof_url LIKE '%/storage/v1/object/public/%';

-- 3. Atualizar visa_orders - contract_pdf_url
UPDATE visa_orders
SET contract_pdf_url = REPLACE(contract_pdf_url, '/storage/v1/object/public/', '')
WHERE contract_pdf_url LIKE '%/storage/v1/object/public/%';

-- 4. Atualizar visa_orders - signature_image_url
UPDATE visa_orders
SET signature_image_url = REPLACE(signature_image_url, '/storage/v1/object/public/', '')
WHERE signature_image_url LIKE '%/storage/v1/object/public/%';

-- 5. Atualizar migma_payments - image_url
UPDATE migma_payments
SET image_url = REPLACE(image_url, '/storage/v1/object/public/', '')
WHERE image_url LIKE '%/storage/v1/object/public/%';

-- 6. Verificar resultados
SELECT 
    'identity_files' as tabela,
    COUNT(*) as total,
    COUNT(CASE WHEN file_path LIKE '%/public/%' THEN 1 END) as ainda_publicas
FROM identity_files
UNION ALL
SELECT 
    'visa_orders (zelle)',
    COUNT(*),
    COUNT(CASE WHEN zelle_proof_url LIKE '%/public/%' THEN 1 END)
FROM visa_orders
UNION ALL
SELECT 
    'visa_orders (contract)',
    COUNT(*),
    COUNT(CASE WHEN contract_pdf_url LIKE '%/public/%' THEN 1 END)
FROM visa_orders
UNION ALL
SELECT 
    'visa_orders (signature)',
    COUNT(*),
    COUNT(CASE WHEN signature_image_url LIKE '%/public/%' THEN 1 END)
FROM visa_orders
UNION ALL
SELECT 
    'migma_payments',
    COUNT(*),
    COUNT(CASE WHEN image_url LIKE '%/public/%' THEN 1 END)
FROM migma_payments;
