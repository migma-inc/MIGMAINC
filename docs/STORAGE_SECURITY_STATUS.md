# Status da Segurança de Storage - 28/01/2026 (Atualizado)

## Arquitetura Implementada

Implementamos uma solução de "Gatekeeper" que elimina a exposição de URLs públicas de documentos sensíveis.

### 1. Buckets PRIVADOS
Os seguintes buckets foram alterados de `public: true` para **`public: false`**:
- `cv-files`
- `identity-photos`
- `contracts`
- `visa-documents`
- `partner-signatures`
- `visa-signatures`

**Exceções (Mantidos Públicos):**
- `zelle_comprovantes`: Necessário para integração com n8n (o n8n recebe a URL direta).
- `logo`: Ativos públicos do site.

### 2. Fluxo de Visualização (Frontend - Blobs)
Em vez de Signed URLs (que expiram e podem ser vazadas), agora usamos **Blobs Locais**:
1. O componente (`ImageModal`, `PdfModal`) chama `getSecureUrl()`.
2. A função `getSecureUrl` usa o SDK do Supabase para fazer o `download()` do arquivo "por dentro" da sessão autenticada do usuário.
3. O arquivo é convertido em um `Blob URL` (`blob:http://...`).
4. **Segurança**: Essa URL só funciona no navegador do usuário logado e morre quando a aba é fechada. Se copiada para outro lugar, ela não funciona.

### 3. Edge Function Proxy (`document-proxy`)
Criamos uma função centralizada para servir arquivos via servidor:
- **URL**: `${SUPABASE_URL}/functions/v1/document-proxy?bucket=...&path=...`
- **Uso**: Links em e-mails ou sistemas externos que suportem headers de autorização.
- **Validação**: A função verifica se o usuário é **Admin** ou um **Seller** vinculado ao pedido antes de entregar o arquivo.

### 4. Geração de PDFs (Service Role)
As funções de geração de PDF (`generate-visa-contract-pdf`, `generate-annex-pdf`, `generate-invoice-pdf`) foram atualizadas:
- Pararam de usar `fetch()` de URLs públicas.
- Agora usam `download()` direto do storage via `service_role`.
- Isso garante que os PDFs continuem sendo gerados corretamente mesmo com os buckets privados.

## RLS (Row Level Security)

As políticas no Storage garantem:
- **SELECT**: Apenas usuários autenticados (Admins e Sellers) podem baixar.
- **INSERT**: Usuários anônimos podem fazer upload (necessário no checkout), mas não podem ler o que enviaram (prevenindo que um atacante veja documentos de outros).
- **UPDATE/DELETE**: Restrito a Administradores.

## Como usar no código

Sempre use a função `getSecureUrl(path)` ao exibir qualquer arquivo:
```typescript
const url = await getSecureUrl("visa-documents/meu-arquivo.jpg");
// retorna um blob: URL seguro se o usuário tiver permissão.
```

## Próximos Passos
1. Refinar a política RLS de `SELECT` para Sellers para restringir apenas aos IDs de clientes que eles possuem (atualmente podem ver todos os buckets privados).
2. Monitorar logs do `document-proxy` para tentativas de acesso negado.
