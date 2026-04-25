# Diagnóstico e Status: Erros no Split Checkout (Migma)

## ⚠️ Status Atual: NÃO CORRIGIDO / EM ANÁLISE
Apesar das intervenções técnicas detalhadas abaixo, o sistema de pagamento dividido (split payment) ainda apresenta instabilidades e o fluxo completo de checkout não foi validado com sucesso. Os problemas de Erro 500 persistem em determinados cenários.

---

## 🛠️ Intervenções Técnicas Realizadas (Tentativas de Correção)

### 1. Edge Function: `migma-create-student`
*   **Mapeamento de Constraints**: Adicionado mapeamento de `student_process_type` para garantir compatibilidade com a check constraint do banco de dados (`initial`, `transfer`, `change_of_status`).
*   **Idempotência no Registro**: Implementado `onConflict: 'user_id'` no comando `upsert` da tabela `user_profiles` para evitar erros de duplicidade (Error 23505).
*   **Tratamento de ID de Pedido**: Removida a geração de UUIDs aleatórios (`crypto.randomUUID()`) quando a intenção de pedido falha, retornando `null` para evitar propagação de IDs inválidos.
*   **Logs de Depuração**: Adicionado array `debug_logs` serializado no retorno da função para rastrear falhas silenciosas.

### 2. Edge Function: `migma-split-parcelow-checkout`
*   **Correção de Referência de Variável**: Identificado e corrigido o erro onde a variável `p2_method` era referenciada em vez de `part2_method`.
*   **Resolução de Violação de Chave Estrangeira (FK)**: 
    *   Identificado via logs do Postgres que a função tentava inserir um UUID aleatório na coluna `order_id` da tabela `split_payments`.
    *   Como essa coluna referencia `visa_orders.id`, o banco rejeitava a transação (Error 23503).
    *   Alterado fallback para `null` para permitir a criação do registro de split sem um pedido prévio.
*   **Serialização de Erros**: Implementado tratamento robusto para capturar e converter objetos de erro complexos em JSON legível no frontend.

### 3. Banco de Dados (Postgres)
*   Análise de logs via MCP para identificar falhas de transação e violações de integridade referencial.
*   Verificação da nulabilidade das colunas em `split_payments` e `visa_orders`.

---

## 📉 Problemas Pendentes / Bloqueadores
1.  **Instabilidade de Conexão**: O redirecionamento para a Parcelow ainda falha ocasionalmente com erro 500 mesmo após as correções de integridade.
2.  **Fluxo de Retorno (Webhook)**: O processamento dos webhooks da Parcelow para pagamentos divididos ainda não foi testado em ambiente real.
3.  **Inconsistência no Frontend**: Suspeita-se que o frontend possa estar enviando dados de montante (`amount`) formatados incorretamente em certas condições de cache.

---
**Documento gerado em:** 2026-04-24 19:28 (Local)
**Responsável:** Antigravity (AI Assistant)
