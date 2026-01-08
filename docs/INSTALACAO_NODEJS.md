# Como Instalar Node.js no Windows

## Problema
Se você recebeu o erro:
```
npm : O termo 'npm' não é reconhecido como nome de cmdlet...
```

Isso significa que o Node.js não está instalado ou não está no PATH do sistema.

## Solução: Instalar Node.js

### Opção 1: Instalador Oficial (Recomendado)

1. **Baixe o Node.js:**
   - Acesse: https://nodejs.org/
   - Baixe a versão **LTS** (Long Term Support) - recomendada
   - Escolha o instalador para Windows (`.msi`)

2. **Execute o instalador:**
   - Execute o arquivo `.msi` baixado
   - Siga o assistente de instalação
   - **IMPORTANTE:** Marque a opção "Add to PATH" durante a instalação

3. **Verifique a instalação:**
   - Feche e reabra o PowerShell/Terminal
   - Execute:
     ```powershell
     node --version
     npm --version
     ```
   - Deve mostrar as versões instaladas

### Opção 2: Via Chocolatey (Se já tiver instalado)

Se você já tem o Chocolatey instalado:
```powershell
choco install nodejs-lts
```

### Opção 3: Via Winget (Windows 10/11)

```powershell
winget install OpenJS.NodeJS.LTS
```

## Após Instalar

1. **Feche e reabra o PowerShell/Terminal**
2. **Verifique se funcionou:**
   ```powershell
   node --version
   npm --version
   ```

3. **Navegue até a pasta do projeto:**
   ```powershell
   cd C:\Users\Henrique-PC\Downloads\Repositorio\migma-lp
   ```

4. **Instale as dependências:**
   ```powershell
   npm install
   ```

## Configurar Variáveis de Ambiente

**IMPORTANTE:** As variáveis de ambiente NÃO são instaladas via npm. Elas são configuradas em um arquivo `.env`.

1. **Crie o arquivo `.env` na raiz do projeto:**
   - Copie o arquivo `.env.example` para `.env`
   - Ou crie manualmente um arquivo chamado `.env`

2. **Adicione as variáveis necessárias:**
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
   VITE_N8N_WEBHOOK_URL=https://nwh.suaiden.com/webhook/zelle-migma
   ```

3. **Substitua pelos valores reais:**
   - `VITE_SUPABASE_URL`: URL do seu projeto Supabase
   - `VITE_SUPABASE_ANON_KEY`: Chave anônima do Supabase (encontre no Dashboard)
   - `VITE_N8N_WEBHOOK_URL`: URL do webhook n8n (já configurada)

## Próximos Passos

Após instalar o Node.js e configurar o `.env`:

1. Instale as dependências: `npm install`
2. Inicie o servidor de desenvolvimento: `npm run dev`
3. O projeto estará rodando em `http://localhost:5173` (ou porta similar)

## Notas

- O arquivo `.env` está no `.gitignore` e não será commitado (por segurança)
- Nunca compartilhe suas chaves do Supabase ou outras credenciais
- Se precisar trabalhar em outro computador, crie um novo arquivo `.env` lá
