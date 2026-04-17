# Relatório Técnico — 2026-04-16

---

## Atividade 1: Recuperação de Webhooks de Aprovação de Contrato

### Descrição do Problema
Contratos e anexos aprovados entre **13/04/2026** e **16/04/2026** não dispararam os webhooks para o n8n do cliente. As Edge Functions do Supabase retornaram erro **401 (Não Autorizado)** durante o processo de aprovação no dashboard, bloqueando o envio automático dos dados.

### Ações Realizadas
1. **Auditoria de Dados:** Localização de registros de ordens aprovadas no período sem o evento `n8n_webhook_dispatched` na tabela `service_request_events`.
2. **Identificação da Causa Raiz:** Erro de autenticação nas Edge Functions ao tentar realizar o disparo automático (HTTP 401).
3. **Desenvolvimento de Script de Recuperação:** Criação do script `scripts/fix_webhooks.js` replicando a lógica da função `approve-visa-contract`, utilizando `SUPABASE_SERVICE_ROLE_KEY` para garantir acesso irrestrito.
4. **Localização de Endpoints:** Via análise de logs históricos, identificado o endpoint ativo do n8n: `https://n8n.wartully.com.br/webhook/mentoriamigma`. O endpoint `approve_confirmado` retornou 404 (desativado).
5. **Execução e Verificação:** Script executado localmente. Payloads disparados e eventos de confirmação inseridos na tabela `service_request_events` por ordem.

### Resultados
- **Total de Ordens Recuperadas:** 6
- **Webhooks Disparados com Sucesso (HTTP 200):**
  - Marcelo Vinícius Venturelli Lanini — `ORD-ZEL-1775874344801`
  - Andrey Fabricio dos Santos Pontes de Paula — `ORD-20260415-2255`
  - Alisson Dutra da Silva — `ORD-MAN-20260415-3280`
  - Vanessa Alves — `ORD-20260416-1365`
  - Matheus Rafael dos Santos — `ORD-ZEL-1776307095503`
  - Kelly Mai Kuang — `ORD-INT-20260416051626-78`

### Arquivos
- `scripts/fix_webhooks.js`

---
**Status:** Concluído ✅

---

## Atividade 2: Correção da Lógica de Notificação de Documentos

### Descrição do Problema
O dashboard do cliente exibia alerta indevido ("Oops! It seems some documents are missing") para processos de pagamento por etapas (Step 2, Monthly Installments). Nesses casos, apenas o Anexo I e a Invoice são gerados — o contrato principal já foi assinado na etapa anterior — resultando em falso positivo de documento ausente.

### Ações Realizadas
1. **Análise de Código:** Identificada lógica condicional em `VisaOrderDetailPage.tsx` que disparava o alerta se qualquer um dos três documentos (Annex, Contract, Invoice) estivesse nulo, sem considerar o tipo de produto.
2. **Mapeamento de Regras de Negócio:**
   - Produtos que exigem contrato: `Selection Process`, `Initial Payment`
   - Produtos sem contrato (apenas anexo): `Step 2`, `Catalog Delivery`, `Monthly`
3. **Refatoração:**
   - Implementada função auxiliar `isContractRequired` baseada em `slug` e `name` do produto
   - Condição do alerta atualizada para validar obrigatoriedade do contrato por tipo de produto

### Resultado
O alerta é exibido somente quando:
- Anexo I ausente, **ou**
- Contrato ausente **E** produto que exige contrato, **ou**
- Invoice ausente

### Arquivos Modificados
- `src/pages/VisaOrderDetailPage.tsx`

---
**Status:** Concluído ✅

---

## Atividade 3: Otimização de Build, Refatoração de Imports e Correção de Refresh Loop

### Descrição do Problema
Dois problemas independentes afetavam o ambiente:

1. **Build warnings (Vite):** Múltiplos alertas de chunk excessivo e quebra de tree-shaking causados por mistura de imports estáticos com `await import()` dinâmicos em arquivos centrais.
2. **Refresh loop no Search Admin:** Cada caractere deletado no campo de busca de ordens disparava re-render completo da página, causando cascata de requisições ao endpoint.

### Ações Realizadas
1. **Auditoria Vite:** Preservado `vite.config.ts`. Foco direcionado aos arquivos causadores.
2. **Refatoração de Imports (Dinâmico → Estático):** Uniformização para ES6 imports fixos nos arquivos:
   - `ApplicationDetailPage.tsx`
   - `Dashboard.tsx`
   - `SellerAnalytics.tsx` e `AdminSellerAnalytics.tsx`
   - `DocumentUpload.tsx` e `Sidebar.tsx`
3. **Exceção Preservada:** Cargas dinâmicas em `lib/contract-templates.ts` mantidas intencionalmente — comentário de código documenta prevenção de falha em cadeia do bundle.
4. **Correção do Search Loop:** Implementado controle de estado com debounce implícito nas requisições Supabase, eliminando renderizações infinitas nos eventos `onChange`.

### Resultados
- Zero warnings de chunk no watcher do Vite
- Campo de busca restaurado: digitação fluida sem recarregamento visual

---
**Status:** Concluído ✅

---

## Atividade 4: Operações Diversas — Refatoração, Sanitização e Automação

### Ações Realizadas
1. **Limpeza de Banco de Dados:** Expurgo de dezenas de registros mortos com flag `@uorak.com` e ghosts da tabela `migma_checkout_zelle_pending`.
2. **Atualização de Script N8N:** Neutralização de redundâncias no `resend-to-n8n.ps1` (PowerShell), incluindo remoção de bloqueios duplicados de diploma que travavam a thread de webhooks.
3. **Refino de Design — Motor Core Migma:**
   - Integração do `MigmaSurvey` standalone ao fluxo `StudentOnboarding`
   - Remoção de elementos de marketing agressivo do Home
   - Adoção do padrão visual **Black & Gold** (alto ticket) em substituição ao blue/white nos componentes de Seller Analytics e Checkout
   - Refatoração de topologia lateral e Sidebar com permissões RLS revisadas
4. **Stripe e Parcelow — Environment Review:** Segregação correta de webhooks e chaves entre modo Produção e modo Debug, preservando integridade das transações USD via Stripe Invoice.

---
**Status:** Concluído ✅

---

## Atividade 5: Análise Arquitetural Completa — Spec V11 vs Baseline V7

### Contexto
Com o plano de execução V11 (`migma-v11-plan.md`) estruturado em sessões anteriores, esta atividade realizou a leitura integral e cruzamento analítico entre os dois documentos base: o plano de execução e a especificação completa (`migma_spec_v11_clean.md`, v11.0, ~1.623 linhas, 15 seções). Objetivo: validar as decisões em aberto do plano, identificar contradições na spec e capturar gaps não mapeados antes do início do desenvolvimento.

### Decisões em Aberto — Status Após Análise

| Decisão (do plano) | Conclusão após leitura da spec |
|---|---|
| Aprovação de perfil: automática ou manual? | **Manual** — admin vê card "AGUARD. APROVAÇÃO", clica Aprovar/Rejeitar (seção 6.3). Aprovação automática de 24h existe apenas para **bolsa** (seção 13.2), não para perfil. |
| WhatsApp: Z-API? | **Z-API confirmado** como padrão (seção 13.3), com abertura para "equivalente — decisão do dev". |
| IA do chat: qual modelo? | **Em aberto** — spec diz "Claude/GPT ou equivalente — decisão do desenvolvedor" (seção 12.3). |
| Templates de formulários existem? | **Mapeados, não existem.** Seção 11 mapeia campos por formulário para Caroline e Oikos. Para as outras 13 universidades: "devem ser cadastradas pelo time interno com base no Guia de Instituições". |
| API MatriculaUSA disponível? | **Contradição encontrada** — detalhado abaixo. |
| Aprovação automática de bolsa: quais universidades? | **Respondido:** Caroline (prioridade) → Oikos → outras 13 universidades sempre encaminham para revisão humana (seção 13.2). |

### Contradição Crítica Identificada — Fluxo MatriculaUSA

A spec apresenta dois modelos incompatíveis para o envio do pacote de documentos ao MatriculaUSA:

- **Seção 11.6 (Pacote Final de Assinatura):** "Admin da Migma baixa o pacote completo e envia via integração para o MatriculaUSA processar" — implica ação manual do admin.
- **Seção 13.1 (Integrações):** "Sistema Migma envia automaticamente o pacote completo para o MatriculaUSA. Zero intervenção humana nessa etapa."

São dois designs de fluxo diferentes. **Esta decisão deve ser tomada antes de codar qualquer coisa da Fase 6.** Impacta diretamente se será necessária uma API de integração real com o MatriculaUSA ou apenas um botão de envio manual no painel admin.

### Gap Crítico — COS Pós-I-20 Não Documentado

A seção 14.5 da spec está explicitamente marcada como **pendente de documentação**:

> "O fluxo do COS após a emissão do I-20 é diferente do Transfer e será documentado separadamente. Envolve: preenchimento do Form I-539, Cover Letter, protocolo no USCIS, acompanhamento da decisão."

O plano de execução trata Transfer e COS como fluxos paralelos ao longo da Fase 6. Na prática, **o fluxo COS pós-I-20 está incompleto na spec**, o que significa que parte da Fase 6 não pode ser implementada para COS sem uma nova sessão de alinhamento com o produto.

### Gaps Identificados no Plano — Não Mapeados nas Fases

Os itens abaixo existem na spec mas não estão representados como tasks no `migma-v11-plan.md`:

| Gap | Seção Spec | Impacto |
|---|---|---|
| **Application Fee como 3ª cobrança** — $350 + $100/dep, geração automática de link após aprovação de documentos | 9.3 | Fase 5 precisa de task específica para este webhook e geração de link |
| **Trava financeira Placement Fee 1x vs 2x** — carta de aceite bloqueada até 2ª parcela | 14.3 | Frontend de My Applications + webhook de gate (A17 existe no plano mas sem task de UI) |
| **Exibição condicional de ESL** — escolas de inglês aparecem somente para nível Zero/Básico ou indicação manual do admin | 10.2 | Lógica de branch ausente na Fase 4 (tela de faculdades) |
| **Cobranças ao iniciar o curso** — Orientation Day $300 (taxa única) + Teste de Inglês $50 | 7.5 (Seção 3) | Não está em nenhuma fase do plano; são cobranças fora do recorrente |
| **Perda de bolsa** — GPA < 3.5: mensalidade Migma não muda, cliente paga tuition cheia à universidade | 15.6 | Módulo de cobrança recorrente (Fase 7) precisa tratar este cenário |
| **Narrativa 1.481 → X pré-aceites** — copy deliberado para reforçar exclusividade na tela de faculdades | 10 | UX copy crítico; não pode ser implementado como número fixo |
| **Timing estratégico do Bank Statement** — solicitado APÓS Placement Fee para evitar objeção financeira | 9.1 | Ordem dos global documents na Fase 5 |
| **Dados incompletos de 11 universidades** — Excel, ILI, ALA, Internexus, AAE e demais têm campos "A confirmar" | 10.1 | Seed da Fase 1 não pode ser concluído sem o Guia de Instituições interno |

### Estrutura de Pagamentos — Mapeamento Completo (3 Momentos)

Identificado o fluxo completo de cobranças, que o plano não apresentava de forma integrada:

```
1. Checkout (Fase 0)
   └─ Taxa do Processo Seletivo: $400 + $150/dep

2. Pós-aprovação de bolsa (Fase 5)
   └─ Placement Fee: $200 a $1.800 (conforme nível de bolsa)
      └─ Se 2x: carta de aceite bloqueada até 2ª parcela

3. Pós-aprovação de documentos (Fase 5)
   └─ Application Fee / Taxa I-20: $350 + $100/dep
      └─ Link gerado automaticamente pelo sistema

4. Ao iniciar o curso (fora das fases atuais)
   └─ Orientation Day: $300 (taxa única)
   └─ Teste de Inglês: $50 (se aplicável)
   └─ Material didático: informado pela universidade

5. Recorrente mensal (Fase 7)
   └─ (tuition com bolsa - base Migma) ÷ 12
   └─ 48x Bacharelado / 24x Mestrado
   └─ Isenção ao 10º fechamento por indicação
```

### Tabelas Financeiras — Completamente Definidas

A seção 15 da spec entrega todas as tabelas necessárias para implementar a Fase 7 sem ambiguidade:
- Bases Migma: Bacharelado $3.800/ano, Mestrado $4.200/ano, CS $5.500/ano
- Tabelas completas Caroline e Oikos por nível de bolsa (6 níveis cada)
- Padrão universal: mensalidade é sempre a mesma para o mesmo Placement Fee, independente da universidade
- Exemplo: Placement Fee $1.800 → sempre $105/mês (exceto MBA Caroline: $100/mês)

### Aprovação Automática de Bolsa — Lógica Completa

```
Trigger: cliente paga Placement Fee → timer 24h inicia

├─ Caroline na seleção → aprova Caroline ao fim do timer (prioridade)
├─ Somente Oikos → aprova Oikos ao fim do timer
└─ Nenhuma das duas → alerta imediato para humano + timer 24h para intervenção
```

### Resultados
- Decisões em aberto do plano mapeadas com resolução ou flag de bloqueio
- Contradição MatriculaUSA identificada e documentada para decisão da equipe
- 8 gaps adicionais capturados fora do plano original
- Fluxo completo de 5 momentos de cobrança consolidado
- COS pós-I-20 flagado como incompleto na spec — requer nova sessão de produto antes da Fase 6

---
**Status:** Concluído ✅
