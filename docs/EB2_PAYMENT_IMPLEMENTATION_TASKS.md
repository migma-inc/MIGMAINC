# Planejamento de Implementação - Serviço EB2 (Métodos de Pagamento)

## Visão Geral
**Serviço:** EB2 (Semelhante à estrutura do recém-criado EB3)
**Objetivo Principal:** Adicionar métodos de pagamento **Parcelado** e **Por Etapas**, visto que atualmente o sistema só suporta pagamento "à vista".

---

## Fases de Implementação e Tarefas (Tasks)

### Fase 1: Configurações Iniciais e Prevenção de Bloqueios
- [ ] **Ajustar Limite Transacional:** Alterar o limite máximo de pagamento no sistema de $10.000 para $9.999.
  - *Contexto:* Evitar problemas de documentação e verificações excessivas exigidas para pagamentos a partir de 10k.
- [ ] **Estruturação do Serviço:** Criar ou duplicar a estrutura base do serviço EB2, usando o EB3 como referência de arquitetura (se ainda não existir).

### Fase 2: Implementação de Novos Métodos de Pagamento
- [ ] **Integração de Pagamento Parcelado (Prioridade - MVP):**
  - [ ] Começar disponibilizando um link de pagamento parcelado configurado como "Não Promocional".
- [ ] **Integração de Pagamento por Etapas:**
  - [ ] Estruturar a lógica para pagamentos sequenciais fracionados.
- [ ] **Controle de Links Promocionais:**
  - [ ] Adicionar um toggle/funcionalidade para os administradores definirem se um link de pagamento é **Promocional** ou **Não Promocional**.

### Fase 3: Sistema Customizado de Controle de Pagamentos (Bypass Limitação "Parcelou")
- [ ] **Controle de Pagamentos Pendentes:**
  - *Contexto:* O sistema *Parcelou* possui limitações para gerenciar assinaturas recorrentes/parcelamentos automáticos nativamente.
  - [ ] Criar no banco de dados (Supabase) uma tabela ou extensão na modelagem atual para registrar e controlar manualmente/sistemicamente as parcelas pendentes de cada cliente EB2.
  - [ ] Criar interface no painel do administrador para visualizar status das parcelas (Pagos, Atrasados, Pendentes).

### Fase 4: Automação de Cobranças e Lembretes (Fluxo Contínuo)
- [ ] **Sistema Automático de Lembretes:**
  - [ ] Configurar cron job ou workflow (n8n/Supabase Edge Functions) que verifique diariamente pagamentos próximos ao vencimento e vencidos.
  - [ ] Disparar envios automáticos de e-mail/WhatsApp com lembretes para o cliente.
- [ ] **Geração e Envio de Links de Pagamento:**
  - [ ] Automatizar a geração do link da "próxima etapa/parcela" e anexá-lo nos lembretes enviados ao cliente.

---

## Observações para Orçamento/Tempo (Reflexão do Desenvolvedor)
- O ponto de maior esforço e que consumirá mais tempo será a **Fase 3** e **Fase 4**, pois envolve criar um sub-sistema de cobranças ("Billing API" própria) para contornar a limitação da provedora de pagamento ("Parcelou").
- A dependência de filas de e-mail, automações via n8n e controle de status rigoroso no banco de dados demandará testes cuidadosos ponta a ponta.
- É recomendável fechar o escopo inicial apenas nas **Fases 1, 2 e 3 (Controle Manual)**, deixando a **Fase 4 (Automação completa)** para um segundo momento caso o prazo seja apertado.
