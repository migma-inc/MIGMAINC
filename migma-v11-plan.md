# Plano de Execução — MIGMA Spec v11

**Data:** 2026-04-16
**Base:** Análise comparativa spec v7 → v11 + estado atual da implementação
**Estimativa total:** 12–16 semanas

---

## Estado Atual (O que já existe)

### Checkout (V7) — ✅ Implementado
- Step 1: dados pessoais, preço dinâmico ($400 + $150/dependente), métodos Square/Parcelow/Pix/Zelle com IP detection
- Step 2: dados adicionais (documento, endereço, estado civil), upload de documentos (frente/verso/selfie)
- Step 3: confirmação final, redirect tela de sucesso
- Webhooks de pagamento: `square-webhook`, `stripe-visa-webhook`, `parcelow-webhook`, `send-zelle-webhook`

### Questionário (V7) — ✅ Implementado (parcial V11)
- Seções A–E com Q1–Q50 em `data/migmaSurveyQuestions.ts`
- Campos exclusivos Transfer (`transfer_deadline_date`) e COS (`cos_i94_expiry_date`) persistidos
- Tela de conclusão com animação 0 → 1.481
- **Faltando:** validação "exatamente 2" nas áreas/frequência/investimento; remoção da pergunta de tipo de processo; routing por URL

### CRM Onboarding (T1–T10) — ✅ Implementado
- `onboarding-crm.ts`: leitura agregada, `deriveOperationalStage()`, 14 stages operacionais
- Board Kanban: `OnboardingCrmBoard.tsx` com drag-and-drop, filtros por serviço (COS/Transfer/All)
- Detalhe do caso: `AdminUserDetail.tsx` com 8 abas (Overview, Journey, Survey, Orders, Documents, Timeline, Messages, Follow-ups)
- `service_request_followups`, `service_request_events`, `service_request_stage_history`: auditoria completa
- `onboarding-sla-cron`: monitoramento de casos parados + alertas Transfer/COS (implementado, pendente deploy)
- Rotas: `/dashboard/users`, `/dashboard/users/:profileId`, `/dashboard/crm/cos`, `/dashboard/crm/transfer`

### O que está pronto mas não deployado
- Migrations `20260407223000`, `20260409143000`, `20260410100000–100002`
- Edge functions: `square-webhook`, `stripe-visa-webhook`, `parcelow-webhook`, `send-zelle-webhook`, `approve-visa-contract`, `reject-visa-contract`, `onboarding-sla-cron`

---

## Diferenças Críticas V7 → V11

| Área | Mudança | Impacto |
|---|---|---|
| Questionário | Pergunta "tipo de processo" REMOVIDA — tipo determinado pela URL | ALTO |
| Questionário | Áreas/Frequência/Investimento: obrigatório exatamente 2 seleções | ALTO |
| Pós-questionário | Novo pipeline: aprovação bilateral (universidades 24h + admin Migma 24h) | MUITO ALTO |
| Faculdades | Nova tela com 15 instituições, 12 filtros, modal 7 seções, até 4 seleções | MUITO ALTO |
| Aprovação de Bolsa | Admin seleciona nível → sistema gera link Placement Fee automaticamente | MUITO ALTO |
| Documentação | Global Document Requests específicos por tipo + aprovação admin doc-a-doc | MUITO ALTO |
| Formulários | Geração automática de 7–11 PDFs por universidade (IA), assinatura digital com metadata | MUITO ALTO |
| Integração | Migma → MatriculaUSA: envio automático de pacote completo após assinaturas | MUITO ALTO |
| Cobrança | Recorrente mensal: (tuition com bolsa - base Migma) / 12, 48 ou 24 parcelas | MUITO ALTO |
| Indicação | Link único + Calendly + contador + isenção tuition ao 10º fechamento | MUITO ALTO |
| Notificações | 14 triggers email + WhatsApp (Z-API) em pontos críticos | ALTO |
| Chat IA | Agente "Equipe Migma" com base de conhecimento spec v11 | MÉDIO |

---

## Gaps Identificados

### Schema (Banco de Dados)
| ID | Gap | Status |
|---|---|---|
| S1 | `user_profile_sites` não existe | Migration pendente de decisão |
| S2 | `service_requests.workflow_stage` constraint só Transfer | Migração necessária |
| S3 | Trigger SQL para propagar `last_activity_at` de service_requests para user_profiles | Pendente |
| S4 | `selection_survey_completed` boolean gerado | Pendente |
| **S5** | Schema completo de instituições (15 universidades × 30+ campos, bolsas, courses) | ❌ Faltando completamente |
| **S6** | `institution_applications` (seleções do cliente) | ❌ Faltando completamente |
| **S7** | `global_document_requests` (documentos específicos por tipo) | ❌ Faltando completamente |
| **S8** | `institution_forms` (formulários pré-preenchidos + assinados) | ❌ Faltando completamente |
| **S9** | `referral_links` (programa de indicação) | ❌ Faltando completamente |
| **S10** | `recurring_charges` (cobrança mensal recorrente) | ❌ Faltando completamente |

### Lógica de Negócio
| ID | Gap | Fase |
|---|---|---|
| L1 | Routing URL determina serviço (Transfer vs COS) no questionário | Fase 2 |
| L2 | Remover pergunta "tipo de processo" do questionário | Fase 2 |
| L3–L5 | Validação "exatamente 2 seleções" em áreas/frequência/investimento | Fase 2 |
| L6 | Lógica "sempre California" para listagem de universidades | Fase 3 |
| L7 | Admin approval flow: AGUARD. APROVAÇÃO status + botões Aprovar/Rejeitar | Fase 3 |
| L8 | Cliente: tela de aguardo com countdown 24h antes de "Escolher Faculdades" | Fase 3 |
| L9 | Tela de faculdades: 12 filtros + até 4 seleções | Fase 4 |
| L10 | Modal de detalhes: 7 seções com calculadora de bolsa interativa | Fase 4 |
| L11 | Admin: seleciona nível de bolsa → gera link Placement Fee automaticamente | Fase 5 |
| L12 | Global Document Requests específicas por tipo (Transfer/COS) + aprovação doc-a-doc | Fase 5 |
| L13 | Geração automática de 7–11 formulários por universidade (IA) | Fase 6 |
| L14 | Assinatura digital com metadata (IP, geolocalização, device fingerprint) | Fase 6 |
| L15 | Integração Migma → MatriculaUSA: envio automático do pacote completo | Fase 6 |
| L16 | Aprovação automática de bolsa: 24h timer (Caroline/Oikos auto-aprova) | Fase 5 |
| L17 | Z-API integration: 14 triggers email + WhatsApp | Fase 8 |
| L18 | Cobrança mensal recorrente com fórmula por instituição/grau/bolsa | Fase 7 |
| L19 | Programa de indicação: link único + Calendly + isenção ao 10º | Fase 7 |
| L20 | Chat IA "Equipe Migma" com base de conhecimento spec v11 | Fase 8 |

### UI/Telas
| ID | Tela | Esforço |
|---|---|---|
| U1 | Cliente: aguardo pós-questionário com countdown 24h | G |
| U2 | Admin: approval dashboard (AGUARD. APROVAÇÃO) | G |
| U3 | Cliente: listagem de faculdades com 12 filtros | XG |
| U4 | Cliente: modal de detalhes com 7 seções e calculadora | XG |
| U5 | Cliente: revisão de seleções (1–4 universidades) | M |
| U6 | Cliente: confirmação definitiva de seleção | P |
| U7 | Admin: aprovação de bolsa com geração de link | G |
| U8 | Cliente: documentos pendentes (Global Requests por tipo) | G |
| U9 | Cliente: dados complementares (20+ campos) | M |
| U10 | Cliente: formulários para assinar (7–11 PDFs + canvas) | XG |
| U11 | Admin: aprovação doc-a-doc | M |
| U12 | Cliente: My Applications (step 4/6) | G |
| U13 | Cliente: notificação Carta de Aceite pronta + gate parcelamento | P |
| U14 | Cliente: programa de indicação com contador real-time | M |
| U15 | Cliente: chat IA com agente Migma | G |

### Automações
| ID | Automação | Status |
|---|---|---|
| A1 | Aprovação automática de bolsa (24h timer) | ❌ Faltando |
| A2–A3 | Alertas prazo Transfer/COS | ✅ Implementado, pendente deploy |
| A4 | Email: contrato aprovado | ⚠️ Parcial |
| A5 | Email + WhatsApp: bolsa aprovada + link Placement Fee | ❌ Faltando |
| A6 | Email + WhatsApp: documentos rejeitados | ❌ Faltando |
| A7 | Email + WhatsApp: Carta de Aceite pronta | ❌ Faltando |
| A8 | Email + WhatsApp: 10 indicações atingidas | ❌ Faltando |
| A9–A11 | WhatsApp: pagamento confirmado, questionário, contrato | ⚠️ Estrutura, sem Z-API |
| A12–A14 | WhatsApp: bolsa, documentos, carta | ❌ Faltando |
| A15–A16 | Cron: casos parados + jornada sem resposta | ✅ Implementado, pendente deploy |
| A17 | Webhook: gate parcelamento Placement Fee (1x vs 2x) | ❌ Faltando |
| A18 | Webhook Calendly → rastreamento indicação | ❌ Faltando |

---

## Plano de Execução por Fases

### FASE 0 — Finalizar Pendências Imediatas
**Objetivo:** Limpar o que está pronto mas não deployado  
**Duração:** 1–2 dias

- [ ] Aplicar migrations `20260407223000`, `20260409143000`, `20260410100000–100002` no remoto
- [ ] Deploy das 7 edge functions (square-webhook, stripe-visa-webhook, parcelow-webhook, send-zelle-webhook, approve-visa-contract, reject-visa-contract, onboarding-sla-cron)
- [ ] Aplicar migration S4 (`selection_survey_completed` generated column)
- [ ] Testar cron `onboarding-sla-cron` manualmente com HTTP trigger

---

### FASE 1 — Schema Foundation (Novas Tabelas)
**Objetivo:** Criar o schema de dados que toda a V11 precisa  
**Duração:** 1–2 semanas  
**Bloqueado por:** decisão de estrutura de dados com o time

- [ ] **S5** — Migration: `institutions` (id, name, slug, city, state, modality, cpt_opt, tuition_per_year, application_fees, bank_statement_required, ESL flag)
- [ ] **S5** — Migration: `institution_courses` (institution_id, course_name, area, degree_level, duration_months)
- [ ] **S5** — Migration: `institution_scholarships` (institution_id, level (1–4), discount_percent, conditions, monthly_usd_formula)
- [ ] **S6** — Migration: `institution_applications` (profile_id, institution_id, scholarship_level, status, placement_fee_paid_at, admin_approved_at, admin_approved_by)
- [ ] **S7** — Migration: `global_document_requests` (profile_id, service_type, document_type, status, requested_at, submitted_at, approved_at, rejection_reason)
- [ ] **S8** — Migration: `institution_forms` (institution_id, form_type, template_url, form_data_json, generated_at, signed_url, signed_at, signature_metadata_json)
- [ ] **S9** — Migration: `referral_links` (profile_id, unique_code, utm_source, clicks, closures_count, created_at)
- [ ] **S10** — Migration: `recurring_charges` (profile_id, institution_id, scholarship_level, monthly_usd, installments_total, installments_paid, start_date, end_date, exempted_by_referral)
- [ ] Seed: inserir as 15 instituições com dados completos (Caroline University, Oikos, e outras 13)
- [ ] Seed: inserir tabelas de bolsa por instituição/grau com valores de tuition mensais

---

### FASE 2 — Ajustes no Checkout e Questionário (V7 → V11)
**Objetivo:** Corrigir os delta de comportamento que V11 altera vs V7  
**Duração:** 1 semana  
**Bloqueado por:** nada

- [ ] **L1/L2** — Verificar/remover pergunta "tipo de processo" em `migmaSurveyQuestions.ts`; garantir que `service_type` vem da URL
- [ ] **L3** — Validação "exatamente 2" para áreas de interesse: ao 2ª seleção, desabilitar demais; bloquear avanço se < 2
- [ ] **L4** — Validação "exatamente 2" para frequência das aulas
- [ ] **L5** — Validação "exatamente 2" para faixas de investimento anual
- [ ] Testes de regressão no fluxo de checkout existente (não quebrar o que funciona)

---

### FASE 3 — Fluxo Pós-Questionário: Aprovação de Perfil
**Objetivo:** Implementar o pipeline de aprovação bilateral (item 6 da spec v11)  
**Duração:** 1–2 semanas  
**Bloqueado por:** Fase 0 (deploy), decisão sobre aprovação automática vs manual

- [ ] **L7** — Campo `profile_approval_status` em `user_profiles` (pending_review / approved / rejected)
- [ ] **L7** — Admin: novo card/aba "AGUARD. APROVAÇÃO" no CRM board com botões Aprovar/Rejeitar
- [ ] **L7** — Edge function ou mutation: admin aprova → atualiza status + envia email automático ao cliente
- [ ] **L8** — Cliente: tela de aguardo pós-questionário com countdown 24h e próximos passos (**U1**)
- [ ] **L8** — Frontend: botão "Escolher Faculdades" desabilitado até `profile_approval_status = 'approved'`
- [ ] **U2** — Admin UI: verificação de identidade pendente (selfie), histórico de aprovações
- [ ] **A4** — Email automático: contrato aprovado com próximos passos

---

### FASE 4 — Tela de Escolha de Faculdades
**Objetivo:** Implementar o catálogo completo e fluxo de seleção (item 7 da spec v11)  
**Duração:** 2–3 semanas  
**Bloqueado por:** Fase 1 (schema de instituições), Fase 3 (aprovação de perfil)

- [ ] **U3** — Rota `/student/universities` com listagem de 15 instituições
- [ ] **U3** — 12 filtros: palavra-chave, universidade, nível de estudo, área de interesse, modalidade, frequência, trabalho, faixa de valor (min/max)
- [ ] **U3** — Cards de universidade: nome, cidade/estado, modalidade, bolsa disponível, application fee, status badge
- [ ] **U3** — **L6** — Lógica interna: sempre retornar apenas instituições California (nota da spec)
- [ ] **U4** — Modal de detalhes: 7 seções (identidade, bolsa interativa, calculadora de pagamento, programa, requisitos, FAQ, indicação)
- [ ] **U4** — Calculadora de bolsa: 4 níveis de bolsa com highlight dinâmico ao selecionar
- [ ] **U4** — Calculadora "quanto vou pagar?": 4 momentos (AGORA $400, APÓS ACEITE placement fee, AO INICIAR tuition mensal, ANUALMENTE tuition anual)
- [ ] **U4** — **L9** — Lógica: ao 4ª seleção, impedir novas; badge "Selecionada" no card
- [ ] **U5** — Tela de revisão: lista de 1–4 seleções com botão X para remover
- [ ] **U6** — Modal de confirmação definitiva com aviso de irrevogabilidade

---

### FASE 5 — Aprovação de Bolsa + Placement Fee + Documentação
**Objetivo:** Implementar o pipeline operacional pós-seleção de faculdades (itens 8 e 9)  
**Duração:** 2–3 semanas  
**Bloqueado por:** Fase 4, Fase 1 (S6, S7)

- [ ] **L11** — Admin: `institution_applications` com `admin_approved_scholarship_level` e status
- [ ] **U7** — Admin UI: card "AGUARD. APROVAÇÃO DE BOLSA", 4 opções radio (bolsa 25/50/75/100%), botão "Aprovar Bolsa"
- [ ] **L11** — Ao aprovar: edge function gera link de pagamento Placement Fee automaticamente (Square ou Parcelow, baseado em nationality do cliente)
- [ ] **L16** — Cron: verificar `institution_applications` com seleção há 24h → se Caroline ou Oikos → aprovar automaticamente; outros → flag para revisão humana
- [ ] **A5** — Email + WhatsApp: "Bolsa aprovada! Seu próximo passo é pagar o Placement Fee" + link gerado
- [ ] **L12** — Após Placement Fee pago: liberar "Documentos Pendentes" no dashboard cliente
- [ ] **U8** — Cliente: seção "Documentos Pendentes" com lista específica por tipo (Transfer: 8 docs; COS: 10 docs)
- [ ] **U9** — Cliente: seção "Dados Complementares" com 20+ campos (contato emergência, sponsor, recomendantes, experiência profissional, etc)
- [ ] **U11** — Admin: aprovação doc-a-doc com botões Aprovar/Solicitar Correção e notificação automática
- [ ] **A6** — Email + WhatsApp: documentos rejeitados com detalhes do que corrigir

---

### FASE 6 — Formulários Automáticos + Assinatura Digital + MatriculaUSA
**Objetivo:** Geração automática de formulários, assinatura e integração com MatriculaUSA (itens 10 e 11)  
**Duração:** 3–4 semanas  
**Bloqueado por:** Fase 5, Fase 1 (S8), mapeamento de templates por instituição

- [ ] **L13** — Edge function: `generate-institution-forms` — monta PDFs usando template por universidade + dados do cliente (Step 1, Step 2, questionário)
- [ ] **L13** — Templates por universidade: 7–11 formulários cada (Application, I-20 Request, Financial Statement, Transfer Form, Enrollment Agreement, Release SEVIS, Sponsor Letter, Promissory Note, etc)
- [ ] **L13** — Preenchimento automático de 30+ campos com IA (nome, data nascimento, endereço, número de documento, informações acadêmicas)
- [ ] **L14** — Canvas de assinatura digital estendido: captura de IP (via edge function), geolocalização (via browser), device fingerprint (via fingerprint.js ou similar), timestamp assinado
- [ ] **U10** — Cliente: seção "Formulários para Assinar" com lista de PDFs, preview, canvas por documento
- [ ] **L15** — Edge function: `send-to-matricula` — monta payload completo (cliente + documentos + formulários assinados) + chama API MatriculaUSA
- [ ] **A7** — Email + WhatsApp: "Sua Carta de Aceite está pronta!" após retorno do MatriculaUSA
- [ ] **U13** — Cliente: notificação destacada "Carta de Aceite pronta!" com gate de parcelamento Placement Fee (se 2x, aguardar 2ª parcela)
- [ ] **A17** — Webhook: gate financeiro — se Placement Fee 2x → aguardar 2ª parcela antes de liberar carta

---

### FASE 7 — Cobrança Mensal + Programa de Indicação
**Objetivo:** Implementar módulos financeiros recorrentes (itens 14 e 15)  
**Duração:** 2–3 semanas  
**Bloqueado por:** Fase 5 (Placement Fee aprovado), Fase 1 (S9, S10)

- [ ] **L18** — Módulo de cobrança recorrente: `start-recurring-billing` edge function
- [ ] **L18** — Fórmula: (tuition_com_bolsa - base_migma) / 12 — tabelas por instituição/grau/bolsa
- [ ] **L18** — Duração: 48 parcelas (Bacharelado) ou 24 parcelas (Mestrado/ESL)
- [ ] **L18** — Integração com gateways existentes (Square/Parcelow/Stripe) para cobrança automática mensal
- [ ] **L19** — Sistema de indicação: geração de link único com UTM por profile_id
- [ ] **L19** — Integração Calendly: webhook `calendly-referral-webhook` — ao agendar, identifica código de indicador e incrementa `closures_count`
- [ ] **L19** — Ao 10º fechamento: trigger automático zera tuition recorrente + notificação
- [ ] **U14** — Cliente: seção "Programa de Indicação" com link único, botões de compartilhamento, contador de indicações em tempo real
- [ ] **A8** — Email + WhatsApp: "Parabéns! Você atingiu 10 indicações — sua mensalidade foi zerada!"
- [ ] **A18** — Webhook: Calendly → rastreamento de indicação

---

### FASE 8 — Notificações Completas (Z-API) + Chat IA
**Objetivo:** Fechar todos os 14 triggers de notificação e implementar o chat IA  
**Duração:** 1–2 semanas  
**Bloqueado por:** Decisão sobre provedor WhatsApp (Z-API ou outro), acesso à API Claude/GPT

- [ ] **L17** — Integração Z-API: credenciais, edge function `send-whatsapp`, templates de mensagem para 14 triggers
- [ ] **A9–A14** — Implementar todos os triggers de WhatsApp restantes
- [ ] **L20** — Edge function: `migma-ai-chat` com Claude API, system prompt baseado em spec v11 + base de conhecimento institucional
- [ ] **U15** — Cliente: seção "Suporte" com chat widget, apresentação como "Equipe Migma", escalação para humano
- [ ] Testes E2E de todas as notificações com dados reais

---

### FASE 9 — QA, Testes e Deploy
**Objetivo:** Garantir estabilidade antes de produção  
**Duração:** 1–2 semanas

- [ ] Testes E2E: fluxo completo checkout → questionário → faculdades → documentos → formulários → assinatura → MatriculaUSA → cobrança
- [ ] Load testing: múltiplos clientes simultâneos
- [ ] Testes de regressão: V7 (checkout, webhooks) não quebrado por V11
- [ ] Deploy: staging → homologação com team → produção

---

## Árvore de Dependências (Resumida)

```
Fase 0 (deploy pendências)
  └─ Fase 1 (schema novas tabelas)
       ├─ Fase 2 (ajustes checkout/questionário) — independente de Fase 1
       ├─ Fase 3 (aprovação de perfil) — depende de Fase 0
       │    └─ Fase 4 (escolha de faculdades) — depende de Fase 1 + 3
       │         └─ Fase 5 (bolsa + documentação) — depende de Fase 4
       │              └─ Fase 6 (formulários + MatriculaUSA) — depende de Fase 5
       │                   └─ Fase 7 (cobrança + indicação) — depende de Fase 5 + 6
       └─ Fase 8 (notificações + chat IA) — pode rodar em paralelo após Fase 3
  └─ Fase 9 (QA + deploy) — after all
```

**Paralelos possíveis:**
- Fase 2 pode rodar desde já (zero dependências)
- Fase 8 (Z-API integration) pode começar em paralelo com qualquer fase após decisão de provedor
- Schema (Fase 1) pode ser construído em paralelo com Fase 2 e 3
- Chat IA (L20/U15) pode começar após ter acesso à API

---

## Decisões Necessárias (Antes de Iniciar)

1. **Aprovação de perfil: automática (24h) ou sempre manual?** — impacta Fase 3 e L16
2. **Provedor WhatsApp: Z-API ou outro?** — impacta Fase 8 e todas as notificações
3. **IA do chat: Claude API ou outro modelo?** — impacta L20/U15
4. **Mapeamento de formulários: templates existem ou precisam ser criados?** — impacta Fase 6 inteira
5. **API MatriculaUSA: endpoint/contrato disponível?** — impacta L15 e Fase 6
6. **Aprovação automática de bolsa: quais universidades além de Caroline/Oikos?** — impacta L16
7. **Quem faz o quê: este time ou outro dev implementa partes do V11?** — impacta priorização das fases

---

## Estimativa de Esforço

| Fase | Descrição | Duração |
|---|---|---|
| 0 | Deploy pendências | 1–2 dias |
| 1 | Schema novas tabelas + seed | 1–2 semanas |
| 2 | Ajustes checkout/questionário | 1 semana |
| 3 | Fluxo pós-questionário (aprovação perfil) | 1–2 semanas |
| 4 | Escolha de faculdades | 2–3 semanas |
| 5 | Aprovação bolsa + documentação | 2–3 semanas |
| 6 | Formulários + assinatura + MatriculaUSA | 3–4 semanas |
| 7 | Cobrança recorrente + indicação | 2–3 semanas |
| 8 | Notificações Z-API + chat IA | 1–2 semanas |
| 9 | QA + deploy | 1–2 semanas |
| **Total** | | **12–16 semanas** |
