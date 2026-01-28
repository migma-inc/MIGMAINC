# Status da Segurança de Storage - 28/01/2026

## Configuração Atual

### Buckets
Todos os buckets estão configurados como **PÚBLICOS** (`public: true`):
- `visa-documents`
- `visa-signatures`
- `contracts`
- `identity-photos`
- `partner-signatures`
- `zelle_comprovantes`
- `cv-files`

**Motivo**: Buckets privados estavam causando erro "Bucket not found" nas Signed URLs.

### Políticas RLS Ativas

As seguintes políticas RLS estão ativas e funcionando:

#### SELECT (Leitura)
- **Admins and Sellers can read [bucket]** - Apenas usuários autenticados que sejam Admins ou Sellers podem ler

#### INSERT (Upload)
- **Allow anonymous uploads** - Uploads anônimos permitidos (necessário para checkout)
- **Allow authenticated uploads** - Uploads autenticados permitidos

#### UPDATE/DELETE
- **Only admins can update/delete** - Apenas Admins podem modificar/deletar

#### Service Role
- **Service role full access** - Service role tem acesso total (para Edge Functions)

### Funções Auxiliares

Criadas e funcionando:
- `is_admin()` - Verifica se usuário é admin via `raw_user_meta_data->>'role'`
- `is_seller()` - Verifica se usuário existe na tabela `sellers` com status `active`
- `is_admin_or_seller()` - Combina ambas verificações

### Frontend

Componentes atualizados para usar `getSecureUrl()`:
- `ImageModal.tsx`
- `PdfModal.tsx`
- `VisaOrderDetailPage.tsx`
- `ZelleApprovalPage.tsx`
- `SellerZelleApprovalPage.tsx`

A função `getSecureUrl()` está preparada para gerar Signed URLs, mas como os buckets estão públicos, ela retorna a URL pública mesmo.

## Próximos Passos (Futuro)

Para melhorar a segurança:
1. Investigar por que Signed URLs não funcionam com buckets privados
2. Considerar proxy customizado para servir arquivos
3. Implementar rotação de URLs temporárias
4. Adicionar auditoria de acesso a arquivos sensíveis

## Notas Importantes

- ⚠️ Arquivos antigos continuam acessíveis via URL direta
- ✅ RLS protege contra modificações não autorizadas
- ✅ Novos uploads são organizados por `clientId`
- ✅ Edge Functions funcionam normalmente
