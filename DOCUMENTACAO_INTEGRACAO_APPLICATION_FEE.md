# Integração de Pagamento: Application Fee (Migma → MatriculaUSA)

Este documento descreve a implementação técnica do fluxo de pagamento da **Taxa de Matrícula (Application Fee)** realizada no ecossistema Migma, mas que utiliza a infraestrutura financeira e deve refletir os dados no banco de dados do projeto **MatriculaUSA**.

## 1. Visão Geral do Fluxo

O objetivo é permitir que alunos no portal Migma paguem a taxa de matrícula diretamente para a conta do MatriculaUSA (via Stripe ou Parcelow), garantindo que o status de "Pago" seja refletido em ambos os sistemas.

1.  **Migma:** Aluno inicia o checkout.
2.  **Edge Functions (Migma):** Criam a sessão de pagamento usando as `SECRET_KEYS` do projeto MatriculaUSA.
3.  **Gateway (Stripe/Parcelow):** Processa o pagamento na conta do MatriculaUSA.
4.  **Webhooks (Migma):** Recebem a confirmação e realizam o "Cross-DB Sync" para o banco do MatriculaUSA via `service_role`.

## 2. Implementação Técnica

### Isolação de Chaves (Secrets)
Para que o dinheiro caia na conta correta, as novas funções no Supabase Migma utilizam os seguintes secrets:
*   `MATRICULAUSA_STRIPE_SECRET_KEY` (Test/Prod)
*   `MATRICULAUSA_PARCELOW_CLIENT_ID/SECRET` (Staging/Prod)

### Edge Functions Criadas
*   `create-application-fee-checkout`: Gera a URL de pagamento.
*   `matriculausa-stripe-webhook`: Processa retornos do Stripe.
*   `matriculausa-split-parcelow-checkout`: Gerencia pagamentos parcelados/divididos.
*   `parcelow-webhook`: (Modificada) Agora identifica referências com prefixo `MATRICULAUSA-AF-APP-`.

## 3. Lógica de Sincronização Proposta

Atualmente, quando um pagamento é confirmado, a Migma executa o seguinte SQL no projeto MatriculaUSA:

```sql
UPDATE scholarship_applications
SET 
  is_application_fee_paid = true,
  application_fee_payment_method = [metodo],
  application_fee_paid_at = [timestamp]
WHERE student_id = [matricula_profile_id]
  AND source = 'migma';
```

## 4. Consultas para a Equipe MatriculaUSA

Para garantir que a integração não quebre fluxos internos ou relatórios do MatriculaUSA, precisamos validar os seguintes pontos:

1.  **Arquitetura de Tabelas:** Além da `scholarship_applications`, existe alguma tabela específica de `payments` ou `orders` no MatriculaUSA onde este recebimento deva ser registrado para fins contábeis ou de auditoria?
2.  **Identificação do Aluno:** Atualmente, buscamos o aluno no MatriculaUSA via `user_id` (UUID sincronizado) ou `email`. Este é o identificador mais confiável ou existe algum `external_id` preferencial?
3.  **Campos de Auditoria:** As colunas `application_fee_payment_method` e `application_fee_paid_at` propostas na `scholarship_applications` são suficientes para o controle de vocês, ou preferem nomes de colunas diferentes para manter o padrão do projeto?
4.  **Status de Aplicação:** Existe algum gatilho (Trigger/Webhook) no MatriculaUSA que deva ser disparado manualmente após a confirmação desse pagamento, ou a alteração na tabela `scholarship_applications` já é monitorada pelo sistema de vocês?
5.  **Conciliação Parcelow:** Como o Parcelow utiliza webhooks, a URL de notificação configurada aponta para a Migma (que então replica o dado para o MatriculaUSA). Existe algum problema nessa "ponte" ou preferem que o webhook notifique o MatriculaUSA diretamente?

---
*Documento preparado para alinhamento técnico entre Migma Inc e MatriculaUSA.*
