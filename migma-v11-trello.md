# Board Trello: MIGMA V11 Delivery

*Este documento foi estruturado para ser facilmente copiado para o Trello. Cada Título (##) representa uma **Lista (Coluna)**, os subtítulos em negrito representam os **Cartões (Cards)**, e os itens com caixa de seleção são a **Checklist** dentro de cada cartão.*

---

## FASE 0: Pendências de Infra (Imediato)

**Card: Deploy de Migrations e Banco de Dados**
**Descrição:** Atualizar o schema de produção remoto com o que já foi construído nas etapas anteriores.
**Checklists Extras:**
- [x] Aplicar migrations pendentes no remoto: `20260407223000`, `20260409143000`, `20260410100000–100002`
- [x] Aplicar migration auxiliar: `selection_survey_completed` (generated column em `user_profiles`)

**Card: Deploy e Teste de Edge Functions**
**Descrição:** Subir para produção as funções essenciais de webhook e cron jobs.
**Checklists Extras:**
- [x] Deploy das edge functions de pagamentos: `square-webhook`, `stripe-visa-webhook`, `parcelow-webhook`, `send-zelle-webhook`
- [ ] Deploy de edge functions visa: `approve-visa-contract`, `reject-visa-contract`
- [ ] Deploy e teste manual (HTTP) da cron: `onboarding-sla-cron`

---

## FASE 1: Schema Foundation (Novas Tabelas)

**Card: Construir Tabelas Geração de Instituições**
**Descrição:** Models fundamentais para gerenciar faculdades, cursos e bolsas do catálogo v11.
**Checklists Extras:**
- [x] Criar Migration para tabela `institutions` (dados base, badges, rules)
- [x] Criar Migration para tabela `institution_courses` (cursos, níveis, meses, CPT)
- [x] Criar Migration para tabela `institution_scholarships` (bolsas, discount_percent, placement fee, tuition, migma monthly)

**Card: Tabelas de Processo, Documentos e Finanças**
**Descrição:** Models auxiliares para comportar a jornada do aluno e transações complexas.
**Checklists Extras:**
- [x] Migration: `institution_applications` (candidaturas feitas pelo cliente)
- [ ] Migration: `global_document_requests` (pipeline de documentos transferência e COS)
- [ ] Migration: `institution_forms` (controle dos PDFs gerados e assinatura)
- [ ] Migration: `recurring_charges` (gestão das cobranças mensais da diferença Migma)
- [ ] Migration: `referral_links` (programa de indicação e tracking)
- [x] Adicionar RLS (Row Level Security) focado no cliente para estas tabelas

**Card: Seed de Dados (Institucional)**
**Descrição:** Entrar no banco de dados com a carga real das 15 instituições.
**Checklists Extras:**
- [x] Inserir Caroline University e Oikos University em detalhes (spec seções 10.3)
- [x] Inserir CSI e Trine University com dados iniciais
- [x] Recuperar manual/guia interno para preencher ALAs, AAE, Internexus etc.
- [x] Inserir escolas ESL (CSI e Ucedas) configurando flag global ESL.

---

## FASE 2: Ajustamento do Questionário (V7 → V11)

**Card: UI e Validações Rígidas no Form (Step 1-5)**
**Descrição:** Forçar as regras de seleção exata e simplificação de UX apontadas na spec v11.
**Checklists Extras:**
- [x] Remover tela/pergunta "Tipo de processo" e forçar preenchimento via URL (`service_type` state)
- [x] Regra "Exatamente 2": impedir < 2 e bloquear UI para > 2 nas Áreas de Interesse
- [x] Regra "Exatamente 2": Aplicar na Frequência das Aulas e Faixa de Investimento
- [x] Regra "Exatamente 3": Aplicar nas Regiões de Preferência
- [x] Garantir que 100% dos dados essenciais do FormV7 persistem no perfil da V11

**Card: Pós Questionário e Timer 24h**
**Descrição:** Tela final que gera bloqueio para engatar urgência e análise admin.
**Checklists Extras:**
- [x] Construir layout da tela de conclusão (Timer exibindo aguarde até finalização de análise e contagem de instituições simulada 1481)
- [x] Botão de ir para Escolha Desabilitado 
- [x] Implementar Teste E2E (Checkout Inicial -> Questionário Respondido -> Tela Final)

---

## FASE 3: Aprovação Bilateral de Perfil

**Card: Admin Board: Rejeição ou Aprovação de Prospects**
**Descrição:** Nova aba no Dashboard do administrador para revisão se o contratante atende aos requisitos iniciais Migma.
**Checklists Extras:**
- [x] Adicionar status de `profile_approval_status` (pending review/approved/rejected)
- [x] Admin Board: Tela "AGUARD. APROVAÇÃO" com fotos selfie e docs para overview rapido.
- [x] Criar Action Buttons de Approve/Reject, gravando auditoria do admin que realizou (IP e Timestamps)
- [ ] Emitir Edge-Function enviando "Bem-Vindo/Contrato Oficial" via Automação após Aprovação de Admin

**Card: Frontend do Estudante Pós-Aprovação**
**Descrição:** Refletir decisão do admin para destrancar etapa 2 do onboarding do cliente
**Checklists Extras:**
- [x] Mostrar status liberado e habilitar botão de "Acesse a Escolha de Faculdades"
- [ ] Notificação transacional WhatsApp com o resultado positivo (Agendar no Módulo 8)

---

## FASE 4: Tela de Escolha de Faculdades

**Card: UI Listagem e Lógica da Matriz (Search & Filters)**
**Descrição:** Catálogo base de universidades, com as regras complexas de CPT/OPT sendo filtradas dinamicamente.
**Checklists Extras:**
- [x] Construir header dinâmico "X universidades confirmaram seu pré-aceite de 1481"
- [x] Lógica Oculta ESL: Trazer ESL branch APENAS se cliente for Básico/Zero ou "forçado" via admin toggle
- [x] Implementar 8 filtros avançados no front-end: Nome, Uni, Nível, Área(56 cursos), Modality, Permit, Cost Range.
- [x] Card das universidades: Visual rico, com badgets e desconto % plotados claramente.
- [x] Seleção Limitada: Máximo de 4 cards escolhidos, bloquear outros cliques ao atingir. Cartão ganha hover dourado/destaque ao ser clicado.

**Card: Modal Interativa Super Detalhada**
**Descrição:** Modal que exibe TUDO sobre a faculdade. Uma das telas de venda mais críticas.
**Checklists Extras:**
- [x] Seção "Tabela Interativa": Linhas Clicáveis de diferentes Tiers de Placements ($200/$600/$1000). Hover com calculo real "Você economiza X".
- [x] Calculadora inline momentânea em "Quanto vou pagar?" -> Destaca 4 triggers (Hoje, após aceite, matricula inicial, recorrente anual)
- [x] Seção "Regras": Requisitos, Linguagem CPT explicada, FAQ Dropdowns rápidos.
- [x] Banner ou CallOut do programa Migma Rewards de 10 indicados = Tuition Zera

**Card: Tela de Revisão de Carrinho Universitario**
**Descrição:** A tela pre-submit final certificando o carrinho escolhido (Máximo 4)
**Checklists Extras:**
- [x] Montar visualizador de resumo das escolhas (Curso | Placement Fee alvo | Tuiton Anual Resultante)
- [x] Botão de "Confirmar Escolha em Definitivo" disparando Pop-up severo "Não Editável mais adiante"

---

## FASE 5: Aprovação Placements e Documentos

**Card: Seleção do Placement e Emissão de Ticket (Admin)**
**Descrição:** Dos N selecionados, o Administrador valida 1 como o "Ganhador" e gira o link de pagamento do fee
**Checklists Extras:**
- [x] Criar Admin View da tela "AGUAR. APROVAÇÃO BOLSA" para analisar as escolhas enviadas pelo prospect
- [x] Flow Admin: Escolher Facul 1 das 4. Clicar em Gerar Link Checkout Placement.
- [x] Edge Function disparar Pagamentos gerado por API Square/Parcelow (Envio por Email).
- [ ] Mecanismo Automático (CRON): Se o perfil ficar 24h sem Admin aprovar, o script força auto-aprovação Oikos ou Caroline pela prioridade nativa.

**Card: Portal de Documentos Requeridos e Dados Avançados**
**Descrição:** Logo após Placement ser liquidado de fato, a UI reage pedindo as pastas e formulários do Transfer/COS
**Checklists Extras:**
- [ ] Gatilho Webhook: Libera Global Docs na Sidebar após Placement compensado em Banco.
- [ ] Trava financeira 1x/2x: Armazenamento da forma de parcelamento para trancar Carta de Aceite na ETAPA 6.
- [x] UI Lista Dinamica Front: Exibir BankStatement (Com Aviso Alert Migma sem sustos), I-797 (se aplicável), e outros baseados na categoria de visto requisitado.
- [ ] Admin Docs Manager: View de admin que dá Feedback doc por doc "Aceito" ou "Refeito".
- [ ] Liberar Dados Complementares Forms(Sponsors, Recomendantes) apôs Documentos finalizarem.

---

## FASE 6: Assinaturas e Integração MatriculaUSA

**Card: PDF Generation Engine**
**Descrição:** O sistema vai costurar as informações digitadas e renderizar os PDF de faculdades americanos in-flight.
**Checklists Extras:**
- [ ] Construir Rotina PDF generation (`generate-institution-forms`).
- [ ] Mapear Campos Caroline Univ (Agency forçada p/ MIGMA INC).
- [ ] Mapear Campos Oikos Univ.
- [ ] Envio para Portal do Cliente como "Documentos para Assinar".
- [ ] Criar mecanismo interativo cliente "Assinar digitalmente" ou Upload Recomendantes Externos.

**Card: Envio para Matricula USA Processar**
**Descrição:** A entrega formal que engatilha o escritório burocratico a agir no I-20 / COS e gerar carta de aceite
**Checklists Extras:**
- [ ] Decidir formalmente: Export ZIP manual para o portal OR Request API Automático. (⚠️ GAP de refino de negócios)
- [ ] Notificar Admin de Fila pronta e aguardar Retorno de "Carta Aceite / I-20 Produzido".

**Card: Handover da Carta de Aceite**
**Descrição:** Fase final de Tranfer em que a documentação ganha validade.
**Checklists Extras:**
- [ ] Gate Trava Financeira: Bloquear e alertar usuário que devera pagar a PLACEMENT 2 PARCELA se fez em 2x, antes de dar arquivo PDF da CARTA.
- [ ] Flow Transfer Form Front-End: Dar instruções de entrega à sua antiga escola
- [ ] Adquirir o SEVIS Release (I-20 FINAL CONCLUÍDO).
- [ ] Definir a etapa cega pós I-20 do público COS. (⚠️ GAP - Precisa de manual de I-539 / USCIS)

---

## FASE 7: Finanças Recorrentes de Diferencial e Indicações

**Card: Módulo Financeiro: Recorrente Migma (Diferença de Bolsa)**
**Descrição:** Onde a Migma captura o ganho passivo mensalmente (A Tuíção Anual - Tuition Base).
**Checklists Extras:**
- [ ] Configuração de Edge-Function de Billing que se ativa N meses após I-20 Pronto.
- [ ] Lógica matematica hard-coded para Bacharel ($3800), Mestrado ($4200), MBA/CS ($5500).
- [ ] Criação de cron ou integração Square Subscription para debito autômatico internacional recorrente (48 meses ou 24 meses).
- [ ] Script de suspensão ou desativação manual na plataforma (Em caso de calote do aluno).

**Card: Módulo de Rewards Calendly / Tracking**
**Descrição:** Motor para engajamento e venda em MMN para abater "Reocrrente Migma".
**Checklists Extras:**
- [ ] Gerar Link Migma UTM + Unique Code de Cliente na Tela Rewards.
- [ ] Pegar CallBack de webhook calendly para inserir `owner_id` em um recém fechamento do CRM Admin.
- [ ] Lógica Gatilho: Se cliente.closures_count == 10, EdgeFunction chama Cancelamento Recorrente na Square de Graça.

---

## FASE 8: Infraestrutura de Bots e IA

**Card: Event-Bus de Notificações via WPP / Email**
**Descrição:** Disparador assincrono que avisa os prospects baseado em cada alteração de Database / Status Admin.
**Checklists Extras:**
- [ ] Selecionar Z-API (ou correspondente) como Microserviço. Criação Centralizada da Edge-Func.
- [ ] Mapear os 14 Triggers Exatos listados na SPEC para bater no endpoint de Mensageria.
- [ ] Configurar cron contadores de dias (Expirações de Transfer aos 30d, 15d, COS aos 60d etc).

**Card: Agente Virtual "Equipe Migma" (KnowledgeBase)**
**Descrição:** Widget flutuante que responde qualquer duvida da Spec.
**Checklists Extras:**
- [ ] Criar Chat Component Front-end no Supabase / Sistema Migma.
- [ ] Subir RAG base e Prompt System (Múltiplas Universidades context, regras de Visa F1).
- [ ] Redirecionamento humano caso a análise de sentimento identifique furia/complicações legais.

---

## FASE 9: QA Geral e Fechamento

**Card: Testes Críticos End To End e Deployments**
**Descrição:** Passagem final da Aplicação
**Checklists Extras:**
- [ ] Fechar ciclo Simulando Transefência Completa e Mudança de status F1 
- [ ] Revisão V7 vs V11 Regression Test 
- [ ] Code Approval e Deploy Produtivo Migma Team.
