# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

---

## 📧 Sistema de Envio de Emails

Este projeto utiliza **SMTP Google direto** via Supabase Edge Functions para envio de emails.

### Status
✅ **Funcionando em Produção** - Emails sendo enviados corretamente, sem cair em spam.

### Variáveis de Ambiente

Para que os links nos emails funcionem corretamente em produção, configure:

```env
VITE_APP_URL=https://seu-dominio.com
```

**Como funciona:**
- **Desenvolvimento local**: A URL é detectada automaticamente via `window.location.origin` (localhost)
- **Produção** (Vercel, Netlify, etc.): Configure `VITE_APP_URL` com a URL do seu domínio
- **Fallback**: Se não configurado, usa `https://migma.com`

**Exemplos:**
- Vercel: `VITE_APP_URL=https://migma.vercel.app`
- Domínio customizado: `VITE_APP_URL=https://migma.com`

### Documentação Completa
Para configuração detalhada, consulte: **[SMTP_SETUP.md](./SMTP_SETUP.md)**

### Resumo Rápido

1. **Configurar Supabase Secrets:**
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_USER=seu-email@gmail.com`
   - `SMTP_PASS=senha-de-app-16-caracteres`
   - `SMTP_FROM_EMAIL=seu-email@gmail.com`
   - `SMTP_FROM_NAME=MIGMA`

2. **Obter Google App Password:**
   - Ativar verificação em duas etapas
   - Gerar senha de app em: https://myaccount.google.com/apppasswords

3. **Testar:**
   ```javascript
   import { testEmailSending } from './src/lib/emails.ts';
   await testEmailSending('seu-email@gmail.com');
   ```

### Arquitetura
- **Frontend**: `src/lib/emails.ts` - Cliente de email
- **Backend**: `supabase/functions/send-email/index.ts` - Edge Function SMTP
- **Protocolo**: SMTP direto via sockets TLS do Deno

Para mais detalhes técnicos, implementação e troubleshooting, veja [SMTP_SETUP.md](./SMTP_SETUP.md).
