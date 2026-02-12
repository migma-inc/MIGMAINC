# 📄 Relatório Técnico: Sistema de Recorrência EB-3

Este documento detalha o sistema de cobrança recorrente para o programa EB-3 da Migma Inc., integrando pagamentos via **Zelle** e **Parcelow**, com automação de cobranças e notificações.

## 1. Arquitetura do Sistema
O sistema é baseado em eventos no Supabase, disparados após o pagamento do "Serviço 4" (Job Catalog).
- **Ativação**: Função SQL `activate_eb3_recurrence`.
- **Processamento Webhooks**: Edge Functions (`parcelow-webhook`, `send-zelle-webhook`).
- **Automação de Cron**: Edge Function `eb3-recurring-cron`.

## 2. Fluxo de Ativação
Quando um cliente paga o **Serviço 4** (EB-3 Installment Catalog):
1.  **Detecção Automática**: O webhook (Parcelow ou Zelle) identifica o produto EB-3.
2.  **Ativação de Recorrência**: É executada a RPC `activate_eb3_recurrence`.
3.  **Geração de Calendário**:
    *   Criação do registro em `eb3_recurrence_control`.
    *   Geração de **8 parcelas mensais** de **US$ 650,00** em `eb3_recurrence_schedules`.
    *   A primeira parcela é agendada para **30 dias após** a ativação.

## 3. Fluxo de Pagamento e Webhooks
O sistema foi projetado para ser "agnóstico" ao método de pagamento:

### Parcelow (Automático)
- O cliente recebe um link via e-mail e realiza o pagamento via cartão ou transferência.
- O `parcelow-webhook` recebe a confirmação e verifica se a ordem pertence a uma recorrência (`eb3_schedule_id`).
- Caso positivo, marca a parcela como paga via RPC `mark_eb3_installment_paid`.

### Zelle (Manual)
- O cliente sobe o comprovante pelo dashboard.
- O administrador aprova o pagamento na aba "EB-3 Recurring" do painel administrativo.
- O sistema atualiza o status da parcela e registra no log.

## 4. Automação e Cron Job (`eb3-recurring-cron`)
A função de Cron é responsável pela saúde financeira do sistema:
- **Lembretes de Vencimento**: Envia e-mails automáticos 7 dias antes do vencimento de cada parcela.
- **Gestão de Atrasos**: 
    *   Detecta parcelas não pagas após a data de vencimento.
    *   Aplica **taxa administrativa de US$ 50,00** automaticamente.
    *   Envia notificações de "Pagamento em Atraso" com o novo valor total.
- **Tokens de Checkout**: Gera tokens temporários e seguros para que o cliente acesse o checkout sem precisar de login.

## 5. Melhorias de Experiência e Segurança (Janeiro/Fevereiro 2026)
- **Formatação BRL**: E-mails de confirmação agora exibem valores em **Reais (BRL)** com formatação brasileira (1.234,56) quando o pagamento é via Parcelow.
- **Timing de Mensagens**: Removida a cobrança imediata no ato da ativação. O cliente agora recebe apenas os lembretes do Cron, respeitando o ciclo de 30 dias.
- **Segurança do Cron**: Implementada verificação via `CRON_SECRET_KEY` para evitar execuções externas não autorizadas.
- **Modo Real**: Remoção de bypasses de teste, garantindo que o sistema processe apenas transações legítimas de produção.

---

### Reflexão sobre Escalabilidade e Manutenibilidade
O sistema utiliza uma arquitetura baseada em **Funções de Banco de Dados (RPCs)**, o que garante a integridade dos dados e permite que a lógica de negócios centralizada (`activate_eb3_recurrence`, `mark_eb3_installment_paid`) seja reutilizada por qualquer novo método de pagamento que venha a ser implementado. A separação entre o fluxo de checkout e o motor de agendamento (Cron) permite escalar o número de clientes sem impactar a performance do site principal.

**Recomendação Futura**: Implementar um sistema de Webhook Failover para re-tentar notificações da Parcelow em caso de falha temporária do serviço.

---
**Data do Relatório**: 11 de Fevereiro de 2026
**Status**: Implementação Concluída e em Produção.
