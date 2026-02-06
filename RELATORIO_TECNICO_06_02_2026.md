# Relatório Técnico - Atualizações e Correções (06/02/2026)

Este relatório documenta as melhorias implementadas no sistema de checkout, geração de documentos (PDF) e integração com webhooks (n8n).

## 1. Correção de Valores no Anexo I (Bundle)
**Problema:** Documentos de Anexo I (Autorização de Pagamento) do serviço principal estavam exibindo o valor total consolidado do Bundle, em vez de apenas o valor referente ao contrato principal.
**Solução:** 
- Implementada lógica de subtração dinâmica na Edge Function `generate-annex-pdf`.
- Se o documento gerado não for um upsell (`is_upsell: false`) e houver um valor de upsell na ordem, o sistema subtrai automaticamente o `upsell_price_usd` para exibir o valor correto do serviço base.
- Garante conformidade entre o valor citado no contrato principal e o valor exibido no Anexo I.

## 2. Refatoração de Payloads do Webhook (n8n)
**Melhoria:** Otimização dos dados enviados para o n8n para garantir precisão em ordens de Bundle com múltiplos dependentes.
**Alterações:**
- **Busca Dinâmica de Preços:** A função `approve-visa-contract` agora consulta a tabela `visa_products` em tempo real para obter o `base_price_usd` e `price_per_dependent_usd` específicos de cada perna do bundle.
- **Paylod do Titular (Upsell):** Agora inclui `is_upsell: true` e o valor base real do produto de upsell (ex: US$ 299.00 no Canada Revolution).
- **Payload de Dependentes (Upsell):** Agora envia o valor unitário real por dependente do produto de upsell (ex: US$ 49.00 no Canada Revolution).
- **Payload Limpo (Main):** Removido o campo `is_upsell` das ordens principais para manter o padrão legado e evitar ruído no processamento do n8n.

## 3. Sistema de Roteamento de Teste (Sandbox)
**Funcionalidade:** Adicionada capacidade de realizar testes reais de webhook sem interferir na produção.
**Implementação:**
- O sistema detecta se o cliente é um usuário de teste (baseado no nome "Paulo Victor..." ou e-mail técnico).
- Se detectado, o tráfego é desviado para o URL de teste: `https://nwh.suaiden.com/webhook/45665dbc-8751-41ff-afb8-6d17dd61d204`.
- Clientes reais continuam sendo enviados para o webhook de produção configurado nas variáveis de ambiente.

## 4. Configuração do Produto Canada Revolution ETA
- **Sincronização:** Vinculado o produto `canada-tourist-revolution` ao template de contrato oficial "REVOLUTION ETA CANADA".
- **Valores Oficiais:** Atualizados os preços no banco de dados para os valores padrão:
    - Aplicante Principal: US$ 299.00
    - Dependentes (cada): US$ 49.00

## 5. Limpeza e Manutenção
- Removidos produtos e templates temporários criados para simulações.
- Limpeza de ordens de teste duplicadas ou órfãs no banco de dados para manter a integridade dos relatórios financeiros.

---
**Status Geral:** Concluído e em Produção.
**Autor:** Antigravity (AI Senior Software Engineer)
