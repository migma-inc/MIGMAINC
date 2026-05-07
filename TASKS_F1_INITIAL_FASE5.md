# Mentoria F-1 Initial — Fase 5 · Tasks de Implementação

> Uso interno · MIGMA INC. · Brant Immigration
> Referência: Spec Fase 5 (versão consolidada)

---

## 🗂️ ÉPICO 1 — TABELA DE BOLSAS (TELA B)

### TASK 1.1 — Adicionar coluna "Bank Statement Exigido" na tabela
**Tipo:** Feature  
**Prioridade:** Alta  
**Dependências:** Nenhuma

**Descrição:**  
A tabela atual (COS/Transfer) tem 3 colunas: Tuition Anual, % Desconto, Placement Fee.  
O Initial precisa de uma 4ª coluna: **Bank Statement Exigido**.

**Critérios de aceite:**
- [ ] Coluna "Bank Statement Exigido" adicionada à direita da tabela
- [ ] Faixas 0–600: exibe valor padrão da universidade + USD 5.000 (ex: USD 22.000)
- [ ] Faixas 1.000–1.800: exibe valor reduzido da universidade − USD 5.000 (ex: USD 17.000)
- [ ] Coluna visível em desktop e mobile
- [ ] Valor exibido com legenda "(padrão + 5.000)" ou "(reduzido − 5.000)"

---

### TASK 1.2 — Implementar linha divisória vermelha na tabela
**Tipo:** Feature  
**Prioridade:** Alta  
**Dependências:** TASK 1.1

**Descrição:**  
Entre a faixa de placement USD 600 e USD 1.000, inserir uma linha divisória vermelha com texto explicativo.

**Critérios de aceite:**
- [ ] Linha horizontal vermelha entre as linhas de placement USD 600 e USD 1.000
- [ ] Texto da linha: "A PARTIR DAQUI, BANK STATEMENT REDUZ USD 5.000"
- [ ] Visível em mobile (não colapsar ou esconder)
- [ ] Destaque visual claro — deve ser o protagonista visual da tabela
- [ ] Cor: vermelho (#CC0000 ou equivalente do design system)

---

### TASK 1.3 — Ajustar tuition base (placement zero) por universidade
**Tipo:** Config / Dados  
**Prioridade:** Alta  
**Dependências:** Nenhuma

**Descrição:**  
O Initial tem tuition base própria por universidade (≠ COS/Transfer que usa USD 15.000 fixo).  
Exemplo Oikos/Caroline Bacharelado: USD 18.000 no placement zero.

**Critérios de aceite:**
- [ ] Campo de tuition base por universidade configurável no backoffice/CMS
- [ ] Tabela exibe o valor correto por universidade (não hardcoded)
- [ ] Percentuais de desconto recalculados automaticamente a partir da tuition base
- [ ] Validação: se tuition base não configurada, não exibir tabela (erro explícito no backoffice)

**Dados a configurar (exemplo Oikos/Caroline — Bacharelado):**
| Placement | Tuition Anual | % Desconto | Bank Statement |
|-----------|--------------|-----------|----------------|
| USD 0 | USD 18.000 | 0% | USD 22.000 |
| USD 200 | USD 10.100 | 44% | USD 22.000 |
| USD 600 | USD 8.840 | 51% | USD 22.000 |
| USD 1.000 | USD 7.580 | 58% | USD 17.000 |
| USD 1.400 | USD 6.320 | 65% | USD 17.000 |
| USD 1.800 | USD 5.060 | 72% | USD 17.000 |

---

### TASK 1.4 — Remover bank statement da seção "Documentação Necessária"
**Tipo:** Ajuste  
**Prioridade:** Média  
**Dependências:** TASK 1.1

**Descrição:**  
No COS/Transfer, o bank statement aparece em "Documentação Necessária". No Initial, ele já está na tabela (Tela B). Remover para evitar duplicação.

**Critérios de aceite:**
- [ ] Item "bank statement" removido da lista de Documentação Necessária no Initial
- [ ] COS/Transfer não afetado (remoção apenas no flow do Initial)
- [ ] Nenhuma outra referência de bank statement em seções duplicadas

---

## 🗂️ ÉPICO 2 — TELA A ("COMO FUNCIONA SEU INVESTIMENTO")

### TASK 2.1 — Criar componente Tela A (educacional)
**Tipo:** Feature  
**Prioridade:** Alta  
**Dependências:** Nenhuma

**Descrição:**  
Nova tela obrigatória antes da tabela de bolsas. Conteúdo educacional com 3 blocos + botão "Ver minhas opções".

**Critérios de aceite:**
- [ ] Título: "💡 Como Funciona Seu Investimento"
- [ ] 3 blocos numerados com destaque visual igual entre si
- [ ] Bloco 3 tem destaque adicional (cor vermelha no título ou caixa colorida)
- [ ] Frase em itálico: *"Na prática: escolher um Placement maior pode ser a diferença entre conseguir provar seu bank statement ou não."*
- [ ] Botão "Ver minhas opções →" no final
- [ ] Botão só fica ativo após cliente rolar até o final da página (scroll lock)
- [ ] **Sem botão "Pular"** — tela é obrigatória
- [ ] **Sem botão "Voltar"** dentro desta tela
- [ ] Responsivo em mobile com mesma hierarquia visual

**Copy dos 3 blocos (implementar exatamente como abaixo):**

> **1. Bank Statement é o que destrava seu visto.**
> O consulado americano exige que você prove ter dinheiro suficiente parado no banco para cobrir um ano de estudos. Esse extrato é chamado de bank statement e cada universidade exige um valor mínimo. Se você não atinge o valor, o visto é negado — em muitos casos antes mesmo da entrevista.

> **2. A Bolsa Acadêmica reduz sua mensalidade.**
> Quanto maior o Placement Fee que você escolhe, maior o desconto na sua tuition anual. É um investimento antecipado: você paga uma parte agora pra economizar muito mais ao longo do ano. A economia anual chega a mais de USD 12.000 dependendo da faixa.

> **3. A partir de USD 1.000 de Placement, seu Bank Statement fica USD 5.000 menor.**
> Por acordo entre a MIGMA e a universidade, alunos com Placement Fee de USD 1.000 ou mais têm o bank statement reduzido em USD 5.000. Isso significa USD 5.000 a menos que você precisa ter no extrato pra apresentar ao consulado.
> *Na prática: escolher um Placement maior pode ser a diferença entre conseguir provar seu bank statement ou não.*

> No próximo passo, você vai ver as faixas de bolsa disponíveis para sua universidade. Recomendamos que avalie cada faixa considerando os 3 fatores: bank statement exigido, tuition anual e placement fee.

---

### TASK 2.2 — Implementar fluxo sequencial obrigatório (Tela A → Tela B)
**Tipo:** Feature  
**Prioridade:** Alta  
**Dependências:** TASK 2.1, TASK 1.1

**Descrição:**  
Garantir que cliente não acesse a Tela B sem ter passado pela Tela A.

**Critérios de aceite:**
- [ ] Tela B inacessível diretamente (sem URL direta, sem skip)
- [ ] Navegar para seção de bolsa sempre exibe Tela A primeiro
- [ ] Após clicar "Ver minhas opções", Tela A é substituída pela Tela B
- [ ] Não há estado de "já vi a Tela A" salvo entre sessões (exibe toda vez que entrar na seção)
- [ ] Botão "Ver minhas opções" desabilitado até scroll completo (UX gate)

---

## 🗂️ ÉPICO 3 — SEÇÃO DO ADVOGADO CREDENCIADO

### TASK 3.1 — Criar componente "Seção do Advogado"
**Tipo:** Feature  
**Prioridade:** Alta  
**Dependências:** Nenhuma (criação do componente)

**Descrição:**  
Card/seção informativa com dados do advogado, botão WhatsApp e bloco de informações importantes.

**Critérios de aceite:**
- [ ] Header: "✅ I-20 Emitido — Parabéns. Seu I-20 foi emitido pela universidade."
- [ ] Seção "PRÓXIMO PASSO: Processo Consular" com copy exato do spec
- [ ] Nome do advogado: **Igor Thiago Vaz Escobar de Oliveira**
- [ ] Tag "Atende em Português" visível
- [ ] Link de credenciamento: `br.usembassy.gov/pt/legal-assistance-portuguese/`
- [ ] Botão "💬 Falar com o advogado no WhatsApp"
  - URL: `https://wa.me/5562990700013?text=Ol%C3%A1%2C%20vim%20atrav%C3%A9s%20da%20MIGMA`
  - Abre WhatsApp com mensagem pré-preenchida: "Olá, vim através da MIGMA"
  - Abre em nova aba/app (não redireciona na própria página)
- [ ] Bloco "INFORMAÇÕES IMPORTANTES" com os 4 itens do spec
- [ ] **Linguagem proibida** não aparece: sem "nosso advogado", "recomendamos", "parceiro", "garantia"

---

### TASK 3.2 — Liberação automática após emissão do I-20
**Tipo:** Feature  
**Prioridade:** Alta  
**Dependências:** TASK 3.1

**Descrição:**  
A seção do advogado deve aparecer automaticamente quando o sistema detectar que o I-20 foi emitido.

**Critérios de aceite:**
- [ ] Seção **invisível** antes da emissão do I-20
- [ ] Sistema detecta evento de emissão do I-20 (verificar gatilho no backend)
- [ ] Seção liberada automaticamente — **sem ação manual do mentor**
- [ ] Seção permanece visível permanentemente após liberação (não some depois)
- [ ] Aparece como card dedicado no painel do aluno, separado das outras seções
- [ ] Não envia push notification ou email insistente — apenas exibe na plataforma

---

### TASK 3.3 — Definir e mapear gatilho de emissão do I-20
**Tipo:** Investigação / Backend  
**Prioridade:** Alta  
**Dependências:** Nenhuma

**Descrição:**  
Levantar como o sistema detecta/registra a emissão do I-20 para acionar a liberação da seção.

**Critérios de aceite:**
- [ ] Mapear onde no sistema a emissão do I-20 é registrada (campo, tabela, evento)
- [ ] Confirmar se mentor faz uma ação manual ou se é automático
- [ ] Definir evento/webhook que aciona a liberação da seção do advogado
- [ ] Documentar o gatilho para TASK 3.2

---

## 🗂️ ÉPICO 4 — TRACKING E ANALYTICS

### TASK 4.1 — Tracking de faixa selecionada pelo cliente
**Tipo:** Analytics  
**Prioridade:** Média  
**Dependências:** TASK 1.1

**Descrição:**  
Registrar qual faixa de placement o cliente seleciona para análise de distribuição futura.

**Critérios de aceite:**
- [ ] Ao selecionar faixa, evento registrado com: ID do aluno, universidade, faixa selecionada, timestamp
- [ ] Dados acessíveis em relatório/dashboard interno
- [ ] Não bloqueia a seleção em caso de falha no tracking (fire-and-forget)

---

### TASK 4.2 — Tracking de engajamento na Tela A
**Tipo:** Analytics  
**Prioridade:** Baixa  
**Dependências:** TASK 2.1

**Descrição:**  
Medir se os clientes estão realmente lendo a Tela A antes de avançar.

**Critérios de aceite:**
- [ ] Registrar tempo médio de permanência na Tela A
- [ ] Registrar taxa de clique em "Ver minhas opções" (quantos chegam ao botão vs. quantos abandonam)
- [ ] Dados acessíveis em relatório interno
- [ ] Implementação não degrada performance da tela

---

## 🗂️ ÉPICO 5 — CONTEÚDO POR UNIVERSIDADE

### TASK 5.1 — Cadastrar tabela de Oikos University — Bacharelado
**Tipo:** Conteúdo / Config  
**Prioridade:** Alta  
**Dependências:** TASK 1.3

**Critérios de aceite:**
- [ ] Tabela configurada com os 6 valores do spec (tuition, desconto, placement, bank statement)
- [ ] Linha divisória vermelha no lugar correto
- [ ] Validada visualmente em staging antes de ir pro ar

---

### TASK 5.2 — Cadastrar tabela de Caroline University — Bacharelado
**Tipo:** Conteúdo / Config  
**Prioridade:** Alta  
**Dependências:** TASK 1.3

**Critérios de aceite:**
- [ ] Mesmos critérios da TASK 5.1
- [ ] Valores específicos da Caroline University confirmados com time de operações

---

### TASK 5.3 — Mapear e cadastrar demais universidades Initial
**Tipo:** Conteúdo / Config  
**Prioridade:** Média  
**Dependências:** TASK 1.3

**Descrição:**  
Cada universidade parceira do Initial tem tabela própria. Levantar quais universidades estão ativas no Initial e configurar cada uma.

**Critérios de aceite:**
- [ ] Lista de universidades Initial ativas levantada com time de operações
- [ ] Tabela de cada universidade configurada no sistema (Bacharelado e Mestrado onde aplicável)
- [ ] Revisão de cada tabela aprovada por ops antes de publicar

---

## 🗂️ ÉPICO 6 — QA E VALIDAÇÃO

### TASK 6.1 — QA do fluxo completo Initial (Tela A → Tela B → Seleção → Pagamento)
**Tipo:** QA  
**Prioridade:** Alta  
**Dependências:** EPICOs 1 e 2 completos

**Checklist de teste:**
- [ ] Entrar na seção de bolsa → Tela A aparece
- [ ] Botão "Ver minhas opções" bloqueado antes de rolar até o fim
- [ ] Após scroll completo, botão ativa
- [ ] Clicar "Ver minhas opções" → Tela B aparece
- [ ] Tabela exibe 4 colunas corretamente
- [ ] Linha divisória vermelha entre faixas 600 e 1.000
- [ ] Valores de bank statement corretos por faixa
- [ ] Selecionar faixa → fluxo de pagamento 50/50 dispara corretamente
- [ ] Placement USD 200 e 600 → opção de parcela única disponível
- [ ] Placement USD 1.000+ → parcelamento 50/50 padrão

---

### TASK 6.2 — QA da seção do advogado
**Tipo:** QA  
**Prioridade:** Alta  
**Dependências:** ÉPICO 3 completo

**Checklist de teste:**
- [ ] Antes do I-20: seção não aparece no painel do aluno
- [ ] Após I-20: seção aparece automaticamente sem ação do mentor
- [ ] Botão WhatsApp abre `wa.me/5562990700013` com mensagem "Olá, vim através da MIGMA"
- [ ] Link de credenciamento abre `br.usembassy.gov/pt/legal-assistance-portuguese/`
- [ ] Seção permanece visível em sessões subsequentes
- [ ] Linguagem proibida ausente (revisar todo o texto)

---

### TASK 6.3 — Revisão legal/UPL da copy implementada
**Tipo:** Compliance  
**Prioridade:** Alta  
**Dependências:** TASKS 2.1, 3.1

**Descrição:**  
Antes de publicar, revisar se a copy implementada está exatamente conforme o spec, sem linguagem que viole a arquitetura UPL.

**Checklist:**
- [ ] Tela A: sem promessa de aprovação de visto
- [ ] Tela A: sem linguagem de venda ("melhor escolha", "oferta exclusiva")
- [ ] Seção advogado: sem "nosso advogado", "recomendamos", "parceiro"
- [ ] Seção advogado: frase "A MIGMA não presta serviços consulares" presente
- [ ] Seção advogado: bloco "Informações Importantes" com todos os 4 itens
- [ ] Aprovação do responsável legal antes de publicar

---

## 📋 RESUMO DE PRIORIDADES

| # | Task | Prioridade | Épico |
|---|------|-----------|-------|
| 1.1 | Coluna Bank Statement na tabela | 🔴 Alta | Tabela |
| 1.2 | Linha divisória vermelha | 🔴 Alta | Tabela |
| 1.3 | Tuition base por universidade | 🔴 Alta | Tabela |
| 2.1 | Componente Tela A | 🔴 Alta | Tela A |
| 2.2 | Fluxo sequencial Tela A → B | 🔴 Alta | Tela A |
| 3.1 | Componente seção advogado | 🔴 Alta | Advogado |
| 3.2 | Liberação automática pós I-20 | 🔴 Alta | Advogado |
| 3.3 | Mapear gatilho I-20 | 🔴 Alta | Advogado |
| 5.1 | Tabela Oikos — Bacharelado | 🔴 Alta | Conteúdo |
| 5.2 | Tabela Caroline — Bacharelado | 🔴 Alta | Conteúdo |
| 6.1 | QA fluxo completo | 🔴 Alta | QA |
| 6.2 | QA seção advogado | 🔴 Alta | QA |
| 6.3 | Revisão legal UPL | 🔴 Alta | QA |
| 1.4 | Remover bank statement de Docs | 🟡 Média | Tabela |
| 4.1 | Tracking faixa selecionada | 🟡 Média | Analytics |
| 5.3 | Demais universidades Initial | 🟡 Média | Conteúdo |
| 4.2 | Tracking engajamento Tela A | 🟢 Baixa | Analytics |

---

## 🗂️ ÉPICO 7 — MANUTENÇÃO E SEGURANÇA (MAIO 2026)

### TASK 7.1 — Simplificar fluxo de Scholarship Maintenance Fee
**Tipo:** Refactor / UX  
**Prioridade:** Alta  
**Status:** ✅ Concluído (05/05/2026)

**Descrição:**  
Remover requisitos redundantes (selfie, docs, endereço completo) para o pagamento da taxa de manutenção.

**Critérios de aceite:**
- [x] Skip automático do Passo 2 (Documentos/Selfie) para o produto `scholarship-maintenance-fee`
- [x] Validação simplificada (Nome, Email, WhatsApp apenas)
- [x] Consistência entre link direto e link via prefill token

---

### TASK 7.2 — Ativação de Row Level Security (RLS)
**Tipo:** Segurança  
**Prioridade:** Crítica  
**Status:** ⏸️ Adiado (Revertido a pedido do usuário)

**Descrição:**  
Ativar RLS em todas as tabelas identificadas como vulneráveis.

**Critérios de aceite:**
- [ ] RLS ativado em 17 tabelas
- [ ] Políticas de acesso básico implementadas
- [x] Avaliação inicial realizada

---

*Gerado em: 2026-05-05 · Spec base: Fase 5 F-1 Initial — Brant Immigration & MIGMA INC.*
