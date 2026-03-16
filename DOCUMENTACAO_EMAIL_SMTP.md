# 📧 Fluxo de Envio de E-mails - Migma Global Partner

Esta documentação descreve o funcionamento técnico do sistema de notificações por e-mail no projeto Migma Global Partner, focado no processo de envio automático quando um novo parceiro completa sua aplicação.

---

## 🎯 Visão Geral do Processo

Quando um usuário finaliza o preenchimento das informações no formulário de **Global Partner** e clica em "Enviar", o sistema realiza duas ações principais de comunicação:

1.  **E-mail para o Candidato**: Uma confirmação de recebimento é enviada para o e-mail informado no formulário.
2.  **E-mail para os Administradores**: Todos os administradores cadastrados no sistema recebem um alerta notificando que uma nova aplicação foi recebida, incluindo detalhes básicos e o link para visualização.

---

## 🏗️ Arquitetura Técnica

O sistema utiliza uma arquitetura baseada em **Supabase Edge Functions** para garantir segurança e escalabilidade, evitando a exposição de credenciais no frontend.

### Fluxo de Comunicação:
- **Frontend React**: O formulário coleta os dados e chama o serviço de e-mail.
- **Edge Function (send-email)**: Atua como um servidor seguro que recebe a solicitação e se comunica com o Gmail.
- **SMTP Google**: Protocolo final que entrega as mensagens nas caixas de entrada.

---

## 🔄 Fluxo de Execução Passo a Passo

### 1. Disparo no Frontend
Ao submeter o formulário (`onSubmit`), o componente `ApplicationWizard.tsx` executa as seguintes funções após salvar os dados no banco:

```typescript
// Envia confirmação para o candidato
await sendApplicationConfirmationEmail(data.email, data.fullName);

// Busca todos os e-mails de admins e envia notificação para cada um
const adminEmails = await getAllAdminEmails();
await Promise.all(adminEmails.map(adminEmail =>
    sendAdminNewApplicationNotification(adminEmail, { ... })
));
```

### 2. Preparação do Template
As funções acima (em `src/lib/emails/index.ts`) preparam o conteúdo HTML do e-mail usando templates responsivos e invocam a função genérica `sendEmail`.

### 3. Chamada à Edge Function
A função `sendEmail` (em `src/lib/emails/service.ts`) faz uma requisição POST autenticada para a Edge Function do Supabase, enviando o destinatário (`to`), o assunto (`subject`) e o corpo em HTML.

### 4. Processamento SMTP (O coração do sistema)
A Edge Function `send-email` (localizada em `supabase/functions/send-email/index.ts`) **não utiliza bibliotecas externas**. Ela implementa o protocolo SMTP diretamente usando sockets nativos do Deno para garantir máxima performance e evitar quebras de dependências:

-   **Porta 587**: Inicia uma conexão TCP e faz o upgrade para TLS via comando `STARTTLS`.
-   **Autenticação**: Realiza o login usando `AUTH LOGIN` com as credenciais codificadas.
-   **Protocolo**: Segue o fluxo padrão SMTP (`EHLO` -> `MAIL FROM` -> `RCPT TO` -> `DATA` -> `QUIT`).

---

## ⚙️ Configuração e Segurança

Para que o envio funcione corretamente, o sistema utiliza o SMTP do Google (Gmail/Workspace) com as seguintes camadas de segurança:

### 1. Senhas de App do Google
Como o Google não permite o uso de senhas normais para conexões SMTP externas, utilizamos as **Senhas de App**.
-   É gerada uma senha exclusiva de 16 caracteres vinculada à conta.
-   Nenhuma senha pessoal é exposta no código-fonte.

### 2. Supabase Secrets
As credenciais são armazenadas de forma segura nos "Secrets" do Supabase:

| Secret | Descrição | Exemplo |
| :--- | :--- | :--- |
| `SMTP_HOST` | Servidor SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Porta de conexão | `587` |
| `SMTP_USER` | E-mail remetente | `contato@migmainc.com` |
| `SMTP_PASS` | Senha de App (16 chars) | `abcd efgh ijkl mnop` |

---

## ✅ Benefícios desta Implementação

-   **Deliverability**: Usar o SMTP direto do Google minimiza as chances de os e-mails caírem em SPAM.
-   **Independência de Terceiros**: Não dependemos de APIs pagas como Resend ou SendGrid para o fluxo principal.
-   **Segurança (Server-side)**: Todo o envio é processado no servidor, protegendo as chaves de acesso.
-   **Manutenibilidade**: Logs detalhados no Supabase permitem depurar rapidamente qualquer falha de entrega.

---
*Documentação técnica criada para Migma Global Partner.*
