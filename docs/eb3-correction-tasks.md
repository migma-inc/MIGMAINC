# Backlog Prioritário: Correções Recorrência EB-3

Este documento lista as pendências críticas identificadas no fluxo de recorrência do programa EB-3 (Parcelow e Zelle). As tarefas estão priorizadas para garantir o funcionamento correto em produção.

## 🚨 Crítico (Showstoppers - Impedem o funcionamento)

### Card 1: Corrigir Webhook do Parcelow (Campo Incorreto)
**Descrição:**
O webhook do Parcelow (`supabase/functions/parcelow-webhook/index.ts`) está tentando ler o ID da parcela (`eb3_schedule_id`) no campo incorreto `order_metadata`. O frontend já foi atualizado para salvar em `payment_metadata`.
**Consequência:** Pagamentos de cartão não darão baixa automática.
**Checklist:**
- [ ] Substituir leitura de `order.order_metadata` por `order.payment_metadata`
- [ ] Verificar também o objeto `mainOrder` dentro da função
- [ ] Deploy da function `parcelow-webhook` v2

### Card 2: Corrigir Bug do Token de Prefill no Frontend
**Descrição:**
O link enviado pelo Cron contém um **token** (`?prefill=TOKEN`), mas o componente `EB3InstallmentCheckout.tsx` tenta usar esse token diretamente como se fosse o ID da parcela na tabela `eb3_recurrence_schedules`. Isso causará erro de "Parcela não encontrada".
**Consequência:** Clientes clicarão no link do email e verão erro.
**Checklist:**
- [ ] No `EB3InstallmentCheckout.tsx`, detectar se `installmentId` é um UUID válido de parcela ou um token
- [ ] Se for token, buscar na tabela `checkout_prefill_tokens` para obter o `client_data.eb3_schedule_id` real
- [ ] Carregar a parcela com o ID correto

### Card 3: Atualizar URL Base no Cron Job (Links Quebrados)
**Descrição:**
A Edge Function `eb3-recurring-cron` está gerando links de pagamento com `http://localhost:5173`.
**Consequência:** Links nos emails de cobrança não funcionarão em produção.
**Checklist:**
- [ ] Alterar `siteUrl` para `https://migmainc.com` em `supabase/functions/eb3-recurring-cron/index.ts`
- [ ] Aplicar correção tanto no fluxo normal quanto no fluxo de "Late Fee"
- [ ] Deploy da function `eb3-recurring-cron` v13

---

## ⚠️ Alta Prioridade (Estabilidade & UX)

### Card 4: Validar Fluxo de Rejeição Parcelow
**Descrição:**
Ao contrário do Zelle, o fluxo do Parcelow não tem reconvocação explícita de pagamento em caso de falha (`event_order_declined`).
**Checklist:**
- [ ] Garantir que o status da `visa_order` vá para `failed` ou `cancelled`
- [ ] O Cron Job deve (corretamente) continuar cobrando essa parcela, pois ela não constará como `paid` na tabela `eb3_recurrence_schedules`
- [ ] Validar comportamento visual no Frontend para pagamento falho

### Card 5: Script de Limpeza de Dados de Teste
**Descrição:**
Existem registros "sujos" de testes manuais que podem atrapalhar a contabilidade ou os testes finais.
**Checklist:**
- [ ] Criar e rodar script SQL para deletar `visa_orders`, `eb3_recurrence_schedules` e `eb3_recurrence_control` associados a `victuribdev@gmail.com`
- [ ] Zerar sequência de invoices se necessário (opcional)

---

## ✅ Média Prioridade (Melhorias)

### Card 6: Monitoramento Pós-Deploy
**Descrição:**
Acompanhar os primeiros pagamentos reais ou simulados em produção.
**Checklist:**
- [ ] Verificar logs de `parcelow-webhook`
- [ ] Verificar logs de `eb3-recurring-cron`

---

## 📊 Dashboard de Gestão EB-3 (Página "Quebrada")

### Card 7: Refatorar Dashboard com RPC (Performance & Correção de Acesso)
**Descrição:**
A página `EB3RecurringManagement.tsx` está falhando em carregamento (provável erro de RLS nas tabelas `clients` ou `sellers` durante join) e utiliza lógica ineficiente (N+1 queries).
**Solução:** Substituir lógica frontend por uma *Stored Procedure* (RPC `get_eb3_program_summaries`) segura e performática.
**Checklist:**
- [ ] Criar função SQL `get_eb3_program_summaries` que retorna dados consolidados (Controle, Cliente, Vendedor, Próxima Parcela).
- [ ] Atualizar `EB3RecurringManagement.tsx` para consumir essa RPC única.
- [ ] Remover lógica de `Promise.all` e joins manuais.

### Card 8: Melhorias de UX no Dashboard
**Descrição:**
Se não houver programas, a tela fica vazia sem indicação clara.
**Checklist:**
- [ ] Adicionar "Empty State" amigável.
- [ ] Adicionar botão "View Details" funcional linkando para detalhes do cliente.

---

## 🔍 Validação de Pagamento Zelle

### Card 9: Validar RPC de Baixa Zelle (`mark_eb3_installment_paid`)
**Descrição:**
O fluxo de aprovação Zelle depende da RPC `mark_eb3_installment_paid` para dar baixa em parcelas EB-3.
**Checklist:**
- [ ] Verificar se a função existe no banco.
- [ ] Validar se ela atualiza: `status` ('paid'), `paid_at` (NOW()), `payment_id`.
- [ ] Garantir que ela trate erros (ex: parcela já paga).
