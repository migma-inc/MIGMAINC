# Documentação Completa: Fluxo de Pagamentos Zelle End-to-End e Integração com n8n

Esta documentação descreve de forma abrangente a arquitetura e o fluxo de vida de um pagamento via Zelle, desde o momento em que o usuário anexa o comprovante até a ativação dos serviços através das Edge Functions.

## 1. Visão Geral de Arquitetura

O sistema de processamento Zelle foi implementado sendo divido em 3 camadas lógicas:
1. **Frontend (`ZelleService.ts` / `ZelleProcessingView.tsx`)**: Orquestrador das ações. Faz uploads, envia para a IA e gerencia as inserções SQL.
2. **Avaliação Sem Estado (n8n IA)**: Recebe a URL da imagem via HTTPS POST, avalia se o recibo é falso ou verdadeiro, cruza dados e devolve o grau de confiança (`confidence`). O n8n **não altera dados no banco**.
3. **Execução de Pipelines e Ativação (Edge Functions)**: Lida com geração pesada de PDFs, e-mails vitais de transação, atualizações em funil e chamadas seguras usando Service Role. 

---

## 2. O Fluxo de Ponta a Ponta Exato

### Passo 1: Interação do Usuário e Upload
- O usuário encontra-se na tela de pagamento final e anexa um comprovante de transferência do Zelle (`ZellePayment.tsx`).
- O frontend envia esse arquivo de imagem crua para o **Supabase Storage** no bucket definido (`zelle_comprovantes`) que possui visibilidade pública.
- A URL do arquivo é retornada para o front.

### Passo 2: Avaliação da IA no n8n
- O frontend, de posse da URL da imagem e dados da compra (valor, nome da fee), executa a função: `processZellePaymentWithN8n()`  (em `zelle-n8n-integration.ts`). 
- Essa função invoca o endpoint HTTPS exposto pelo webhook do n8n de forma iterativa e **síncrona** (`VITE_N8N_WEBHOOK_URL`).
- O n8n processa a imagem (via ChatGPT 4o Vision/OCR e regras de verificação) e devolve a resposta de validação para o frontend.
  *(A validação devolvida no JSON inclue chaves fundamentais como `response` e `confidence` de 0.0 a 1.0).*

### Passo 3: Criação do Registro de Compra
- Ainda no frontend, após o retorno imediato do n8n (seja ele um sucesso ou falha/timeout), o componente compila as informações parciais:
- **Tabela `visa_orders`**: Um novo registro da compra de tipo "visa_order" é gerada, ou aproveitada um existente que esteja em `pending`. Status mantido como `pending` e metadados da n8n são agrupados anexados.
- **Tabela `zelle_payments`**: O registro com a ligação ao id do n8n e imagem é salvo no banco de dados com `status = 'pending_verification'`.
 *(O Frontend possui políticas de Segurança RLS explícitas liberando o cadastro (`INSERT`) nesses locais).*

### Passo 4: Triagem Administrativa (Zelle Approval Page)
- O fluxo de pagamento recém criado cai na dashboard administrativa em `ZelleApprovalPage.tsx`.
- O administrador vê lado-a-lado a imagem do comprovante real vs os dados lidos e a confiabilidade enviada pelo n8n (`n8n_confidence`).
- Uma vez conferido, o Admin clica em **Aprovar**. O frontend então atualiza fortemente o status em ambas as tabelas (`completed` para a order e `approved` pro pagamento Zelle) através da autoridade privilegiada do admin (`auth.user()`).

### Passo 5: Geração de Contratos e Pipeline (Edge Functions)
- No instante do "Approve", o frontend aciona de forma paralela sua própria Edge Function mestre: `send-zelle-webhook`.
- O script `send-zelle-webhook` na Edge Function realiza uma Pipeline Sequencial Vitalícia:
  - Altera status de dependentes ou de `service_requests` atrelados.
  - Verifica ativações de modelo de produtos EB-3.
  - Executa a `generate-visa-contract-pdf` e `generate-annex-pdf`.
  - Envia confirmação de transação por `"send-payment-confirmation-email"`.
  - Notifica a equipe de vendas de novo pagamento ativado.

---

## 3. Comportamento do Row Level Security (RLS)
Por que o RLS está assim, e por que a criação no db é pelo Frontend:
**`zelle_payments` (Tabela)**
- `INSERT`: **Aberto**. A Policy `"Public can insert zelle_payments"` permite explicitamente aos `anon` ou `authenticated` da ponta. Porque a aplicação exige essa criação durante checkout.
- `UPDATE`: Totalmente **Fechado**. Apenas `service_role` (Edge Functions ou scripts Backend) e perfis com autoridade podem alterar de `pending_verification` para `approved`. 

---

## 4. O Papel do n8n IA na Validação Final 
- O N8n desempenha as funções de oráculo (stateless validator). Ele analisa com Machine Vision para garantir precisão do montante recebido e nome do banco emissor.
- **Ele não modifica banco de dados**, protegemos nosso banco mantendo seu escopo minificador, enviando um request síncrono que aguarda apenas a resposta.
- Retirar as conexões SQL do container do n8n torna a manutenção mais segura contra injeções ou chaves perdidas no ambiente externo, deixando as conexões ativas de Supabase fechadas e controladas pelas Edge Functions isoladas do nosso Backend oficial. 

---

## Como escalar (Próximos Passos de Arquitetura)
Se na próxima etapa decidirmos automatizar 100% de pagamentos Zelle (sem interferência humana pra reviews com mais de 0.9 confidence), podemos:
A) Inserir a condição dentro de `ZelleService.ts` no frontend de dar "Approve" direto, chamando assim o script do pipeline `send-zelle-webhook` no final do fluxo do usuário.
B) Iniciar via Webhook Assíncrono com o n8n. O n8n daria sim um PATCH final autenticado para uma nova Edge Function exclusiva (ex: `approve-migma-payment`) de modo que evitamos que o navegador do usuário aguarde 30s de time-response durante a finalização do seu checkout em tela.
