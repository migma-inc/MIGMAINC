# Guia mestre: Engenharia de Segurança de Arquivos e RLS (Supabase + React)

Este documento é um registro técnico completo de como construímos a infraestrutura de privacidade de dados na Migma Inc. Ele detalha desde as políticas de banco de dados até a criação de um Proxy de alta performance via Edge Functions.

---

## 1. O Problema Fundamental
Navegadores não enviam cabeçalhos de autenticação (`Authorization: Bearer ...`) ao carregar tags `<img src="...">` ou `<iframe src="...">`. Isso significa que se você proteger um arquivo no Supabase Storage com RLS, o navegador não conseguirá exibi-lo diretamente, resultando em erros `403 Forbidden`.

### Nossa Estratégia de Defesa em Camadas:
1.  **Proteção Total (Buckets Privados)**: Bloqueio de acesso anônimo no Storage.
2.  **Row Level Security (RLS)**: Controle de quem pode ver o quê no nível do SQL.
3.  **Client-Side Resolution (getSecureUrl)**: Orquestração inteligente de URLs de Blob e Signed URLs.
4.  **Document Proxy (Edge Function)**: Um túnel seguro para visualização externa sem expor sessões do usuário.

---

## 2. Row Level Security (RLS) - Controle Granular

A tabela central é a `storage.objects`. Aqui é onde definimos quem tem a chave.

### Macete: Verificação de Papel (Admin/Seller)
No Supabase, o `auth.uid()` é apenas o ID. Mas para saber se é um **Admin**, precisamos olhar no JSON da sessão:

```sql
-- Política para Administradores (Acesso Total ao Bucket de Currículos)
CREATE POLICY "Admins can read all cv-files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cv-files' 
  AND (
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  )
);
```

**Dica de Manutenção**: Sempre use `maybeSingle()` ou `maybeSingle()` ao verificar papéis para evitar que erros de "não encontrado" quebrem a lógica do frontend.

---

## 3. O Document Proxy (A "Bala de Prata")

Quando o frontend não consegue carregar o arquivo (ex: um link enviado por email ou um iFrame teimoso), entra em cena a **Edge Function `document-proxy`**.

### Como o Proxy Funciona:
1.  **Recebe**: `bucket`, `path` e opcionalmente um `token`.
2.  **Valida**:
    *   **Via Token**: Checa tabelas como `visa_contract_view_tokens` para ver se existe um link temporário legítimo.
    *   **Via Sessão**: Se o usuário estiver logado, a função valida o JWT e checa se ele é Admin ou se é o Seller dono daquele pedido.
3.  **Executa**: Usa a `service_role_key` (que ignora RLS) para baixe o arquivo internamente no servidor do Supabase.
4.  **Entrega**: Stream do arquivo de volta para o navegador com o `Content-Type` correto e headers de CORS.

### Por que usar Proxy?
- Permite visualizar documentos privados sem transformar o bucket em público.
- Gerencia expiração de links de forma dinâmica (fora do Storage).
- Centraliza os logs de quem visualizou cada documento sensível.

---

## 4. Resolvendo o Caminho: `getSecureUrl`

No frontend, criamos uma função que "adivinha" e resolve o acesso. Ela é a ponte entre o banco de dados e a tela.

### Fluxo de Decisão (Hierarchy of Trust):
1.  **Data Cleanup**: Remove espaços invisíveis (`.trim()`) e trata extensões `.PDF` vs `.pdf`.
2.  **Blob Strategy**: A função faz um `supabase.storage.from(b).download(p)`. Se funcionar (porque o usuário tem RLS), ela converte para `URL.createObjectURL(blob)`. **Isto é instantâneo e não custa banda extra de Edge Functions.**
3.  **Signed URL Fallback**: Se o download falhar, ela tenta gerar uma URL assinada (`createSignedUrl`).
4.  **Proxy Fallback**: Como última instância, ela retorna a URL da nossa Edge Function.

---

## 5. Visualização de PDFs e Imagens

### O Macete do iFrame
Iframes são notáveis por falhar em sites seguros. Para garantir que o PDF apareça:
- Converta o arquivo em um **Blob URL** local.
- Garanta que o Modal tenha um `z-index` altíssimo e `background: black/80` para evitar "vazamento" de elementos de fundo.

### O Problema do Download
Botões de download dentro de iframes costumam ser bloqueados por segurança ("Sandboxing").
**Solução**: Implementamos um botão de download fora do iframe, no cabeçalho do modal. Esse botão faz um `fetch` da URL (mesmo sendo blob) e dispara um clique em um `<a>` invisível com o atributo `download`.

---

## 6. Checklist de Replicação Completa

Se você for replicar isto hoje:
1.  **Storage**: Crie os buckets como "Private".
2.  **PostgreSQL**: Rode as políticas de RLS de SELECT para Admins e Authenticated (conforme os metadados do JWT).
3.  **Edge Function**: Implemente a função de Proxy que aceite tanto JWT quanto `viewToken`.
4.  **Frontend Utilities**: Copie a pasta `lib/storage.ts` com a função `getSecureUrl`.
5.  **Modal Sync**: Garanta que seus componentes de lista e de detalhes usem a mesma lógica de modal para evitar que "funcione em um e falhe no outro".

---
*Este sistema foi refinado após múltiplas rodadas de depuração de permissões de acesso, garantindo proteção total aos dados dos clientes da Migma Inc.*
