# Configuração de Variáveis de Ambiente - Integração Zelle n8n

## Variável Necessária

Adicione a seguinte variável ao seu arquivo `.env`:

```env
VITE_N8N_WEBHOOK_URL=https://nwh.suaiden.com/webhook/zelle-migma
```

## Como Configurar

### Desenvolvimento Local

1. Crie ou edite o arquivo `.env` na raiz do projeto
2. Adicione a linha acima
3. Reinicie o servidor de desenvolvimento (`npm run dev`)

### Produção

Configure a variável de ambiente na plataforma de deploy:

- **Vercel**: Settings → Environment Variables
- **Netlify**: Site settings → Environment variables
- **Outros**: Configure conforme a plataforma

## Validação

A variável será validada automaticamente no código. Se não estiver configurada, o sistema usará revisão manual como fallback.

## Notas

- A URL do webhook n8n deve ser acessível publicamente
- O n8n deve estar configurado para receber requisições POST neste endpoint
- Em caso de erro de rede ou timeout, o sistema automaticamente trata como `pending_verification`
