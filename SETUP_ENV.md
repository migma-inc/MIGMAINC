# Configuração Rápida de Variáveis de Ambiente

## Passo 1: Instalar Node.js (se necessário)

Se você recebeu o erro "npm não é reconhecido", precisa instalar o Node.js primeiro:

1. Baixe em: https://nodejs.org/ (versão LTS)
2. Instale e marque "Add to PATH"
3. Feche e reabra o PowerShell
4. Verifique: `node --version` e `npm --version`

**Guia completo:** Veja `docs/INSTALACAO_NODEJS.md`

## Passo 2: Criar arquivo .env

1. **Na raiz do projeto**, crie um arquivo chamado `.env` (sem extensão)

2. **Adicione estas linhas:**

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui

# n8n Webhook URL for Zelle Validation
VITE_N8N_WEBHOOK_URL=https://nwh.suaiden.com/webhook/zelle-migma
```

3. **Substitua pelos valores reais:**
   - `VITE_SUPABASE_URL`: Encontre no Supabase Dashboard → Settings → API
   - `VITE_SUPABASE_ANON_KEY`: Encontre no Supabase Dashboard → Settings → API (chave "anon public")
   - `VITE_N8N_WEBHOOK_URL`: Já está configurada (não precisa alterar)

## Passo 3: Instalar dependências

Após criar o `.env`, execute:

```powershell
npm install
```

## Passo 4: Iniciar o projeto

```powershell
npm run dev
```

## Localização do arquivo .env

O arquivo `.env` deve estar na **raiz do projeto**, no mesmo nível que `package.json`:

```
migma-lp/
├── .env          ← CRIE AQUI
├── package.json
├── src/
├── supabase/
└── ...
```

## Importante

- O arquivo `.env` não será commitado (está no .gitignore)
- Nunca compartilhe suas chaves
- Se trabalhar em outro computador, crie um novo `.env` lá
