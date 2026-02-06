# 📄 Documentação Técnica: Sistema de Recorrência EB-3
**Data**: 05/02/2026  
**Sistema**: Migma Inc.  
**Objetivo**: Gestão automatizada de cobranças mensais para o plano parcelado do visto EB-3.

---

## 1. Visão Geral (O que é?)
O sistema de recorrência foi projetado para gerenciar clientes que optam pelo plano de parcelamento do visto EB-3. Em vez de uma assinatura automática (que retira dinheiro do cartão sem aviso), o sistema funciona por **Gatilho de Cobrança**:
1. O sistema identifica as parcelas vencendo no dia.
2. Envia um e-mail premium com um link de pagamento único.
3. O cliente clica, paga no Stripe ou Parcelow, e o sistema dá baixa na parcela.

---

## 2. Estrutura de Tabelas (Banco de Dados)

### 2.1 `recurring_billing_schedules` (O Plano)
Armazena a "casca" do contrato de parcelamento.
- **`order_id`**: Vinculação com o pedido inicial de $5.000.
- **`total_installments`**: Total de parcelas (Padrão: 24).
- **`amount_per_installment`**: Valor de cada parcela (Padrão: $650).
- **`status`**: `active`, `suspended` ou `completed`.
- **`next_billing_date`**: Data da próxima cobrança automática.

### 2.2 `billing_installments` (As Parcelas)
Armazena cada uma das 24 cobranças individuais.
- **`due_date`**: Data de vencimento daquela parcela específica.
- **`status`**: `pending`, `paid`, `overdue`.
- **`notified_at`**: Data/Hora em que o e-mail de cobrança foi enviado (evita duplicidade).
- **`checkout_token`**: Código que permite ao cliente ir direto para o checkout sem preencher formulários novamente.

---

## 3. Automação e Edge Functions

### 3.1 `setup-recurring-billing`
**Função**: Criar o plano de 24 meses.  
**Quando ocorre?** Atualmente é disparada manualmente pelo Admin no dashboard, mas pronta para ser automatizada via Webhook após o pagamento da entrada.  
**O que faz?** Insere o registro em `recurring_billing_schedules` e gera 24 linhas em `billing_installments` com datas futuras (30, 60, 90 dias, etc).

### 3.2 `process-daily-billing` (O Coração do Sistema)
**Função**: O "cobrador" automático.  
**Quando ocorre?** Todos os dias às **18:00 UTC (15:00 Horário de Brasília)**.  
**Fluxo de Trabalho**:
1. Busca todas as parcelas em `billing_installments` que têm `due_date` igual a HOJE e status `pending`.
2. Para cada cliente encontrado:
   - Gera um link de pagamento dinâmico.
   - Dispara um e-mail com design premium Migma.
   - Marca a parcela como "Notificada" (`notified_at`).

---

## 4. Fluxo de Experiência do Cliente (UX)

1. **Recebimento**: O cliente recebe um e-mail com o assunto: *"Reminder: Your EB-3 Monthly Installment is Due"*.
2. **Ação**: O e-mail contém um botão dourado *"Pay Installment"*.
3. **Checkout**: Ao clicar, o cliente cai em uma página de pagamento da Migma já com seu Nome, E-mail e Valor ($650) preenchidos.
4. **Confirmação**: Assim que o pagamento é aprovado, o status da parcela muda para `paid` no sistema automaticamente via Webhook.

---

## 5. Interface Administrativa (Painel)
Na página de detalhes de um pedido EB-3 (`VisaOrderDetailPage`), o administrador tem:
- **Visualização de Cronograma**: Uma lista de todas as 24 parcelas com datas e status.
- **Status Visual**: Badges indicando o que já foi pago e o que está pendente.
- **Botão de Emergência**: "Generate Schedule" — Caso uma recorrência não tenha sido criada automaticamente por algum erro de rede, o Admin a cria com um clique.

---

## 6. Próximos Passos (Stand-by)
Pontos pendentes para a ativação total:
1. **Automação de Gatilho**: Decidir se o plano de 24 meses deve ser criado logo após o pagamento de $5.000 ou após a segunda parcela de $3.000.
2. **Ajuste de Centavos**: Confirmar no Trello se os valores são fixos em $650 ou se precisam de ajuste para fechar o total de $23.750 do visto.
3. **Limpeza de Testes**: Remover os registros de teste criados para validar o e-mail das 15h.

---
**Autor**: Antigravity AI Engine  
**Status**: Implementado & Aguardando Gatilhos Finais.
