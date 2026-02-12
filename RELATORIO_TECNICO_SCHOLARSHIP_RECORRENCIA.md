# Relatório Técnico: Sistema de Recorrência - Taxa de Manutenção de Bolsa

Este documento descreve a implementação do sistema de cobrança recorrente para a "Taxa de Manutenção de Bolsa" (Scholarship Maintenance Fee) da Migma Inc.

## 1. Visão Geral

O sistema foi projetado para gerenciar cobranças mensais "infinitas" (sem limite pré-definido de parcelas) no valor de US$ 105.00, com suporte a multas por atraso e lembretes automáticos.

## 2. Arquitetura do Banco de Dados

Foram criadas três novas tabelas dedicadas para isolar os dados da Bolsa do sistema EB-3 existente:

- `scholarship_recurrence_control`: Armazena o status global do programa de bolsa para cada cliente.
- `scholarship_recurrence_schedules`: Armazena o agendamento de cada parcela mensal.
- `scholarship_email_logs`: Registra o histórico de notificações enviadas.

### Funções PostgreSQL (RPCs)
- `activate_scholarship_recurrence`: Ativa o programa e agenda a primeira parcela para 30 dias após o pagamento inicial.
- `mark_scholarship_installment_paid`: Marca uma parcela como paga e gera automaticamente a próxima parcela (recorrência infinita).
- `check_scholarship_overdue`: Identifica parcelas vencidas e aplica a multa administrativa de US$ 50.00.

## 3. Fluxo de Pagamento e Automação

### Webhooks (Parcelow & Zelle)
Os webhooks foram atualizados para detectar o produto `scholarship-maintenance-fee`:
1. **Ativação**: No primeiro pagamento bem-sucedido, a recorrência é ativada via RPC.
2. **Conciliação**: Pagamentos de parcelas subsequentes (identificados via `scholarship_schedule_id` no metadata) disparam a marcação de pagamento e a geração da próxima parcela.

### Automação (Cron Job)
A Edge Function `scholarship-recurring-cron` executa diariamente para:
- Marcar parcelas como `overdue` após a data de vencimento.
- Enviar lembretes por e-mail 7 dias antes do vencimento.
- Notificar sobre a aplicação de taxas de atraso.

## 4. Segurança e Produção

- **RLS (Row Level Security)**: Configurado para permitir acesso apenas a administradores (via JWT role 'admin').
- **Ambiente**: Todas as funções foram implantadas em produção (`--project-ref ekxftwrjvxtpnqbraszv`).
- **Segredos**: Uso de `CRON_SECRET_KEY` para autorizar execuções do agendador externo.

## 5. Interface Administrativa (Dashboard)

Foi implementado um módulo completo de gestão para administradores:

- **Scholarship Recurring Management**: Tela que lista todos os programas ativos, com métricas em tempo real (Total vencendo no mês, em atraso, pagos hoje e total de programas ativos).
- **Scholarship Recurring Detail**: Página de detalhes por cliente, permitindo:
    - Visualizar cronograma completo de pagamentos.
    - Histórico de e-mails enviados.
    - Marcar parcelas como pagas manualmente (ex: Transferência Bancária/Wire).
    - Ativar/Suspender o programa manualmente.
    - Reenviar links de pagamento ou copiar links diretos de checkout.

### Organização do Sidebar
Para otimizar o espaço, o Sidebar foi refatorado para agrupar os serviços de recorrência em um menu dropdown chamado **"Current Service Recurrence"**, localizado logo abaixo de *Zelle Approval*.

## 6. Lógica de Negócio e Comissões (Seller)

- **Comissões Automáticas**: O sistema agora suporta comissões para vendedores em todas as parcelas da bolsa. O `seller_id` é propagado da ordem original para todas as parcelas recorrentes.
- **Contabilização Imediata**: O pagamento inicial (ativação) agora é exibido como **"1 Installment Paid"** no dashboard, garantindo que o contador reflita o status financeiro real desde o primeiro dia. As parcelas subsequentes começam a partir da **#2**.

## 7. Modo de Teste e Simulação

Para garantir a estabilidade do sistema e facilitar a homologação, foram adicionadas ferramentas de simulação:

- **Aceleração para Testes**: No banco de dados, compras feitas com o e-mail `victuribdev@gmail.com` geram vencimentos imediatos (HOJE) em vez de 30 dias.
- **Cron Acelerado**: O Cron Job foi configurado temporariamente para rodar a cada **5 minutos** em vez de 24 horas, permitindo testar o fluxo completo de e-mails em tempo real.
- **Detector de Teste**: O sistema identifica ordens de teste e evita o processamento de faturamento real ou impactos em relatórios financeiros consolidados.

---
**Status Final**: Implementação concluída e em fase de homologação final.
