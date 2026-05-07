# MIGMA v11 — Tasks por Fase
**Base:** migma_spec_v11_clean.md | **Atualizado em:** 2026-04-16  
**Status das seções:** ✅ Seções 1–5 completas | 🔴 Seções 6–15 pendentes

> ⚠️ **Decisões em aberto antes de codar:**
> - MatriculaUSA: manual (admin faz upload — spec 11.6) ou automático via API (spec 13.1)?
> - WhatsApp: Z-API ou equivalente?
> - Chat IA: Claude API ou outra?
> - COS pós-I-20 (Seção 14.5): fluxo PENDENTE de documentação

---

## FASE 0 — Deploy de Pendências Imediatas
**Spec:** N/A (infraestrutura) | **Duração estimada:** 1–2 dias

- [ ] **F0-01** Aplicar migrations pendentes no remoto: `20260407223000`, `20260409143000`, `20260410100000–100002`
- [ ] **F0-02** Deploy das 7 edge functions: `square-webhook`, `stripe-visa-webhook`, `parcelow-webhook`, `send-zelle-webhook`, `approve-visa-contract`, `reject-visa-contract`, `onboarding-sla-cron`
- [ ] **F0-03** Aplicar migration `selection_survey_completed` (generated column em `user_profiles`)
- [ ] **F0-04** Testar cron `onboarding-sla-cron` manualmente via HTTP trigger

---

## FASE 1 — Schema Foundation (Novas Tabelas)
**Spec:** Seções 7, 8, 9, 11, 12, 14, 15 | **Duração estimada:** 1–2 semanas  
**Bloqueado por:** decisão de estrutura com o time

### S1 — Tabela `institutions`
- [ ] **F1-S1-01** Migration: `institutions` (id, name, slug, city, state, modality, cpt_opt, application_fee_usd, bank_statement_min_usd, bank_stmt_per_dep_usd, esl_flag, accepts_cos, accepts_transfer, highlight_badge, created_at)
- [ ] **F1-S1-02** Migration: `institution_courses` (institution_id, course_name, area, degree_level, duration_months, cpt_after_months)  
- [ ] **F1-S1-03** Migration: `institution_scholarships` (institution_id, placement_fee_usd, discount_percent, tuition_annual_usd, monthly_migma_usd, installments_total)
- [ ] **F1-S1-04** Seed: Caroline University (dados completos — spec seção 10.3 + 15.2)
- [ ] **F1-S1-05** Seed: Oikos University (dados completos — spec seção 10.3 + 15.3)
- [ ] **F1-S1-06** Seed: CSI, Trine University (dados disponíveis — spec seção 10.3)
- [ ] **F1-S1-07** Seed: American National, Excel, ILI, ALA, Internexus, AAE (dados parciais — completar com Guia Interno)
- [ ] **F1-S1-08** Seed: 5 escolas ESL — CSI ESL, Uceda (4 unidades) (spec seção 10.2)

### S2 — Tabela `institution_applications`
- [ ] **F1-S2-01** Migration: `institution_applications` (profile_id, institution_id, scholarship_level_id, status, placement_fee_paid_at, placement_fee_installments, admin_approved_at, admin_approved_by, created_at)
- [ ] **F1-S2-02** RLS: cliente só vê próprios registros; admin vê todos

### S3 — Tabela `global_document_requests`
- [ ] **F1-S3-01** Migration: `global_document_requests` (profile_id, service_type [transfer/cos], document_type, status [pending/submitted/approved/rejected], requested_at, submitted_at, submitted_url, approved_at, rejection_reason)
- [ ] **F1-S3-02** RLS + índices necessários

### S4 — Tabela `institution_forms`
- [ ] **F1-S4-01** Migration: `institution_forms` (institution_id, profile_id, form_type, template_url, form_data_json, generated_at, signed_url, signed_at, signature_metadata_json [ip, geo, device, timestamp])
- [ ] **F1-S4-02** RLS + índices necessários

### S5 — Tabela `referral_links`
- [ ] **F1-S5-01** Migration: `referral_links` (profile_id, unique_code, utm_source, clicks, closures_count, created_at)
- [ ] **F1-S5-02** Unique constraint em `unique_code`

### S6 — Tabela `recurring_charges`
- [ ] **F1-S6-01** Migration: `recurring_charges` (profile_id, institution_id, scholarship_level_id, monthly_usd, installments_total, installments_paid, start_date, end_date, exempted_by_referral, created_at)
- [ ] **F1-S6-02** RLS + índices necessários

---

## FASE 2 — Ajustes no Questionário (V7 → V11)
**Spec:** Seção 5 | **Duração estimada:** 1 semana  
**Bloqueado por:** nada (pode começar imediatamente)

- [ ] **F2-01** Remover pergunta "Qual o tipo de processo desejado?" de `migmaSurveyQuestions.ts` — tipo vem da URL (spec 5, regra de URL)
- [ ] **F2-02** Garantir que `service_type` é lido da URL e persistido no questionário sem input manual do usuário
- [ ] **F2-03** Validação "exatamente 2" para Áreas de Interesse: ao 2ª seleção bloquear demais; impedir avanço se < 2 (spec 5.1)
- [ ] **F2-04** Validação "exatamente 2" para Frequência das Aulas (spec 5.1)
- [ ] **F2-05** Validação "exatamente 2" para Faixas de Investimento Anual (spec 5.1)
- [ ] **F2-06** Validação "exatamente 3" para Regiões de Preferência (spec 5.1) — nota: universidades sempre California internamente
- [ ] **F2-07** Tela de conclusão: botão "Escolher Faculdades" desabilitado + countdown 24h (spec 5.7)
- [ ] **F2-08** Testes de regressão: fluxo completo checkout + questionário sem quebras

---

## FASE 3 — Pós-Questionário: Aprovação Bilateral de Perfil
**Spec:** Seção 6 | **Duração estimada:** 1–2 semanas  
**Bloqueado por:** Fase 0 (deploy)

### Cliente — Tela de espera (spec 6.2)
- [ ] **F3-C01** Tela de conclusão do questionário: card "Aguardando análise do seu perfil..." com countdown 24h
- [ ] **F3-C02** Botão "Escolher Faculdades" desabilitado até `profile_approval_status = 'approved'`
- [ ] **F3-C03** Email automático confirmando recebimento do perfil (spec 6.2)
- [ ] **F3-C04** WhatsApp automático: "Perfil recebido! Em até 24h você saberá quais universidades pré-aceitaram você" (spec 6.2)

### Admin — Aprovação de Contrato (spec 6.3)
- [ ] **F3-A01** Campo `profile_approval_status` em `user_profiles`: pending_review / approved / rejected
- [ ] **F3-A02** Admin: novo card/aba "AGUARD. APROVAÇÃO" no CRM board
- [ ] **F3-A03** Admin: exibir Terms aceitos (data + hora) + selfie com documento (status Pending Review) + assinatura digital capturada
- [ ] **F3-A04** Botões de ação: Aprovar (verde) / Rejeitar (vermelho) com confirmação modal
- [ ] **F3-A05** Ao aprovar: registrar timestamp + IP do admin no banco (spec 6.3)
- [ ] **F3-A06** Edge function: admin aprova → atualiza `profile_approval_status` → email padrão Migma com contrato para o cliente (spec 6.3)
- [ ] **F3-A07** WhatsApp automático ao cliente: "Seu perfil foi aprovado! Acesse sua conta para escolher sua universidade" (spec 6.4)
- [ ] **F3-A08** Status do card admin atualizado para "AGUARD. ESCOLHA DE FACULDADE" (spec 6.4)
- [ ] **F3-A09** Botão "Escolher Faculdades" liberado no dashboard do cliente (spec 6.4)

---

## FASE 4 — Tela de Escolha de Faculdades
**Spec:** Seção 7 | **Duração estimada:** 2–3 semanas  
**Bloqueado por:** Fase 1 (schema instituições), Fase 3 (aprovação de perfil)

### Listagem e Filtros (spec 7.1 a 7.4)
- [ ] **F4-L01** Rota `/student/universities` acessível somente após aprovação de perfil
- [ ] **F4-L02** Cabeçalho: "De 1.481 instituições candidatadas, X universidades confirmaram pré-aceite" (spec 10, narrativa)
- [ ] **F4-L03** Lógica interna: exibir sempre instituições da California (L6 — spec 5.1, nota interna de regiões)
- [ ] **F4-L04** ESL branch: se nível de inglês = Zero ou Básico no questionário → exibir escolas ESL também (spec 10.2)
- [ ] **F4-L05** ESL manual: admin pode indicar ESL para um candidato específico no dashboard (spec 10.2)
- [ ] **F4-L06** Filtro: palavra-chave (busca livre por nome de bolsa ou curso)
- [ ] **F4-L07** Filtro: universidade (select com lista das instituições disponíveis)
- [ ] **F4-L08** Filtro: nível de estudo (Graduação / Pós-Graduação / Doutorado)
- [ ] **F4-L09** Filtro: área de estudo (56 cursos do catálogo Migma)
- [ ] **F4-L10** Filtro: modalidade (Híbrido / Presencial — remover Online conforme spec 7.3)
- [ ] **F4-L11** Filtro: frequência — exibir SOMENTE quando modalidade = Híbrido (spec 7.3, nota dev)
- [ ] **F4-L12** Filtro: permissão de trabalho (OPT / CPT / Ambos)
- [ ] **F4-L13** Filtro: valor mínimo e valor máximo de tuition com bolsa
- [ ] **F4-L14** Cards: logo, nome, localização, modalidade, OPT/CPT, badge (Destaque/Exclusivo/Esgotada), preço original, com bolsa, desconto %, taxa de colocação (spec 7.4)
- [ ] **F4-L15** Lógica de seleção: máximo 4 universidades; ao 4ª, bloquear novas seleções; badge "Selecionada" no card

### Modal de Detalhes (spec 7.5)
- [ ] **F4-M01** Seção 1 — Identificação: logo, nome, localização, site oficial, badges Aceita COS / Aceita Transfer
- [ ] **F4-M02** Seção 2 — Tabela de bolsa interativa: linhas selecionáveis (dourado), colunas Tuition Anual | % Desconto | Placement Fee; calculadora "você economiza $Y no total"; badge "Mais Popular"
- [ ] **F4-M03** Seção 3 — "Quanto vou pagar?" com 4 momentos:
  - AGORA: Placement Fee selecionado
  - APÓS ACEITE: Application Fee $350 + $100/dep (spec 7.5 + 9.1)
  - AO INICIAR: Orientation Day $300 + Teste de Inglês $50 se aplicável (spec 7.5)
  - ANUALMENTE: Tuition com bolsa escolhida
  - Calculadora: investimento estimado no primeiro ano
- [ ] **F4-M04** Seção 4 — Programa: tipos de curso, duração, CPT (linguagem simples), OPT, frequência presencial
- [ ] **F4-M05** Seção 5 — Requisitos: GPA mínimo, proficiência inglês, documentação necessária
- [ ] **F4-M06** Seção 6 — FAQ Inline: O que é Placement Fee? | CPT e OPT? | Posso mudar de bolsa? | O que acontece se não for aprovado?
- [ ] **F4-M07** Seção 7 — Benefício por Indicação: 10 indicações = tuition $3.800/ano
- [ ] **F4-M08** Botão "Selecionar" ativo somente após escolher nível de bolsa na tabela interativa

### Revisão e Confirmação (spec 7.6 + 7.7)
- [ ] **F4-R01** Tela de revisão: lista de 1–4 seleções (Universidade | Curso | Nível de Bolsa | Placement Fee | Tuition anual) com botão X para remover
- [ ] **F4-R02** Aviso: "Esta é uma escolha definitiva. Ao confirmar, não será possível alterar."
- [ ] **F4-R03** Modal de confirmação definitiva com botão Confirmar e link Revisar Novamente

---

## FASE 5 — Aprovação de Bolsa + Placement Fee + Documentação
**Spec:** Seções 8, 9, 11.4, 11.5 | **Duração estimada:** 2–3 semanas  
**Bloqueado por:** Fase 4, Fase 1 (S2, S3)

### Aprovação de Bolsa — Admin (spec seção 8)
- [ ] **F5-A01** Admin: card "AGUARD. APROVAÇÃO DE BOLSA" com as 4 seleções do cliente (curso + bolsa + Placement Fee)
- [ ] **F5-A02** Admin: exibir perfil completo do cliente (questionário, documentos, área, formação, prazo Transfer/COS)
- [ ] **F5-A03** Admin: selecionar qual das 4 opções será aprovada + botão "Aprovar Bolsa"
- [ ] **F5-A04** Ao aprovar: sistema gera link de pagamento do Placement Fee automaticamente (Square ou Parcelow conforme nacionalidade)
- [ ] **F5-A05** Automação Caroline/Oikos (spec 13.2): cron verifica `institution_applications` com seleção há 24h → Caroline na lista → aprova automaticamente; só Oikos → aprova automaticamente; nenhuma das duas → alerta humano imediato + timer 24h
- [ ] **F5-A06** Email ao cliente: "Bolsa aprovada! [Universidade] — [Curso] — Bolsa [X%] — Placement Fee $[valor]" + link de pagamento (spec 8.3)
- [ ] **F5-A07** WhatsApp ao cliente: mesma mensagem com link direto para pagamento (spec 8.3)
- [ ] **F5-A08** Status admin atualizado para "AGUARD. PAGAMENTO PLACEMENT FEE"

### Trava Financeira Placement Fee (spec 14.3)
- [ ] **F5-T01** Registrar se Placement Fee foi pago em 1x ou 2x
- [ ] **F5-T02** Se 2x: armazenar status da 2ª parcela; gate = aguardar 2ª parcela antes de liberar carta de aceite (webhook A17)
- [ ] **F5-T03** Frontend: exibir "Para liberar sua carta, realize o pagamento da 2ª parcela" quando aplicável

### Documentos — Pós Placement Fee (spec seções 9.1–9.3 e 11.5)
> ⚠️ Bank Statement solicitado APÓS Placement Fee — estratégia intencional para evitar objeção financeira (spec 9.1)

- [ ] **F5-D01** Ao confirmar pagamento do Placement Fee: gerar automaticamente `global_document_requests` para o tipo de processo do cliente (Transfer ou COS)
- [ ] **F5-D02** Dashboard cliente: seção "Documentos Pendentes" com lista específica por tipo
  - Transfer: Passaporte, I-20 escola atual, I-94, Cópia visto F-1, Histórico/Diploma, Bank Statement ($22k+$5k/dep), Endereço EUA, Endereço BR, Certidão casamento/filhos se dependentes
  - COS: Passaporte/visto, I-94, Transcrito traduzido, Proof address EUA, Proof address BR, I-797A se aplicável, Certidão casamento/filhos se dependentes
- [ ] **F5-D03** Card explicativo Bank Statement (spec 9.2): "NÃO é o valor que você vai gastar. É comprovação para imigração..."
- [ ] **F5-D04** Preview + validação de formato e tamanho após cada upload
- [ ] **F5-D05** Admin: notificação de novo documento enviado (email + WhatsApp) (spec 9.3)
- [ ] **F5-D06** Admin: aprovação doc-a-doc com botões Aprovar / Solicitar Correção + campo de justificativa
- [ ] **F5-D07** Se rejeitado: email + WhatsApp ao cliente com detalhes do que corrigir (spec 9.3)
- [ ] **F5-D08** Ao aprovar todos: status "DOCUMENTAÇÃO APROVADA" + sistema gera link Application Fee ($350 + $100/dep) automaticamente (spec 9.3)
- [ ] **F5-D09** Notificação ao cliente: "Documentos aprovados! Próximo passo: pagamento da Taxa I-20 ($350)" (spec 9.3)

### Dados Complementares (spec 11.4)
- [ ] **F5-C01** Dashboard cliente: seção "Dados Complementares" liberada após aprovação de bolsa
- [ ] **F5-C02** Formulário: contato de emergência (nome, telefone, relacionamento, endereço)
- [ ] **F5-C03** Formulário: início de aulas preferido (Spring/Summer/Fall + ano)
- [ ] **F5-C04** Formulário: sponsor financeiro (radio Sim/Não) → campos condicionais (nome, relacionamento, telefone, endereço, empregador, cargo, anos, renda anual, valor comprometido/ano)
- [ ] **F5-C05** Formulário: experiência profissional (até 3 entradas: empresa/igreja, período, cargo)
- [ ] **F5-C06** Formulário: recomendante 1 (nome, cargo/posição, telefone ou email) — obrigatório
- [ ] **F5-C07** Formulário: recomendante 2 (condicional — apenas Caroline) (spec 11.4)

---

## FASE 6 — Formulários Automáticos + Assinatura Digital + MatriculaUSA
**Spec:** Seções 9.4, 11.1–11.3, 11.6, 13.1 | **Duração estimada:** 3–4 semanas  
**Bloqueado por:** Fase 5, Fase 1 (S4), decisão sobre MatriculaUSA (manual vs API)

> ⚠️ **Contradição crítica na spec — RESOLVER ANTES:**  
> Seção 11.6 diz "Admin baixa o pacote e envia via integração ao MatriculaUSA" (manual)  
> Seção 13.1 diz "Zero intervenção humana nessa etapa" (automático via API)  
> Qual é o modelo correto?

### Geração dos Formulários (spec 9.4 + 11.1 + 11.2)
- [ ] **F6-G01** Edge function `generate-institution-forms`: monta PDFs usando template por universidade + dados do cliente
- [ ] **F6-G02** Caroline University — gerar automaticamente: Application for Admission, I-20 Request Form, Statement of Institutional Purpose, Statement of Understanding, Tuition Refund Policy, Affidavit of Financial Support (se sponsor), Letter of Recommendation, Scholarship Support & Compliance Agreement
  - Campo Agency = sempre MIGMA INC (spec 11.1, IMPORTANTE)
  - Termo de Responsabilidade do Estudante = documento INTERNO, não vai para faculdade
- [ ] **F6-G03** Oikos University — gerar automaticamente: Application for Admission, I-20 Request Form, Statement of Institutional Purpose, Statement of Faith, Code of Conduct, Refund Policy, Agreement to Complete Mandatory Intensives, Christian Faith Statement (cliente edita), Letter of Recommendation, Affidavit of Financial Support (se sponsor), Enrollment Agreement
- [ ] **F6-G04** Preenchimento automático com dados já coletados (spec 11.3, mapeamento completo):
  - Nome (Last/First/Middle) ← Step 1 + passaporte
  - Data de nascimento, endereço, estado civil, nacionalidade ← Step 2
  - Email, WhatsApp ← Step 1
  - Tipo de visa/processo ← URL do serviço
  - Curso/Degree ← Escolha de faculdades
  - Gênero, local de nascimento ← IA extrai do passaporte
  - Endereço EUA/BR ← Global Documents
  - Dados dependentes ← Certidões traduzidas
  - "Como soube da universidade" = sempre: Brant Immigration
  - Data atual ← sistema

### Assinatura Digital com Metadata (spec 11.6 + L14)
- [ ] **F6-S01** Dashboard cliente: seção "Formulários para Assinar" com lista de PDFs, preview por documento
- [ ] **F6-S02** Canvas de assinatura digital por documento (mobile: dedo, desktop: mouse)
- [ ] **F6-S03** Durante assinatura: captura de IP (via edge function), geolocalização (via browser), device fingerprint, timestamp — tudo salvo em `signature_metadata_json`
- [ ] **F6-S04** Carta de Recomendação: instrução didática ("esta carta deve ser preenchida por professor/pastor/supervisor") — cliente entrega ao recomendante que preenche e devolve
- [ ] **F6-S05** Scholarship Support & Compliance Agreement: espaço para assinatura do representante Migma
- [ ] **F6-S06** Após todos assinados: notificação automática para admin Migma
- [ ] **F6-S07** Admin: painel de revisão + download do pacote completo

### Envio para MatriculaUSA (spec 11.6 + 13.1)
- [ ] **F6-M01** Se modelo manual: admin faz upload/envio via integração ao MatriculaUSA (spec 11.6)
- [ ] **F6-M02** Se modelo API: edge function `send-to-matricula` monta payload completo e envia automaticamente (spec 13.1)
- [ ] **F6-M03** MatriculaUSA processa → Caroline/Oikos emite carta de aceite e Transfer Form

### Pós-MatriculaUSA (spec 14.3)
- [ ] **F6-P01** Sistema recebe retorno do MatriculaUSA → carta de aceite pronta
- [ ] **F6-P02** Verificar trava financeira: se Placement Fee 2x → gate aguardando 2ª parcela
- [ ] **F6-P03** Email + WhatsApp ao cliente: "Sua Carta de Aceite está pronta!" (ou "efetue a 2ª parcela para liberar")
- [ ] **F6-P04** Dashboard cliente: destaque "Carta de Aceite pronta!" com download disponível
- [ ] **F6-P05** Transfer Form: instrução didática exibida ("entregue à sua escola atual para solicitar liberação do SEVIS")
- [ ] **F6-P06** Campo de confirmação: "Já entreguei o Transfer Form para minha escola atual ✓"
- [ ] **F6-P07** Ao confirmar entrega: notificação automática para admin Migma
- [ ] **F6-P08** Transfer: escola atual libera SEVIS → novo I-20 emitido → status "TRANSFER CONCLUÍDO"
- [ ] **F6-P09** COS pós-I-20: ⚠️ PENDENTE DE DOCUMENTAÇÃO (spec 14.5 — Form I-539, Cover Letter, USCIS)

---

## FASE 7 — Cobrança Mensal Recorrente + Programa de Indicação
**Spec:** Seções 12.2, 13.2 parcial, 15 | **Duração estimada:** 2–3 semanas  
**Bloqueado por:** Fase 5 (Placement Fee aprovado), Fase 1 (S5, S6)

### Cobrança Recorrente (spec seção 15)
- [ ] **F7-R01** Edge function `start-recurring-billing`: iniciada após conclusão da matrícula (Transfer: 1 mês após carta de aceite; COS: 1 mês após aprovação USCIS)
- [ ] **F7-R02** Fórmula: `(tuition_anual_com_bolsa - tuition_base_migma) / 12`
  - Base Migma Bacharelado: $3.800/ano
  - Base Migma Mestrado (MBA/Business/Filosofia/Teologia): $4.200/ano
  - Base Migma Mestrado CS: $5.500/ano
- [ ] **F7-R03** Tabela de mensalidades por Placement Fee (independente de universidade — spec 15.4):
  - $200 PF → $525/mês
  - $600 PF → $420/mês
  - $1.000 PF → $315/mês
  - $1.400 PF → $210/mês
  - $1.800 PF → $105/mês (Bach/CS) ou $100/mês (MBA Caroline)
- [ ] **F7-R04** Duração: Bacharelado = 48 parcelas | Mestrado = 24 parcelas (spec 15.4)
- [ ] **F7-R05** Regra de perda de bolsa (spec 15.6): se cliente perde bolsa da universidade (GPA < 3.5), mensalidade Migma NÃO muda — cliente arca com tuition cheia por conta própria
- [ ] **F7-R06** Integração com gateways existentes (Square/Parcelow) para cobrança automática mensal
- [ ] **F7-R07** Notificação antes de cada vencimento: email + WhatsApp

### Isenção por Indicações (spec 15.5)
- [ ] **F7-I01** Ao atingir 10 indicações fechadas: zerar `monthly_usd` em `recurring_charges` + parar cobranças automaticamente
- [ ] **F7-I02** Email + WhatsApp: "Parabéns! Você atingiu 10 indicações. Sua mensalidade Migma foi zerada."
- [ ] **F7-I03** Nota: tuition paga diretamente à universidade não é afetada

### Programa de Indicação (spec seção 12.2)
- [ ] **F7-P01** Geração de link único de indicação com tracking por `profile_id` (UTM)
- [ ] **F7-P02** Link leva para página com Calendly para agendamento com time de vendas
- [ ] **F7-P03** Webhook `calendly-referral-webhook`: ao agendar → identifica código do indicador → salva no lead
- [ ] **F7-P04** Quando admin marca lead como fechado no CRM → credita +1 em `closures_count` do referral
- [ ] **F7-P05** Dashboard cliente: seção "Programa de Indicação" com link único, botões de compartilhamento (WhatsApp, Email, copiar), contador de indicações em tempo real
- [ ] **F7-P06** Compartilhamento rápido: WhatsApp, Email, copiar link
- [ ] **F7-P07** Ao atingir 10 indicações: trigger automático zera tuition recorrente (F7-I01) + notificação

---

## FASE 8 — Notificações Completas (Z-API) + Chat IA
**Spec:** Seções 12.3, 13.3 | **Duração estimada:** 1–2 semanas  
**Bloqueado por:** decisão sobre provedor WhatsApp e API de IA

### Integração Z-API / WhatsApp (spec 13.3)
- [ ] **F8-W01** Configurar credenciais Z-API (ou equivalente)
- [ ] **F8-W02** Edge function `send-whatsapp` reutilizável com template e número destino
- [ ] **F8-W03** Implementar todos os 14 triggers de notificação dual (email + WhatsApp) conforme spec 13.3:
  1. Pagamento Taxa Processo Seletivo confirmado
  2. Questionário recebido — perfil enviado às 1.481 instituições
  3. Contrato aprovado pelo admin
  4. Bolsa aprovada + link Placement Fee gerado
  5. Placement Fee pago — solicitação de documentos
  6. Documento rejeitado + detalhes correção
  7. Todos documentos aprovados + link Application Fee
  8. Formulários gerados — enviados para assinatura
  9. Pacote assinado enviado ao MatriculaUSA
  10. Nova pendência criada pelo admin
  11. Alertas prazo Transfer (30, 15, 7 e 1 dia)
  12. Alertas prazo COS/I-94 (60, 30, 15 e 7 dias)
  13. Dependentes: pendência de dados/documentos
  14. Meta 10 indicações atingida — tuition reduzida
  - Extras admin: novos documentos recebidos, pacote pronto para MatriculaUSA, alerta sem Caroline/Oikos

### Chat IA — Agente "Equipe Migma" (spec 12.3)
- [ ] **F8-AI01** Edge function `migma-ai-chat` com Claude API (ou equivalente)
- [ ] **F8-AI02** System prompt baseado em spec v11 + guia de instituições + prompts internos Migma
- [ ] **F8-AI03** Agente responde sobre: processo, documentos, universidades, bolsas, pagamentos, visto F-1, COS, Transfer
- [ ] **F8-AI04** Dashboard cliente: seção "Suporte" com chat widget apresentado como "Equipe Migma" (nunca revelar que é IA — spec 12.3)
- [ ] **F8-AI05** Escalação para humano quando IA identificar problema grave não resolvível

---

## FASE 9 — QA, Testes e Deploy
**Duração estimada:** 1–2 semanas

- [ ] **F9-01** Testes E2E: fluxo completo Checkout → Questionário → Aprovação Perfil → Faculdades → Bolsa → Documentos → Dados Complementares → Formulários → Assinatura → MatriculaUSA → Carta de Aceite → Cobrança
- [ ] **F9-02** Testes de regressão: V7 (checkout, webhooks, CRM) não quebrado por V11
- [ ] **F9-03** Load testing: múltiplos clientes simultâneos
- [ ] **F9-04** Deploy: staging → homologação com time → produção

---

## Gaps Não Capturados no Plano Original (Identificados na Análise)

| ID | Gap | Fase Sugerida |
|---|---|---|
| G1 | Application Fee ($350 + $100/dep) como 3ª cobrança — geração automática de link após documentos aprovados | Fase 5 (F5-D08) |
| G2 | ESL branch: lógica condicional de exibição por nível de inglês no questionário | Fase 4 (F4-L04) |
| G3 | ESL manual: admin indica ESL para candidato no dashboard | Fase 4 (F4-L05) |
| G4 | Orientation Day ($300) + Teste de Inglês ($50): exibir no modal da faculdade como "AO INICIAR" | Fase 4 (F4-M03) |
| G5 | Trava financeira 1x vs 2x Placement Fee: gate da carta de aceite | Fase 5 (F5-T01–F5-T03) + Fase 6 (F6-P02) |
| G6 | Regra de perda de bolsa: mensalidade Migma não muda mesmo sem bolsa universitária | Fase 7 (F7-R05) |
| G7 | COS pós-I-20: Form I-539, Cover Letter, USCIS — fluxo INTEIRO pendente de documentação | Fase 6 (F6-P09) — BLOQUEADO |
| G8 | Contradição MatriculaUSA: manual (11.6) vs automático (13.1) — DECISÃO CRÍTICA antes da Fase 6 | — |
| G9 | Dados de 9 universidades (Excel, ILI, ALA, Internexus, AAE, etc.) incompletos — dependem do Guia Interno | Fase 1 (F1-S1-07) |
| G10 | Narrativa específica: "De 1.481, X confirmaram pré-aceite" deve ser texto dinâmico (X = nº instituições no catálogo) | Fase 4 (F4-L02) |

---

## Dependências entre Fases

```
Fase 0 (deploy pendências)
  └─ Fase 1 (schema novas tabelas)
       ├─ Fase 2 (ajustes questionário) ← independente, pode começar já
       ├─ Fase 3 (aprovação de perfil) ← depende de Fase 0
       │    └─ Fase 4 (escolha de faculdades) ← depende de Fase 1 + 3
       │         └─ Fase 5 (bolsa + documentação) ← depende de Fase 4
       │              └─ Fase 6 (formulários + MatriculaUSA) ← depende de Fase 5 + decisão MatriculaUSA
       │                   └─ Fase 7 (cobrança + indicação) ← depende de Fase 5 + 6
       └─ Fase 8 (notificações + chat IA) ← pode iniciar em paralelo após Fase 3 + decisão provedor

Fase 9 (QA + deploy) ← after all
```

**Paralelos possíveis:**
- Fase 2 pode iniciar imediatamente (zero dependências)
- Schema da Fase 1 pode ser construído em paralelo com Fase 2 e 3
- Fase 8 (Z-API) pode iniciar após decisão de provedor, em paralelo com qualquer fase
- Chat IA (F8-AI) pode começar após ter acesso à API

---

## Estimativa de Esforço

| Fase | Descrição | Duração |
|---|---|---|
| 0 | Deploy pendências | 1–2 dias |
| 1 | Schema + seed (6 tabelas + 15 instituições) | 1–2 semanas |
| 2 | Ajustes questionário V7→V11 | 1 semana |
| 3 | Fluxo pós-questionário — aprovação bilateral | 1–2 semanas |
| 4 | Tela de escolha de faculdades (filtros + modal 7 seções) | 2–3 semanas |
| 5 | Aprovação bolsa + documentação + dados complementares | 2–3 semanas |
| 6 | Formulários + assinatura + MatriculaUSA + carta aceite | 3–4 semanas |
| 7 | Cobrança recorrente + programa de indicação | 2–3 semanas |
| 8 | Notificações Z-API + chat IA | 1–2 semanas |
| 9 | QA + deploy | 1–2 semanas |
| **Total** | | **~14–19 semanas** |
