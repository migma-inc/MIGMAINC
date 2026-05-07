▝▜█████▛▘  Sonnet 4.6 with medium effort · Claude Pro
  ▘▘ ▝▝    ~\Migma\migma-lp

  ✻ Voice mode is now available · /voice to enable

  Searched for 1 pattern, read 2 files (ctrl+o to expand)

● Tenho tudo que preciso. Criando o plano.

● Updated plan
  ⎿  /plan to preview

  Searched for 1 pattern (ctrl+o to expand)

● Padrão de RLS admin confirmado: (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'. Atualizando o plano.

● Updated plan
  ⎿  /plan to preview

● User approved Claude's plan
  ⎿  Plan saved to: ~\.claude\plans\melodic-sniffing-lagoon.md · /plan to edit
     Plano: Admin — Aprovação de Bolsa V11 + Fix de Schema

     Context

     O aluno seleciona até 4 universidades no onboarding (UniversitySelectionStep).
     Após a seleção, fica travado na tela "Perfil em Revisão pela Banca Migma" (PlacementFeeStep).
     O admin precisa aprovar a bolsa para liberar o link de Placement Fee ao aluno.

     O ScholarshipApprovalTab.tsx já está implementado e integrado no AdminUserDetail (aba "Bolsas V11").
     O fluxo completo já existe no código. O único bloqueador é o schema do banco — a migration não tem as colunas payment_link_url e payment_link_generated_at que o código    
     usa.

     O que já existe (não tocar)

     - src/pages/admin/ScholarshipApprovalTab.tsx — UI completa de aprovação ✓
     - src/pages/admin/AdminUserDetail.tsx linha 1748 — tab "Bolsas V11" integrado ✓
     - src/pages/StudentOnboarding/components/PlacementFeeStep.tsx — tela do aluno ✓
     - supabase/functions/migma-parcelow-checkout/index.ts — geração do link Parcelow ✓
     - Fluxo: approve → gera link Parcelow → rejeita outras apps → envia email ✓

     Problema único: Migration incompleta

     supabase/migrations/20260417093328_create_v11_process_schema.sql

     A tabela institution_applications criada nessa migration NÃO tem:
     - payment_link_url TEXT — URL do checkout Parcelow
     - payment_link_generated_at TIMESTAMPTZ — timestamp de geração

     O código em ScholarshipApprovalTab.tsx (linha 39-40) e PlacementFeeStep.tsx (linha 42) já referenciam essas colunas. Sem elas, o UPDATE da aprovação vai falhar
     silenciosamente.

     Plano de execução

     Passo 1 — Nova migration para adicionar as colunas

     Criar arquivo: supabase/migrations/20260417100000_add_payment_link_to_institution_applications.sql

     ALTER TABLE public.institution_applications
       ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
       ADD COLUMN IF NOT EXISTS payment_link_generated_at TIMESTAMPTZ;

     Passo 2 — RLS para admins

     As políticas atuais só deixam o próprio usuário fazer SELECT/UPDATE.
     O admin usa o supabase client com anon key, então o UPDATE vai ser bloqueado pela RLS.

     Padrão confirmado em todas as migrations do projeto: (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'

     Adicionar na mesma migration:
     -- Admins podem SELECT em qualquer institution_application
     CREATE POLICY "Admins can read all applications"
       ON public.institution_applications
       FOR SELECT
       USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

     -- Admins podem UPDATE em qualquer institution_application (aprovação, link, rejeição)
     CREATE POLICY "Admins can update all applications"
       ON public.institution_applications
       FOR UPDATE
       USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
       WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

     Passo 3 — Verificar acesso ao CRM Board (sem mudança de código)

     Confirmar que OnboardingCrmBoard tem cards de alunos em placement_fee step
     que linkam para AdminUserDetail com a aba "scholarship" pré-selecionada.
     Se não tiver, adicionar ?tab=scholarship na URL de navegação do card.

     ┌─────────────────────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
     │                                       Arquivo                                       │                          Ação                           │
     ├─────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
     │ supabase/migrations/20260417100000_add_payment_link_to_institution_applications.sql │ CRIAR (nova migration)                                  │
     ├─────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
     │ src/components/admin/OnboardingCrmBoard.tsx                                         │ Verificar link para tab scholarship (pode não precisar) │
     └─────────────────────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────┘

     Fluxo pós-implementação

     1. Admin abre AdminUserDetail do aluno → aba "Bolsas V11"
     2. Vê até 4 cards de universidades com status AGUARD. APROVAÇÃO
     3. Seleciona o radio da bolsa desejada → clica "Aprovar Bolsa"
     4. Sistema: gera link Parcelow, atualiza status → payment_pending, rejeita demais, envia email
     5. Aluno: PlacementFeeStep exibe o botão de pagamento em tempo real (subscription Supabase ativa)

     Verificação

     1. Aplicar migration no Supabase
     2. Admin aprova bolsa de aluno de teste → confirmar no Supabase Studio que payment_link_url foi salvo
     3. Aluno no onboarding → PlacementFeeStep deve exibir o card de pagamento automaticamente
     4. Email chega ao aluno com link Parcelow



● Write(supabase\migrations\20260417100000_add_payment_link_to_institution_applications.sql)
  ⎿  Wrote 19 lines to supabase\migrations\20260417100000_add_payment_link_to_institution_applications.sql
       1 -- Migration: add payment_link columns to institution_applications
       2 -- Required by ScholarshipApprovalTab (admin approval flow) and PlacementFeeStep (student UI)
       3
       4 ALTER TABLE public.institution_applications
       5   ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
       6   ADD COLUMN IF NOT EXISTS payment_link_generated_at TIMESTAMPTZ;
       7
       8 -- Admins can SELECT any institution_application (to view student selections in approval tab)
       9 CREATE POLICY "Admins can read all applications"
      10   ON public.institution_applications
     … +9 lines (ctrl+o to expand)

● Agora verifico o CRM Board para ver se há link para a aba scholarship.

  Searched for 3 patterns (ctrl+o to expand)

● AdminUserDetail não lê URL params para tab — o admin precisa clicar manualmente. Não é bloqueador, mas posso adicionar depois se quiser.

  Done. O que foi feito:

  Criada supabase/migrations/20260417100000_add_payment_link_to_institution_applications.sql com:
  - ADD COLUMN payment_link_url TEXT e payment_link_generated_at TIMESTAMPTZ na tabela institution_applications
  - Política RLS para admin ler qualquer application
  - Política RLS para admin atualizar qualquer application (necessário para a aprovação funcionar)

  Fluxo agora funcional:
  1. Admin → AdminUserDetail de qualquer aluno → aba "Bolsas V11"
  2. Seleciona a bolsa aprovada → clica "Aprovar Bolsa"
  3. Sistema gera link Parcelow, salva payment_link_url, rejeita demais apps, envia email
  4. Aluno vê o botão de pagamento em tempo real na tela "Perfil em Revisão"

  Só precisa aplicar a migration no Supabase.
**MIGMA INC.**

**Documentação de Alterações**

Migração do Checkout: MatriculaUSA → Migma

*Versão 11.0 — Abril 2025*

| **Campo**             | **Detalhe**                                                                                     |
|-----------------------|-------------------------------------------------------------------------------------------------|
| Projeto               | Migma Visa Checkout — Redesign Completo                                                         |
| Serviços documentados | Transfer e COS (demais a definir)                                                               |
| Fluxo Migma           | Página única com 3 steps visíveis, determinada pela URL de acesso                               |
| Esta versão           | v11.0 — Correções: identidade visual, layout de steps, termos, pagamentos e fluxo pós-pagamento |
| Status                | Em especificação — aguardando desenvolvimento                                                   |
| Data                  | Abril 2025                                                                                      |

# 1. Arquitetura de Roteamento por Serviço

Ponto crítico: antes de qualquer fluxo de checkout iniciar, o sistema deve identificar qual serviço o usuário está contratando. Isso é determinado exclusivamente pela URL de acesso.

> **Regra Principal — URL determina o Serviço**
>
> Cada serviço da Migma possui uma URL exclusiva de checkout (definida pela equipe de desenvolvimento).
>
> Ao acessar a URL, o sistema carrega automaticamente as configurações daquele serviço.
>
> O usuário nunca seleciona o serviço manualmente — a URL já define isso.
>
> As configurações carregadas incluem: preço base, texto do contrato, campos específicos e regras do serviço.

## 1.1 Serviços Mapeados

| **Serviço**     | **URL de Checkout**  | **Status de Documentação**           |
|-----------------|----------------------|--------------------------------------|
| Transfer        | A confirmar com devs | ✅ Em especificação (este documento) |
| COS             | A confirmar com devs | ✅ Em especificação (este documento) |
| EB2             | A confirmar com devs | ⏳ Pendente — próximos alinhamentos  |
| EB3             | A confirmar com devs | ⏳ Pendente — próximos alinhamentos  |
| Initial         | A confirmar com devs | ⏳ Pendente — próximos alinhamentos  |
| Turista         | A confirmar com devs | ⏳ Pendente — próximos alinhamentos  |
| Demais serviços | A confirmar com devs | ⏳ Pendente — próximos alinhamentos  |

## 1.2 Diferenças entre Transfer e COS

> **A Definir — Em Alinhamento Contínuo**
>
> As diferenças específicas de fluxo, preço e campos entre Transfer e COS serão
>
> documentadas conforme alinhamento com o time de produto.
>
> Este documento será atualizado a cada alinhamento realizado.

# 2. Identidade Visual

> **Instrução para Desenvolvedores — Identidade Visual**
>
> Toda a identidade visual do checkout deve ser IDÊNTICA ao site atual da Migma.
>
> Cores, tipografia, espaçamentos, componentes, ícones e estilo de botões devem
>
> replicar fielmente o que já está implementado no site da Migma em produção.
>
> Não criar nova paleta — usar exatamente os tokens, variáveis e estilos já existentes no codebase.
>
> Em caso de dúvida sobre qual estilo aplicar, consultar o site da Migma como referência definitiva.

## 2.1 Componentes Específicos a Replicar

- Cards: estilo idêntico aos cards do site atual da Migma

- Inputs e selects: estilo idêntico aos formulários do site atual da Migma

- Botões primários e secundários: idênticos aos do site atual

- Barra de progresso de steps: idêntica ao checkout atual da Migma

- Áreas de upload: borda dashed dourada, ícone de upload centralizado (conforme site atual)

- Canvas de assinatura digital: fundo branco, traço escuro, botões Clear e Done

- Card scrollável de contrato: estilo conforme site atual da Migma

# 3. Estrutura da Página — Layout Único

> **Correção Importante — Todos os Steps em Uma Única Página**
>
> O checkout é uma ÚNICA página, não um fluxo de múltiplas páginas.
>
> Os 3 steps (barra de progresso) ficam sempre visíveis no topo da página.
>
> Todo o conteúdo dos 3 steps é exibido em sequência na mesma página.
>
> A barra de progresso serve como indicador visual de posição, não como navegação entre páginas.

- Topbar fixa no topo: ← Voltar ao início \| Logo MIGMA + 'Visa Checkout' \| Seletor de idioma

- Barra de progresso logo abaixo: Step 1 \| Step 2 \| Step 3 — todos visíveis o tempo todo

- Step ativo destacado em dourado \| Step concluído em verde \| Step pendente em cinza

- Conteúdo rolável em coluna única ou layout de 2 colunas conforme o step

# 4. Conteúdo dos Steps

|                                                 |                 |
|-------------------------------------------------|-----------------|
| **STEP 1/3 — Informações Pessoais + Pagamento** | **DOCUMENTADO** |

## 4.1 Formulário — Dados Pessoais

Layout em 2 colunas: formulário (esquerda) e resumo do pagamento (direita).

| **Campo**         | **Tipo** | **Obrigatório** | **Observação**                          |
|-------------------|----------|-----------------|-----------------------------------------|
| Nome Completo     | text     | Sim             |                                         |
| E-mail            | email    | Sim             |                                         |
| WhatsApp          | tel      | Sim             | Com código do país (+55 padrão)         |
| Senha             | password | Sim             |                                         |
| Confirmar Senha   | password | Sim             | Deve ser igual à Senha                  |
| Nº de Dependentes | select   | Sim             | 0 a 5 — cada dependente +\$150 no total |

## 4.2 Regra de Preço — Dependentes

> **Regra de Negócio — Cálculo Dinâmico em Tempo Real**
>
> Preço base do Processo Seletivo: US$ 400,00
>
> Por dependente adicionado: +US$ 150,00
>
> Fórmula: Total = $400 + (nº dependentes × $150)
>
> Exemplos: 0 dep. = $400 | 1 dep. = $550 | 2 dep. = $700 | 3 dep. = $850
>
> O card de Resumo (coluna direita) atualiza o valor em TEMPO REAL ao mudar o select.
>
> ATENÇÃO: Preço válido para Transfer. Preço do COS e demais serviços a confirmar.

## 4.3 Resumo do Pagamento — Coluna Direita

- Valor total dinâmico: atualiza em tempo real conforme nº de dependentes

- Badge de cupom aplicado (quando houver)

- Card de Garantia de Reembolso: 'Se não for aceito em nenhuma universidade parceira, a taxa será totalmente reembolsada'

## 4.4 Aceite de Termos e Condições + Assinatura Digital

> **Comportamento dos Termos e Condições**
>
> O texto dos Termos e Condições NÃO aparece por padrão na página.
>
> No texto dos checkboxes, as palavras 'Termos e Condições' são um link clicável em azul.
>
> Ao clicar no link, abre uma MODAL com o texto completo dos Termos e Condições.
>
> A modal exibe o texto em fonte pequena — o usuário deve dar scroll para ler todo o conteúdo.
>
> O texto é carregado do backend — não hardcoded no frontend.
>
> Não usar a palavra 'Contrato' em nenhuma parte da interface — sempre 'Termos e Condições'.

Conteúdo dos Termos e Condições (exibido na modal ao clicar no link):

- Seção 1: Transfer - Selection Process (texto completo do acordo)

- Seção 2: Annex I - Payment Authorization

- Annex I inclui: Initial Fees \| Service Balances \| Extra Operational Fees \| Dependent Fees

Dois checkboxes obrigatórios exibidos na página:

- Checkbox 1 \*: 'Declaro que li e concordo com todos os \[Termos e Condições\] e seu Anexo I.'

- → 'Termos e Condições' é link azul clicável que abre a modal

- Checkbox 2 \*: 'Autorizo o uso e tratamento dos meus dados pessoais para as finalidades descritas nos \[Termos e Condições\].'

- → 'Termos e Condições' é link azul clicável que abre a mesma modal

- Ambos obrigatórios — botão de pagamento desabilitado até os dois serem marcados

Assinatura Digital — aparece logo abaixo dos checkboxes:

- Canvas branco para assinatura com dedo (mobile) ou mouse (desktop)

- Botão 'Clear': limpa o canvas e permite assinar novamente

- Botão 'Done': confirma a assinatura

- Após capturar: exibir '✓ ✓ Assinatura capturada. Confirmando em 2 segundos...'

- Auto-confirmação em 2 segundos após o Done

- Salvar imagem da assinatura no backend vinculada ao contrato do usuário

- Registrar aceite dos checkboxes com timestamp + IP no banco para fins legais

## 4.5 Titularidade do Cartão

> **Regra de Exibição — Antes de Selecionar o Método de Pagamento**
>
> Esta seção aparece ANTES da seleção do método de pagamento.
>
> Exibir para TODOS os usuários que utilizarão cartão (Square ou Parcelow).
>
> NÃO exibir para Pix e Zelle.
>
> A exibição é condicional: aparece apenas se o IP indicar método de cartão disponível.
>
> Ou alternativamente: exibir sempre e ocultar/desabilitar se o usuário selecionar Pix ou Zelle.

Pergunta ao usuário: 'O cartão de crédito que você vai usar é seu ou de terceiros?'

### Opção 1 — Meu Cartão (selecionada por padrão):

| **Campo**      | **Tipo** | **Obrigatório** | **Observação**                         |
|----------------|----------|-----------------|----------------------------------------|
| CPF            | text     | Sim             | CPF do próprio titular da conta        |
| Nome no Cartão | text     | Sim             | Nome exatamente como aparece no cartão |

### Opção 2 — Cartão de Terceiros:

| **Campo**                | **Tipo** | **Obrigatório** | **Observação** |
|--------------------------|----------|-----------------|----------------|
| Nome Completo do Titular | text     | Sim             |                |
| CPF do Titular           | text     | Sim             |                |
| E-mail do Titular        | email    | Sim             |                |
| WhatsApp do Titular      | tel      | Sim             |                |

> **Aviso — Endereço de Cobrança (Cartão de Terceiros)**
>
> Exibir alerta ao selecionar 'Cartão de Terceiros':
>
> 'ATENÇÃO AO ENDEREÇO: O endereço de cobrança (Billing Address) deve ser o do titular
>
> do cartão e precisará ser preenchido diretamente na próxima tela (Parcelow Checkout).'

## 4.6 Métodos de Pagamento

A seleção do método de pagamento aparece após a seção de Titularidade do Cartão.

| **Método**                     | **IP Americano (US)** | **IP Brasileiro (BR)** |
|--------------------------------|-----------------------|------------------------|
| Square (Cartão — americano)    | ✅ Exibir (padrão)    | ❌ Ocultar             |
| Parcelow (Cartão — brasileiro) | ✅ Exibir             | ✅ Exibir (padrão)     |
| Pix                            | ✅ Exibir             | ✅ Exibir              |
| Zelle                          | ✅ Exibir             | ✅ Exibir              |

> **Dev — Detecção de IP e Lógica de Métodos**
>
> Backend detecta IP e retorna flag: { region: 'US' | 'BR' | 'OTHER' }
>
> IP americano (US): Square selecionado por padrão. Parcelow, Pix e Zelle também disponíveis.
>
> IP brasileiro (BR): Parcelow selecionado por padrão. Pix, Zelle também disponíveis. Square oculto.
>
> Fallback (OTHER ou indefinido): exibir todos os métodos.
>
> Botão CTA dinâmico: 'Continuar com [Método Selecionado] →'
>
> Ao clicar no botão CTA: redirecionar para a tela de pagamento do gateway correspondente.

> **Fluxo Pós-Pagamento — Importante**
>
> Após o usuário clicar em 'Continuar com [Método]', ele é redirecionado para a tela de pagamento do gateway.
>
> Somente após o pagamento ser CONFIRMADO pelo gateway é que o fluxo avança para o Step 2.
>
> O Step 2 e Step 3 são liberados apenas mediante confirmação de pagamento bem-sucedido.
>
> Em caso de falha no pagamento: retornar ao Step 1 com mensagem de erro adequada.

|                                                       |                 |
|-------------------------------------------------------|-----------------|
| **STEP 2/3 — Documentos & Verificação de Identidade** | **DOCUMENTADO** |

Step 2 liberado somente após confirmação de pagamento. Combina dados adicionais do perfil + upload de documentos.

## 4.7 Seção A — Dados Adicionais do Perfil

| **Campo**               | **Tipo** | **Obrigatório** | **Observação**                      |
|-------------------------|----------|-----------------|-------------------------------------|
| Data de Nascimento      | date     | Sim             | Formato dd/mm/aaaa                  |
| Tipo de Documento       | select   | Sim             | Passaporte, RG, CNH                 |
| Número do Documento     | text     | Sim             |                                     |
| Endereço (Rua e número) | text     | Sim             |                                     |
| Cidade                  | text     | Sim             |                                     |
| Estado / Província      | text     | Sim             |                                     |
| CEP / Código Postal     | text     | Sim             |                                     |
| País de Residência      | select   | Sim             |                                     |
| Nacionalidade           | select   | Sim             |                                     |
| Estado Civil            | select   | Sim             | Solteiro, Casado, Divorciado, Viúvo |
| Observações Adicionais  | textarea | Não             | Campo livre opcional                |

## 4.8 Seção B — Upload de Documentos

- Frente do Documento (Passaporte/RG/CNH) \* — JPG ou PNG, máx. 20MB

- Verso do Documento \* — JPG ou PNG, máx. 20MB

- Selfie com Documento \* — JPG ou PNG, máx. 20MB

- Instrução selfie: 'Segure o documento ao lado do rosto. Rosto e documento devem estar claramente visíveis.'

- Exibir imagem de exemplo ilustrativa ao lado da instrução da selfie

- Após upload: mostrar preview da imagem + nome do arquivo + tamanho

- Validar formato (JPG/PNG) e tamanho (máx 20MB) antes de permitir avanço

## 4.9 Botões de Ação — Step 2

- Botão secundário: '← Voltar' — retorna ao topo do Step 1

- Botão primário: 'Upload & Salvar Documentos →' — valida e avança para Step 3

- Botão primário desabilitado até: 3 uploads realizados + dados obrigatórios preenchidos

|                                           |                 |
|-------------------------------------------|-----------------|
| **STEP 3/3 — Termos & Confirmação Final** | **DOCUMENTADO** |

## 4.10 Revisão Final e Confirmação

- Exibir resumo final do pedido: produto, valor total (com dependentes), método de pagamento utilizado

- Confirmar que documentos foram enviados com sucesso

- Botão: 'Confirmar Conclusão →' — finaliza o processo e redireciona para tela de sucesso

- Tela de sucesso: confirmação de que o processo seletivo foi iniciado com sucesso

# 5. Questionário do Processo Seletivo

Após a conclusão do checkout, o candidato é direcionado para o questionário do processo seletivo. Composto por perguntas originais da Migma combinadas com perguntas selecionadas do MatriculaUSA.

> **Regra — Tipo de Processo via URL**
>
> A pergunta 'Qual o tipo de processo desejado?' foi REMOVIDA do questionário.
>
> O tipo de processo (Transfer, COS, Initial, etc.) é determinado pela URL de acesso.
>
> O sistema carrega automaticamente as perguntas específicas do serviço.

## 5.1 Seção A — Perfil e Preferências Acadêmicas

Perguntas originais da Migma mantidas (pergunta de tipo de processo removida):

| **Campo**                                | **Tipo**     | **Obrigatório** | **Observação**                                                                                     |
|------------------------------------------|--------------|-----------------|----------------------------------------------------------------------------------------------------|
| E-mail                                   | email        | Sim             | Pré-preenchido do cadastro                                                                         |
| Nome completo                            | text         | Sim             | Pré-preenchido do cadastro                                                                         |
| Tipo de formação buscada                 | select       | Sim             | Certificate / Bacharelado / Mestrado — deve vir ANTES da seleção de cursos                         |
| Áreas de interesse (exatamente 2)        | multi-select | Sim             | Exatas & Tecnologia \| Negócios & Gestão \| Humanas & Sociais \| Saúde & Ciências — mín. 2, máx. 2 |
| Frequência das aulas (exatamente 2)      | multi-select | Sim             | 2x/ano (3 dias) \| 4x/ano (4 dias) \| 2x/semana \| 4x/semana — mín. 2, máx. 2                      |
| Investimento anual (exatamente 2 faixas) | multi-select | Sim             | De \$3.800 até acima de \$13.800 por ano — mín. 2, máx. 2                                          |
| Regiões de preferência (exatamente 3)    | multi-select | Sim             | 15 estados disponíveis — candidato escolhe livremente 3                                            |
| Nível de inglês                          | select       | Sim             | Zero / Básico / Intermediário / Avançado / Fluente                                                 |
| Já estudou em college/universidade?      | radio        | Sim             | Sim / Não — Q9 MatriculaUSA                                                                        |
| Objetivo principal com o programa        | select       | Sim             | Q6 MatriculaUSA                                                                                    |
| Disponibilidade mínima de estudo semanal | select       | Sim             | Q7 MatriculaUSA                                                                                    |

> **Nota Interna — Áreas de Interesse**
>
> A pergunta de cursos específicos (lista de 56) foi REMOVIDA e substituída por 4 grandes áreas.
>
> Isso evita objeções de candidatos que não encontram sua área específica (ex: Saúde).
>
> O candidato é obrigado a marcar exatamente 2 áreas — isso dilui expectativas de área única.
>
> O redirecionamento para os cursos disponíveis acontece internamente nas 24h pelo time.

> **Nota Interna — Regiões de Preferência (IMPORTANTE)**
>
> O campo de regiões existe para honrar o argumento de venda — o vendedor promete que o candidato escolherá sua região preferida.
>
> A resposta é coletada para fins de experiência do candidato e alinhamento com o processo comercial.
>
> As universidades apresentadas serão SEMPRE da California, independente da seleção feita.
>
> NÃO pré-selecionar California nem restringir a lista — candidato escolhe livremente 3 estados.
>
> O foco na tela de faculdades deve ser frequência, permissão de trabalho e valor anual.

## 5.2 Seção B — Documentos e Linha do Tempo

Perguntas absorvidas do MatriculaUSA Q11 a Q17:

| **Campo**                                                 | **Tipo** | **Obrigatório** | **Observação**                         |
|-----------------------------------------------------------|----------|-----------------|----------------------------------------|
| Você tem passaporte válido?                               | radio    | Sim             | Sim / Não — Q11                        |
| Consegue enviar cópia do passaporte?                      | radio    | Sim             | Sim / Não — Q12                        |
| Tem comprovação de conclusão do ensino médio ou superior? | radio    | Sim             | Sim, consigo enviar / Não — Q13        |
| Consegue organizar documentos em pasta online?            | radio    | Sim             | Sim / Não — Q14 (Google Drive/Dropbox) |
| Em quanto tempo quer iniciar o programa?                  | select   | Sim             | Faixas de prazo — Q15                  |
| Pode participar de entrevista de alinhamento?             | radio    | Sim             | Sim / Não — Q16                        |
| Entende que pular etapas atrasa o processo?               | radio    | Sim             | Sim / Não — Q17                        |

## 5.3 Seção C — Responsabilidade Financeira

Perguntas absorvidas do MatriculaUSA Q27, Q28 e Q29:

| **Campo**                                                | **Tipo** | **Obrigatório** | **Observação**                   |
|----------------------------------------------------------|----------|-----------------|----------------------------------|
| Entende que tuition e taxas do processo são diferentes?  | radio    | Sim             | Sim / Não — Q27                  |
| Se tiver bolsa, ainda é responsável por manter o status? | radio    | Sim             | Verdadeiro / Falso — Q28         |
| Forma de pagamento com mais facilidade                   | select   | Sim             | À vista / Parcelado / etc. — Q29 |

## 5.4 Seção D — Regras do Visto F-1

Perguntas absorvidas do MatriculaUSA Q31 a Q40 — formato múltipla escolha:

| **Campo**                                  | **Tipo**        | **Obrigatório** | **Observação**                                              |
|--------------------------------------------|-----------------|-----------------|-------------------------------------------------------------|
| O objetivo do visto F-1 é:                 | multiple choice | Sim             | Q31 — Estudar em instituição autorizada                     |
| O I-20 é:                                  | multiple choice | Sim             | Q32 — Documento da escola que sustenta o status F-1         |
| Manter status significa:                   | multiple choice | Sim             | Q33 — Cumprir regras, frequência e obrigações               |
| Se faltar muito e parar de estudar, posso: | multiple choice | Sim             | Q34 — Colocar meu status em risco                           |
| Para decisões críticas, devo:              | multiple choice | Sim             | Q35 — Consultar escola/DSO                                  |
| COS (Change of Status) é:                  | multiple choice | Sim             | Q36 — Mudar de status estando nos EUA                       |
| Transfer é:                                | multiple choice | Sim             | Q37 — Trocar SEVIS/I-20 de uma escola para outra            |
| Initial é:                                 | multiple choice | Sim             | Q38 — Processo para quem está fora dos EUA entrando com F-1 |
| Trabalhar sem autorização F-1 é:           | multiple choice | Sim             | Q39 — Risco sério, pode prejudicar o status                 |
| Se confuso sobre regra F-1, devo:          | multiple choice | Sim             | Q40 — Perguntar oficialmente à escola/DSO                   |

## 5.5 Seção E — Mentalidade e Comprometimento

Perguntas absorvidas do MatriculaUSA Q41 a Q50:

| **Campo**                                          | **Tipo**        | **Obrigatório** | **Observação**                                                  |
|----------------------------------------------------|-----------------|-----------------|-----------------------------------------------------------------|
| Ser aluno profissional significa:                  | multiple choice | Sim             | Q41 — Cumprir prazos, frequência, comunicação e consistência    |
| Para não perder prazos nos EUA, o melhor hábito é: | multiple choice | Sim             | Q42 — Calendário + lembretes + checar email diariamente         |
| Se tiver dificuldade em matéria, devo primeiro:    | multiple choice | Sim             | Q43 — Buscar tutor/office hours/advisor cedo                    |
| Networking na universidade serve para:             | multiple choice | Sim             | Q44 — Abrir portas acadêmicas e profissionais dentro das regras |
| O que leva mais gente a falhar:                    | multiple choice | Sim             | Q45 — Falta de consistência                                     |
| Prioridade mais importante agora:                  | select          | Sim             | Q46 — Valor / Flexibilidade / Autorização de trabalho           |
| Aceita receber feedback e ser corrigido?           | radio           | Sim             | Q47 — Sim / Não                                                 |
| Compromisso mínimo                                 | checkbox        | Sim             | Q48 — Manter frequência, cumprir prazos e seguir regras do F-1  |
| Plano de estudo semanal (dias + horas)             | textarea        | Sim             | Q49 — Texto livre descritivo                                    |
| Declaração final                                   | textarea        | Sim             | Q50 — Declaração de comprometimento pelo candidato              |

## 5.6 Perguntas Exclusivas por Serviço

> **Transfer — Pergunta Exclusiva**
>
> Pergunta: Qual é o seu prazo máximo de transferência?
>
> Tipo: campo de data (date picker) — obrigatório
>
> A data inserida cria um fluxo de prazo no cadastro e no dashboard.
>
> Dashboard: contador regressivo permanente com dias restantes até o prazo.
>
> Alertas automáticos: 30, 15, 7 e 1 dia antes do vencimento.

> **COS — Pergunta Exclusiva**
>
> Pergunta: Quando vence o seu status / I-94?
>
> Tipo: campo de data (date picker) — obrigatório
>
> A data inserida cria um fluxo de prazo no cadastro e no dashboard.
>
> Dashboard: contador regressivo permanente com dias restantes até o vencimento.
>
> Alertas automáticos: 60, 30, 15 e 7 dias antes do vencimento.
>
> ATENÇÃO: data crítica — vencimento do I-94 tem consequências imigratórias sérias.

## 5.7 Tela de Conclusão do Questionário

- Card de conclusão exibido na mesma página após finalizar o questionário

- Ícone de troféu / conquista no topo

- Título: Perfil enviado com sucesso!

- Animação: contador sobe de 0 até 1.481 em tempo real simulando o envio

- Texto: Seu perfil foi encaminhado para 1.481 instituições credenciadas no SEVIS pelo DHS.

- Fonte oficial: link para studyinthestates.dhs.gov — sem exibir data, apenas DHS / Study in the States

- Resumo da candidatura: Nome, Email, WhatsApp, Perfil/Serviço, Formação, Nível de inglês

- Card de retorno: Em até 24 horas você saberá quais universidades pré-aceitaram sua candidatura

- Nota de email: Email de confirmação enviado para \[email do candidato\]

- Botão Escolher Faculdades → DESABILITADO e bloqueado até retorno das universidades (24h)

> **Após 24 horas — Dashboard Atualizado**
>
> Botão Escolher Faculdades é liberado no dashboard do candidato.
>
> Card de parabéns exibido com resumo da candidatura.
>
> Candidato acessa lista de faculdades que pré-aceitaram seu perfil.

# 6. Fluxo Pós-Questionário — Aprovação do Contrato

Após finalizar o questionário, o candidato fica em estado de espera. Duas coisas acontecem em paralelo nas 24 horas seguintes, ambas necessárias para liberar o avanço no processo.

## 6.1 O que acontece nas 24 horas

> **Duas ações em paralelo — ambas obrigatórias para liberar o próximo passo**
>
> 1. Universidades analisam o perfil e confirmam pré-aceite.
>
> 2. Admin da Migma revisa e aprova o contrato do cliente.
>
> Somente após AMBAS concluídas o botão Escolher Faculdades é liberado.

## 6.2 Visão do Cliente durante a espera

- Tela de conclusão do questionário permanece visível

- Card de status: Aguardando análise do seu perfil...

- Botão Escolher Faculdades desabilitado com contador de 24h

- Notificação email + WhatsApp confirmando recebimento do perfil

## 6.3 Visão do Admin — Aprovação do Contrato

- Admin acessa o dashboard e vê o card do cliente com status AGUARD. APROVAÇÃO

- Visualiza: Termos aceitos (Terms of Service + Privacy Policy) com data de aceite

- Visualiza: Verificação de identidade (selfie com documento) — status Pending Review

- Visualiza: Assinatura digital capturada

- Botões de ação: Aprovar (verde) ou Rejeitar (vermelho)

> **Sobre o Contrato — Importante**
>
> O cliente NÃO visualiza o contrato interno da Migma dentro do sistema.
>
> Ao aprovar, o sistema dispara automaticamente o email padrão da Migma com o contrato para o cliente.
>
> O email segue o padrão já utilizado pela Migma — mesmo layout e conteúdo atual.
>
> Registrar timestamp da aprovação + IP do admin no banco de dados.

## 6.4 Após Aprovação — Notificações Automáticas

- Email automático para o cliente com contrato no padrão Migma

- WhatsApp automático: Seu perfil foi aprovado! Acesse sua conta para escolher sua universidade.

- Botão Escolher Faculdades liberado no dashboard do cliente

- Status atualizado no dashboard admin: AGUARD. ESCOLHA DE FACULDADE

# 7. Tela de Escolha de Faculdades

## 7.1 Cabeçalho e Mensagem

- Título: Escolha sua Universidade

- Subtítulo: Parabéns! Com base no seu perfil, selecionamos as universidades credenciadas no SEVIS que pré-aceitaram sua candidatura. Escolha até 4 opções para prosseguir com sua candidatura.

## 7.2 Guia Rápido

- Use os filtros para buscar por universidade, área de estudo ou nível de bolsa

- Clique em qualquer card para ver detalhes e escolher o nível de bolsa

- Selecione até 4 universidades simultaneamente

- Clique em Continuar após selecionar ao menos uma

## 7.3 Filtros

| **Campo**             | **Tipo** | **Obrigatório** | **Observação**                               |
|-----------------------|----------|-----------------|----------------------------------------------|
| Palavra-chave         | text     | Não             | Busca livre por nome de bolsa ou curso       |
| Universidade          | select   | Não             | Lista de universidades disponíveis           |
| Nível de Estudo       | select   | Não             | Graduação / Pós-Graduação / Doutorado        |
| Área de Estudo        | select   | Não             | Os 56 cursos do catálogo da Migma            |
| Modalidade            | select   | Não             | Apenas Híbrido e Presencial — remover Online |
| Frequência            | select   | Não             | Aparece SOMENTE quando Híbrido selecionado   |
| Permissão de Trabalho | select   | Não             | OPT / CPT / Ambos                            |
| Valor Mínimo          | number   | Não             | Tuition mínima com bolsa                     |
| Valor Máximo          | number   | Não             | Tuition máxima com bolsa                     |

> **Nota Dev — Filtro de Frequência**
>
> O campo Frequência só aparece quando o filtro Modalidade estiver definido como Híbrido.
>
> Quando Presencial selecionado: ocultar campo de Frequência.
>
> Quando Todas as Modalidades: ocultar campo de Frequência.

## 7.4 Cards de Faculdades

- 1 card por faculdade — não repetir cards da mesma universidade

- Card exibe: logo, nome da universidade, localização, modalidade, autorização de trabalho (OPT/CPT)

- Badge de destaque: Destaque / Exclusivo / Esgotada conforme status

- Visão geral financeira no card: Preço original, Com Bolsa, Desconto %, Taxa de Colocação

- Botão Detalhes — abre modal completo

- Botão Selecionar — ativo somente após escolher nível de bolsa no modal

## 7.5 Modal de Detalhes da Faculdade

O modal é o coração da automação da mentoria — o candidato deve conseguir tomar toda a decisão sozinho aqui, sem precisar perguntar para ninguém.

### Seção 1 — Identificação

- Logo + nome da universidade + localização

- Site oficial (link externo)

- Badges: Aceita COS / Aceita Transfer

- Tipo de curso selecionado + nível acadêmico + modalidade

### Seção 2 — Escolha do Nível de Bolsa (interativa)

- Texto explicativo: Quanto maior o Placement Fee que você paga agora, menor será sua tuition anual durante todo o curso.

- Tabela interativa com as linhas de bolsa disponíveis para aquele curso

- Colunas: Tuition Anual \| % de Desconto \| Placement Fee

- Candidato clica na linha desejada — linha selecionada fica destacada em dourado

- Calculadora automática exibe: Se você estudar X anos, você economiza \$Y no total

- Recomendação automática: destacar a opção mais escolhida com badge Mais Popular

### Seção 3 — Quanto vou pagar? (3 momentos)

- AGORA — Para confirmar sua vaga:

  - Placement Fee: \$X — Este valor garante sua bolsa e confirma sua vaga

- APÓS ACEITE — Para efetivar a matrícula:

  - Taxa I-20 / Application Fee: \$350 (+ \$100 por dependente) — Obrigatória para emissão do I-20

- AO INICIAR O CURSO — Taxa única:

  - Orientation Day: \$300 — Dia obrigatório de orientação presencial no campus

  - Teste de Inglês: \$50 se aplicável

  - Material didático: informado pela universidade após definição das matérias

- ANUALMENTE — Tuition:

  - Valor com bolsa escolhida: \$X/ano — estruturado em 12 parcelas mensais pela universidade

- Calculadora: Investimento estimado no primeiro ano completo: \$X

### Seção 4 — Informações do Programa

- Tipos de curso disponíveis (lista completa da faculdade)

- Duração: Bacharelado X anos / Mestrado X anos

- Permissão de trabalho em linguagem simples:

  - CPT: autorização para trabalhar durante o curso (após X meses ou no primeiro dia para Mestrado)

  - OPT: autorização para trabalhar após formado (1 ano ou 3 anos para cursos STEM)

- Frequência presencial: X vez(es) por semestre (X dias consecutivos)

### Seção 5 — Requisitos

- GPA mínimo exigido

- Proficiência em inglês: TOEFL, IELTS, Duolingo ou entrevista com diretor acadêmico

- Documentação necessária listada de forma clara

### Seção 6 — FAQ Inline

- O que é Placement Fee? — respondido inline sem sair do modal

- O que é CPT e OPT? — respondido inline

- Posso mudar de bolsa depois? — respondido inline

- O que acontece se eu não for aprovado? — respondido inline

### Seção 7 — Benefício por Indicação

- 10 indicações efetivadas = tuition reduzida para \$3.800/ano

- Explicação clara de como funciona o programa de indicação

## 7.6 Tela de Revisão das Faculdades Selecionadas

- Título: Revise suas Universidades Selecionadas

- Aviso: Esta é uma escolha definitiva. Ao confirmar, você não poderá mais alterar as universidades escolhidas.

- Lista de cada seleção: Universidade \| Curso \| Nível de Bolsa \| Placement Fee \| Tuition anual

- Botão X para remover item antes de confirmar

- Botões: Voltar para Seleção \| Continuar

## 7.7 Modal de Confirmação Definitiva

- Ícone de alerta

- Título: Confirmar Seleção

- Texto: Ao confirmar, você não poderá mais alterar as universidades escolhidas. Revise cuidadosamente antes de prosseguir.

- Botão primário: Confirmar

- Link secundário: Revisar Novamente

# 8. Dashboard Admin — Aprovação de Bolsa e Geração de Link

## 8.1 O que o Admin vê

- Card do cliente com status: AGUARD. APROVAÇÃO DE BOLSA

- Seleções do cliente: até 4 faculdades com curso + nível de bolsa + Placement Fee de cada

- Perfil completo do cliente: questionário, documentos, área de interesse, formação

- Prazo de transferência (Transfer) ou vencimento I-94 (COS) em destaque

## 8.2 Critérios de Aprovação (baseados no CRM Migma)

- Perfil financeiro compatível com I-20 da faculdade

- Curso coerente com histórico acadêmico e profissional do cliente

- Instituição com histórico positivo de aprovação

- Início de aulas compatível com timing do processo

## 8.3 Ação do Admin

- Admin seleciona qual das 4 opções será aprovada

- Clica em Aprovar Bolsa

- Sistema gera automaticamente o link de pagamento do Placement Fee correspondente

- Sistema dispara notificação email + WhatsApp para o cliente

- Status atualizado: AGUARD. PAGAMENTO PLACEMENT FEE

> **Notificação ao Cliente — Bolsa Aprovada**
>
> Email: Sua vaga foi aprovada! Caroline University — MBA — Bolsa 70% — Placement Fee $1.800.
>
> WhatsApp: mesma mensagem com link direto para pagamento.
>
> Cliente acessa o sistema e vê o link de pagamento gerado automaticamente.
>
> Após pagamento confirmado: status atualiza para PLACEMENT FEE PAGO.

# 9. Fluxo Pós-Pagamento do Placement Fee

## 9.1 Sequência de Pagamentos

> **Ordem dos Pagamentos — Transfer**
>
> 1. Taxa do Processo Seletivo: $400 (+ $150 por dependente) — no checkout inicial
>
> 2. Placement Fee: valor conforme bolsa aprovada — após aprovação do admin
>
> 3. Application Fee / Taxa I-20: $350 (+ $100 por dependente) — após envio de documentos
>
> Estratégia: Bank Statement solicitado APÓS Placement Fee para evitar objeção financeira antes do comprometimento.

## 9.2 Tela de Envio de Documentos

Liberada somente após confirmação do pagamento do Placement Fee. Sistema solicita documentos específicos da faculdade aprovada.

- Instrução geral: Garanta que os documentos estejam legíveis e em inglês. Para traduções, recomendamos lushamerica.com

### Documentos Obrigatórios — Transfer (Caroline University)

| **Campo**                              | **Tipo** | **Obrigatório** | **Observação**                           |
|----------------------------------------|----------|-----------------|------------------------------------------|
| Passaporte (página de identificação)   | upload   | Sim             | JPG ou PNG, máx 20MB                     |
| I-20 da escola anterior                | upload   | Sim             | PDF, máx 20MB                            |
| I-94                                   | upload   | Sim             | PDF ou JPG, máx 20MB                     |
| Cópia do visto F-1                     | upload   | Sim             | JPG ou PNG, máx 20MB                     |
| Histórico escolar / Diploma            | upload   | Sim             | Traduzido para inglês se necessário      |
| Comprovante de Fundos (Bank Statement) | upload   | Sim             | Mín. \$22.000 + \$5.000 por dependente   |
| Endereço nos EUA                       | upload   | Sim             | Utility bill ou correspondência bancária |
| Endereço no Brasil                     | upload   | Sim             |                                          |
| Certidão de casamento                  | upload   | Não             | Se aplicável                             |
| Certidão de nascimento dos filhos      | upload   | Não             | Se aplicável — um por dependente         |

> **Card Explicativo — Bank Statement (quebra de objeção)**
>
> Exibir antes do campo de upload do Bank Statement:
>
> O Bank Statement NÃO é o valor que você vai gastar. É apenas uma comprovação para imigração
>
> de que você tem capacidade financeira. Pode ser: conta corrente, poupança, investimentos,
>
> conta de familiar ou patrocinador, ou combinação de contas.
>
> Não tem o valor disponível agora? Entre em contato com nossa equipe — temos soluções.

## 9.3 Dashboard Admin — Aprovação de Documentos

- Admin recebe notificação: cliente X enviou documentos

- Visualiza cada documento enviado com opção de Aprovar / Solicitar Correção

- Ao solicitar correção: sistema notifica cliente via email + WhatsApp com o que precisa ser corrigido

- Ao aprovar todos os documentos: status atualiza para DOCUMENTAÇÃO APROVADA

- Sistema gera link de pagamento da Application Fee automaticamente

- Notificação ao cliente: Documentos aprovados! Próximo passo: pagamento da Taxa I-20 (\$350)

## 9.4 Formulários da Faculdade — Geração Automática

Após aprovação dos documentos, o sistema gera automaticamente os formulários da faculdade aprovada com os dados do cliente pré-preenchidos:

### Caroline University — Formulários gerados automaticamente:

- Application Form — dados pessoais, visto, curso, início das aulas

- I-20 Request Form — dados pessoais

- Statement of Institutional Purpose — pré-preenchido

- Statement of Understanding — pré-preenchido

- Tuition Refund Policy — pré-preenchido

- Affidavit of Financial Support — se houver patrocinador

- Letter of Recommendation — preenchido pelo próprio aluno + assinatura de terceiro

- Scholarship Support & Compliance Agreement — específico da Caroline

- Termo de Responsabilidade do Estudante — DOCUMENTO INTERNO, nunca vai para a faculdade

> **Fluxo de Assinatura dos Formulários**
>
> Sistema pré-preenche todos os formulários com dados do cadastro do cliente.
>
> Admin revisa e confirma que os dados estão corretos.
>
> Sistema envia formulários ao cliente para conferência e assinatura digital.
>
> Cliente assina e confirma — sistema recebe os documentos assinados.
>
> Admin faz upload e envio para a faculdade via email institucional.
>
> Termo de Responsabilidade: gerado, assinado pelo cliente e salvo internamente — nunca enviado à faculdade.

# 10. Catálogo de Instituições Parceiras

O sistema conta com 15 instituições parceiras divididas em dois grupos: universidades e escolas de ensino superior, e escolas de inglês (ESL). O catálogo completo está disponível para cadastro no painel administrativo.

> **Narrativa — De 1.481 para 15 instituições (IMPORTANTE)**
>
> Tela de conclusão do questionário: Seu perfil foi enviado para 1.481 instituições credenciadas no SEVIS.
>
> Tela de escolha de faculdades: De 1.481 instituições candidatadas, X universidades analisaram seu perfil e confirmaram pré-aceite.
>
> Isso é coerente, defensável e reforça exclusividade — o filtro é explicado pelo pré-aceite.
>
> Transforma o número pequeno em argumento de valor: de 1.481, apenas estas aprovaram você.

## 10.1 Universidades e Escolas de Ensino Superior

Estas são as instituições que aparecem na tela de escolha de faculdades para candidatos de Transfer e COS:

| **Instituição**                  | **Localização**                     | **Modalidade**        | **CPT**           | **COS / Transfer** |
|----------------------------------|-------------------------------------|-----------------------|-------------------|--------------------|
| CSI — Computer Systems Institute | Boston MA / Chicago IL              | Híbrido ou Presencial | Após 9 meses      | ✅ Ambos           |
| Trine University                 | Detroit MI / Phoenix AZ / Reston VA | Híbrido               | 1º dia            | ✅ Ambos           |
| Caroline University              | Los Angeles, CA                     | Híbrido               | 1º dia (Mestrado) | ✅ Ambos           |
| Oikos University                 | Los Angeles, CA                     | Híbrido               | A confirmar       | ✅ Ambos           |
| American National University     | A confirmar                         | A confirmar           | A confirmar       | ✅ Ambos           |
| Excel — Dallas, TX               | Dallas, TX                          | A confirmar           | A confirmar       | ✅ Ambos           |
| ILI — Washington, MD             | Washington, MD                      | A confirmar           | A confirmar       | ✅ Ambos           |
| ALA — Charlotte, NC              | Charlotte, NC                       | A confirmar           | A confirmar       | ✅ Ambos           |
| Internexus — Provo, UT           | Provo, UT                           | A confirmar           | A confirmar       | ✅ Ambos           |
| AAE — San Francisco, CA          | San Francisco, CA                   | A confirmar           | A confirmar       | ✅ Ambos           |

## 10.2 Escolas de Inglês — ESL

Escolas de inglês aparecem para candidatos com nível Zero ou Básico no questionário, ou conforme indicação do admin. Não aparecem por padrão na tela principal de escolha de faculdades.

| **Instituição**                            | **Localização**             | **COS / Transfer** |
|--------------------------------------------|-----------------------------|--------------------|
| CSI — ESL (English as a Second Language)   | Boston MA / Chicago IL      | ✅ Ambos           |
| Uceda School — Orlando, FL                 | Orlando, FL                 | ✅ Ambos           |
| Uceda School — Boca Raton, FL              | Boca Raton, FL              | ✅ Ambos           |
| Uceda School — Elizabeth / Long Branch, NJ | Elizabeth / Long Branch, NJ | ✅ Ambos           |
| Uceda School — Las Vegas, NV               | Las Vegas, NV               | ✅ Ambos           |

> **Nota Dev — Exibição das Escolas ESL**
>
> Escolas de inglês NÃO aparecem por padrão na tela de escolha de faculdades.
>
> Exibir escolas ESL quando: candidato marcou nível de inglês Zero ou Básico no questionário.
>
> Ou quando o admin indicar manualmente no dashboard que o candidato precisa de ESL primeiro.
>
> Escolas ESL podem ser filtradas separadamente na tela de escolha.

## 10.3 Detalhamento das Principais Instituições

### CSI — Computer Systems Institute

- Localização: Boston MA e Chicago IL

- Cursos: Business Career Program (Fundamentals, Digital Multimedia, Finance, Marketing, Hospitality Leadership, Organizational Administration), Customer Service Specialist, Networking / Web Development

- Modalidade: Híbrido ou Presencial conforme curso

- Frequência: varia por curso — de 1x/semana até 100% presencial (CSS)

- Duração: 1 ano + 1 ano de OPT

- CPT: após 9 meses (maioria dos cursos) \| CSS: CPT obrigatório desde o 1º dia

- Application Fee: USD 150 \| Bank Statement: USD 13.160–15.800 + USD 3.000/dep.

- Inglês: nivelamento interno (Off2Class ou e-test) — nível mínimo B1 ou B2 conforme curso

- Benefício por indicação: 10 indicações = tuition USD 7.000/ano

### Trine University

- Localização: Detroit MI / Phoenix AZ / Reston VA

- Cursos: Mestrado em Administração de Empresas, Análise de Negócios, Gestão de Engenharia, Estudos da Informação

- Modalidade: Híbrido \| Frequência: 1x/semestre (8 horas consecutivas)

- Duração: 2 anos \| CPT: 1º dia \| OPT: 1 ano

- Tuition: USD 7.000/ano (após bolsa) \| Health insurance: USD 750/semestre (obrigatório)

- Application Fee: USD 350 + USD 100/dep. \| Bank Statement: USD 22.000 + USD 4.000/dep.

- Inglês: TOEFL, IELTS, Duolingo ou transcript de escola americana

- Exige: 1 Carta de Apresentação + 3 Cartas de Recomendação

- Benefício por indicação: 10 indicações = tuition USD 7.000/ano

### Caroline University

- Localização: Los Angeles CA (possibilidade futura: NY, Boston, Miami)

- Cursos: Bacharelado em Administração, Mestrado MBA, Computer Science (10 ênfases), Business Analytics (10 ênfases), Filosofia

- Modalidade: Híbrido \| Frequência: 1x/semestre (3 dias consecutivos)

- Duração: Bacharelado 4 anos / Mestrado 2 anos

- CPT: 1º dia (Mestrado) / após 9 meses (Bacharelado) \| OPT: 1 ano / 3 anos STEM

- Application Fee: USD 350 + USD 100/dep. \| Bank Statement: USD 22.000 + USD 5.000/dep.

- Inglês: TOEFL, IELTS, Duolingo ou entrevista com diretor acadêmico \| GPA mínimo: 3.5

- Orientation Day: USD 300 (taxa única) \| Teste de Inglês: USD 50 se aplicável

- Benefício por indicação: 10 indicações = tuition USD 3.800/ano

### Oikos University

- Localização: Los Angeles CA (possibilidade futura: NY, Boston, Miami)

- Cursos: Bacharelado e Mestrado em Business, Filosofia e Teologia

- Modalidade: Híbrido \| Frequência: 1x/semestre (3 dias consecutivos)

- Duração: Bacharelado 4 anos / Mestrado 2 anos

> **Nota — Demais Instituições**
>
> As informações detalhadas de American National University, Excel, ILI, ALA, Internexus e AAE
>
> estão disponíveis no documento Guia de Instituições Educacionais da Migma/Brant Immigration.
>
> Devem ser cadastradas no sistema administrativo pelo time interno com base nesse guia.
>
> Cada instituição terá sua tabela de bolsas, documentação exigida e regras específicas.

# 11. Mapeamento de Formulários — Caroline e Oikos

Esta seção mapeia todos os dados necessários para preencher automaticamente os formulários de matrícula da Caroline University e Oikos University, identificando de onde cada dado vem e o que precisa ser coletado em cada etapa.

## 11.1 Formulários da Caroline University

| **Formulário**                             | **Preenchimento**                                              | **Assinatura**                                 |
|--------------------------------------------|----------------------------------------------------------------|------------------------------------------------|
| Application for Admission                  | IA preenche com dados do cadastro                              | Cliente assina digitalmente                    |
| I-20 Request Form                          | IA preenche com dados do cadastro                              | Cliente assina digitalmente                    |
| Letter of Recommendation                   | IA preenche nome do candidato — recomendante preenche o resto  | Recomendante assina (digital ou nome digitado) |
| Affidavit of Financial Support             | IA preenche dados do estudante — sponsor preenche a parte dele | Sponsor assina                                 |
| Tuition Refund Policy                      | Texto fixo — IA preenche nome, programa e data                 | Cliente assina digitalmente                    |
| Statement of Institutional Purpose         | Texto fixo — IA preenche nome, programa e data                 | Cliente assina digitalmente                    |
| Scholarship Support & Compliance Agreement | IA preenche — Agency: MIGMA INC (sempre)                       | Cliente + representante Migma assinam          |

## 11.2 Formulários da Oikos University

| **Formulário**                             | **Preenchimento**                                                       | **Assinatura**                                 |
|--------------------------------------------|-------------------------------------------------------------------------|------------------------------------------------|
| Application for Admission                  | IA preenche com dados do cadastro                                       | Cliente assina digitalmente                    |
| I-20 Request Form                          | IA preenche com dados do cadastro                                       | Cliente assina digitalmente                    |
| Letter of Recommendation                   | IA preenche nome do candidato — recomendante preenche o resto           | Recomendante assina (digital ou nome digitado) |
| Affidavit of Financial Support             | IA preenche dados do estudante — sponsor preenche a parte dele          | Sponsor assina                                 |
| Enrollment Agreement                       | IA preenche dados do estudante — MatriculaUSA preenche parte financeira | Cliente assina digitalmente                    |
| Statement of Institutional Purpose         | Texto fixo — IA preenche nome e data                                    | Cliente assina digitalmente                    |
| Statement of Faith                         | Texto fixo — IA preenche nome e data                                    | Cliente assina digitalmente                    |
| Code of Conduct                            | Texto fixo — IA preenche nome e data                                    | Cliente assina digitalmente                    |
| Refund Policy                              | Texto fixo — IA preenche nome e data                                    | Cliente assina digitalmente                    |
| Agreement to Complete Mandatory Intensives | Texto fixo — IA preenche nome e data                                    | Cliente assina digitalmente                    |
| Christian Faith Statement                  | IA gera rascunho base — cliente edita e assina                          | Cliente assina digitalmente                    |

> **Scholarship Support & Compliance Agreement — IMPORTANTE**
>
> Este documento é específico da Caroline University.
>
> O campo Agency deve ser preenchido SEMPRE como MIGMA INC.
>
> O campo Authorized Representative é assinado pelo representante da Migma.
>
> Confirmar com equipe jurídica se substituição de The Future of English por MIGMA INC é permitida contratualmente.

## 11.3 Mapeamento de Dados — De onde cada campo vem

Dados preenchidos automaticamente pela IA com informações já coletadas:

| **Campo nos Formulários**           | **Fonte dos Dados**                        |
|-------------------------------------|--------------------------------------------|
| Nome completo (Last/First/Middle)   | Step 1 + passaporte                        |
| Data de nascimento                  | Step 2                                     |
| Endereço (rua, cidade, estado, CEP) | Step 2                                     |
| Email                               | Step 1                                     |
| Telefone / WhatsApp                 | Step 1                                     |
| Estado civil (Single/Married)       | Step 2                                     |
| País de cidadania / nacionalidade   | Step 2                                     |
| Tipo de visto (F-1, B1-B2)          | URL do serviço (Transfer/COS)              |
| Tipo de processo (Transfer/COS/New) | URL do serviço                             |
| Curso escolhido / Degree Program    | Escolha de faculdades                      |
| Gênero (M/F)                        | IA extrai do passaporte automaticamente    |
| Local de nascimento (cidade/país)   | IA extrai do passaporte automaticamente    |
| Diploma ensino médio (Yes/No)       | Diploma enviado no Step 2                  |
| Histórico acadêmico                 | Diploma/transcrito enviado                 |
| Endereço nos EUA                    | Proof of Address US (Global Documents)     |
| Endereço no Brasil                  | Proof of Address Brazil (Global Documents) |
| Dados dos dependentes F-2           | Certidão traduzida (Global Documents)      |
| Como soube da universidade          | Sempre: Brant Immigration                  |
| Agency (Scholarship Agreement)      | Sempre: MIGMA INC                          |
| Data atual                          | Sistema gera automaticamente               |

## 11.4 Tela de Dados Complementares

Tela exibida no dashboard do cliente após aprovação da bolsa e antes da geração dos formulários. Coleta dados específicos necessários para completar os formulários que não foram coletados anteriormente.

| **Campo**                                   | **Tipo** | **Obrigatório** | **Observação**                                       |
|---------------------------------------------|----------|-----------------|------------------------------------------------------|
| Contato de emergência — Nome                | text     | Sim             | Coletado no Step 2 junto com os dados complementares |
| Contato de emergência — Telefone            | tel      | Sim             |                                                      |
| Contato de emergência — Relacionamento      | text     | Sim             | Ex: pai, mãe, cônjuge                                |
| Contato de emergência — Endereço            | text     | Sim             |                                                      |
| Início das aulas preferido                  | select   | Sim             | Spring / Summer / Fall + ano                         |
| Tem sponsor financeiro?                     | radio    | Sim             | Sim / Não                                            |
| Sponsor — Nome completo                     | text     | Condicional     | Apenas se tiver sponsor                              |
| Sponsor — Relacionamento                    | text     | Condicional     | Ex: pai, cônjuge, empresa                            |
| Sponsor — Telefone                          | tel      | Condicional     |                                                      |
| Sponsor — Endereço completo                 | text     | Condicional     |                                                      |
| Sponsor — Empregador atual                  | text     | Condicional     | Caroline exige                                       |
| Sponsor — Cargo                             | text     | Condicional     | Caroline exige                                       |
| Sponsor — Anos no emprego                   | number   | Condicional     | Caroline exige                                       |
| Sponsor — Renda anual bruta                 | text     | Condicional     | Caroline exige — Must Be Verified                    |
| Sponsor — Valor comprometido/ano (USD)      | number   | Condicional     |                                                      |
| Experiência profissional 1 — Empresa/Igreja | text     | Não             | Até 3 entradas                                       |
| Experiência profissional 1 — Período        | text     | Não             |                                                      |
| Experiência profissional 1 — Cargo          | text     | Não             |                                                      |
| Recomendante 1 — Nome                       | text     | Sim             | Caroline pede 2 recomendantes / Oikos pede 1         |
| Recomendante 1 — Cargo/Posição              | text     | Sim             | Professor, Pastor, Supervisor ou Mentor              |
| Recomendante 1 — Telefone ou Email          | text     | Sim             |                                                      |
| Recomendante 2 — Nome                       | text     | Condicional     | Apenas para Caroline                                 |
| Recomendante 2 — Cargo/Posição              | text     | Condicional     |                                                      |
| Recomendante 2 — Telefone ou Email          | text     | Condicional     |                                                      |

## 11.5 Global Documents — Documentos Solicitados no Dashboard

Após confirmação do pagamento do Placement Fee, o sistema solicita automaticamente os seguintes documentos no dashboard do cliente. Cada documento tem tags indicando para qual tipo de processo se aplica:

| **Documento**                                               | **Transfer** | **COS** | **Observação**                        |
|-------------------------------------------------------------|--------------|---------|---------------------------------------|
| Certidão de casamento/nascimento traduzida (se dependentes) | ✅           | ✅      | Só se tiver dependentes               |
| Proof of address nos EUA                                    | ✅           | ✅      | Comprovante de endereço americano     |
| Proof of address no Brasil (traduzido)                      | ✅           | ✅      | Site indicado: thefutureofenglish.com |
| Transcrito acadêmico traduzido                              | ✅           | ✅      | Site indicado: thefutureofenglish.com |
| I-797A (aprovação de mudança de status)                     | ✅           | ✅      | Se aplicável                          |
| I-20 da escola atual                                        | ✅           | ❌      | Apenas Transfer                       |
| Passaporte e visto (aplicante + dependentes)                | ✅           | ✅      |                                       |
| I-94                                                        | ✅           | ✅      | Link direto: i94.cbp.dhs.gov          |

## 11.6 Pacote Final de Assinatura Digital

Após preenchimento automático pela IA, o cliente recebe no dashboard o pacote completo para assinar. O fluxo de assinatura é o mesmo para ambas as universidades:

- Sistema exibe cada formulário preenchido pela IA para revisão do cliente

- Cliente lê e assina cada documento digitalmente com o dedo (canvas)

- Durante a assinatura: captura de selfie com documento + IP + timestamp + geolocalização + device fingerprint

- Carta de Recomendação: instrução didática clara — cliente entrega para o recomendante assinar (digital ou nome digitado)

- Após todos assinados: sistema notifica admin da Migma

- Admin da Migma baixa o pacote completo e envia via integração para o MatriculaUSA processar

- MatriculaUSA encaminha para a universidade (Caroline ou Oikos)

> **Carta de Recomendação — Instrução ao Cliente**
>
> Instrução exibida no sistema: Esta carta deve ser preenchida por alguém que te conhece bem —
>
> professor, pastor, supervisor ou familiar de confiança.
>
> Importante: essa pessoa pode ser contatada pela universidade para confirmar a recomendação.
>
> Escolha alguém disponível e que possa confirmar as informações caso seja contactado.
>
> A assinatura pode ser digital ou o nome completo digitado no campo indicado.
>
> Entregue o formulário para o recomendante, ele preenche e devolve para você incluir no pacote.

# 12. Dashboard do Cliente — Funcionalidades

## 12.1 Seções do Dashboard

| **Seção**                | **Descrição**                                                    | **Equivalente MatriculaUSA** |
|--------------------------|------------------------------------------------------------------|------------------------------|
| Visão Geral              | Progresso do processo, KPIs, próximos passos                     | Dashboard Overview           |
| Minhas Candidaturas      | Status de cada candidatura e documentos                          | Minhas Aplicações            |
| Documentos Pendentes     | Lista de documentos solicitados pelo sistema/admin               | Global Document Requests     |
| Dados Complementares     | Formulário com dados adicionais para os formulários da faculdade | Não existe no MatriculaUSA   |
| Formulários para Assinar | Pacote completo gerado pela IA para assinatura digital           | Não existe no MatriculaUSA   |
| Programa de Indicação    | Link trackeado + Calendly + contador de indicações fechadas      | Rewards (adaptado)           |
| Suporte                  | Chat com agente IA Equipe Migma                                  | Chat de Suporte (melhorado)  |
| Perfil                   | Dados pessoais e acadêmicos do estudante                         | Student Profile              |

## 12.2 Programa de Indicação

- Cliente gera um link único de indicação com tracking

- Link leva para página com Calendly para agendamento de reunião com time de vendas

- Sistema rastreia o lead desde o primeiro clique no link

- Quando lead fecha/contrata: sistema atrelha o fechamento ao link do indicador

- Dashboard do cliente exibe: contador de indicações fechadas em tempo real

- Meta: 10 indicações fechadas = tuition reduzida para \$3.800/ano automaticamente

- Compartilhamento rápido: WhatsApp, Email, copiar link

> **Dev — Rastreamento de Indicações**
>
> Sugestão técnica: UTM + webhook do Calendly ao agendar → código do indicador salvo no lead.
>
> Quando admin marca o lead como fechado no CRM → sistema credita +1 indicação no contador do cliente.
>
> Ao atingir 10 indicações fechadas → sistema atualiza automaticamente o valor da tuition para $3.800.
>
> Notificação automática ao cliente: Parabéns! Você atingiu 10 indicações. Sua tuition foi reduzida para $3.800/ano.

## 12.3 Chat de Suporte — Agente IA

> **Agente IA — Equipe Migma**
>
> O chat de suporte é alimentado por um agente de IA que se apresenta como Equipe Migma.
>
> O cliente nunca sabe que está falando com IA — a experiência deve ser indistinguível de um atendente humano.
>
> Base de conhecimento: toda a spec documentada + guia de instituições + prompts internos da Migma.
>
> O agente responde sobre: processo, documentos, universidades, bolsas, pagamentos, visto F-1, COS, Transfer.
>
> Escalação para humano: apenas quando a IA identificar problema grave que não conseguiu resolver.
>
> API de IA: decisão do desenvolvedor (Claude/GPT ou equivalente).
>
> Os 2 prompts internos da Migma devem ser integrados como base de conhecimento do agente.

# 13. Integrações e Automações

## 13.1 Integração Migma → MatriculaUSA

- Integração direta entre os sistemas — implementação a cargo dos devs

- Trigger: após cliente assinar todos os formulários digitalmente

- Sistema Migma envia automaticamente o pacote completo para o MatriculaUSA

- MatriculaUSA processa e encaminha para a universidade (Caroline ou Oikos)

- Zero intervenção humana nessa etapa

## 13.2 Aprovação Automática de Bolsa — 24 horas

- Trigger: cliente paga o Placement Fee

- Timer de 24h inicia automaticamente

- Sistema verifica se Caroline ou Oikos está na seleção do cliente

- Caroline na lista → aprova Caroline automaticamente ao fim do timer (prioridade)

- Só Oikos → aprova Oikos automaticamente ao fim do timer

- Nenhuma das duas → alerta imediato para humano responsável + timer de 24h para humano agir

- Notificação automática ao cliente: email + WhatsApp com detalhes da aprovação

## 13.3 Notificações — WhatsApp via Z-API

Todos os eventos do processo disparam notificação dupla: email + WhatsApp. Lista completa de triggers:

| **Trigger**                                                       | **Canal**        | **Destinatário** |
|-------------------------------------------------------------------|------------------|------------------|
| Pagamento da Taxa do Processo Seletivo confirmado                 | Email + WhatsApp | Cliente          |
| Questionário recebido — perfil enviado às 1.481 instituições      | Email + WhatsApp | Cliente          |
| Contrato aprovado pelo admin                                      | Email + WhatsApp | Cliente          |
| Bolsa aprovada — link de pagamento do Placement Fee gerado        | Email + WhatsApp | Cliente          |
| Placement Fee pago — solicitação de documentos                    | Email + WhatsApp | Cliente          |
| Documento rejeitado — solicitação de correção com detalhes        | Email + WhatsApp | Cliente          |
| Todos os documentos aprovados — link de pagamento Application Fee | Email + WhatsApp | Cliente          |
| Formulários gerados — envio para assinatura digital               | Email + WhatsApp | Cliente          |
| Pacote assinado enviado ao MatriculaUSA                           | Email + WhatsApp | Cliente          |
| Nova pendência criada pelo admin                                  | Email + WhatsApp | Cliente          |
| Alerta de prazo Transfer (30, 15, 7 e 1 dia antes)                | Email + WhatsApp | Cliente          |
| Alerta de prazo COS / I-94 (60, 30, 15 e 7 dias antes)            | Email + WhatsApp | Cliente          |
| Dependentes: pendência de dados ou documentos                     | Email + WhatsApp | Cliente          |
| Meta de 10 indicações atingida — tuition reduzida                 | Email + WhatsApp | Cliente          |
| Nova indicação fechada — contador atualizado                      | Email + WhatsApp | Cliente          |
| Novos documentos recebidos para revisão                           | Email + WhatsApp | Admin Migma      |
| Pacote completo pronto para envio ao MatriculaUSA                 | Email + WhatsApp | Admin Migma      |
| Alerta: cliente sem Caroline/Oikos — requer intervenção humana    | Email + WhatsApp | Admin Migma      |

> **Nota — Notificações**
>
> Esta lista será atualizada conforme novas etapas do processo forem documentadas.
>
> Plataforma de envio WhatsApp: Z-API ou equivalente — decisão do dev.
>
> Número WhatsApp exclusivo para disparos automáticos da Migma.

# 14. Fluxo Pós-Placement Fee — My Applications

Após o pagamento do Placement Fee, o cliente é direcionado para a página My Applications — equivalente ao Passo 4/6 do MatriculaUSA. Esta é a central de acompanhamento do processo até a conclusão da matrícula.

## 14.1 Global Document Requests — Documentos Automáticos

Ao pagar o Placement Fee, o sistema automaticamente exibe no dashboard do cliente todos os documentos necessários para o seu tipo de processo (Transfer ou COS). Esses documentos já estão pré-configurados no sistema — o cliente chega e vai preenchendo conforme solicitado.

> **Baseado no MatriculaUSA — Global Document Requests**
>
> O pós-venda cria um pacote fixo de documentos que fica disponível automaticamente.
>
> Na Migma, esse pacote é gerado automaticamente pelo sistema com base no tipo de processo (URL).
>
> O cliente vê todos os documentos pendentes e vai enviando conforme consegue.
>
> Admin revisa cada documento e aprova ou solicita correção.

| **Documento**                                | **Transfer** | **COS** | **Observação**                      |
|----------------------------------------------|--------------|---------|-------------------------------------|
| Certidão de casamento/nascimento traduzida   | ✅           | ✅      | Apenas se tiver dependentes         |
| Proof of address nos EUA                     | ✅           | ✅      | Comprovante de endereço americano   |
| Proof of address no Brasil (traduzido)       | ✅           | ✅      | Tradução via thefutureofenglish.com |
| Transcrito acadêmico traduzido               | ✅           | ✅      | Tradução via thefutureofenglish.com |
| I-797A (aprovação de mudança de status)      | ✅           | ✅      | Se aplicável                        |
| I-20 da escola atual                         | ✅           | ❌      | Apenas Transfer                     |
| Passaporte e visto (aplicante + dependentes) | ✅           | ✅      |                                     |
| I-94                                         | ✅           | ✅      | Link direto: i94.cbp.dhs.gov        |

## 14.2 Fluxo de Envio e Aprovação de Documentos

- Cliente envia cada documento conforme solicitado no dashboard

- Admin recebe notificação de novo documento enviado (email + WhatsApp)

- Admin revisa e aprova ou rejeita com justificativa

- Se rejeitado: cliente recebe notificação com detalhes do que corrigir

- Cliente reenvia o documento corrigido

- Processo continua até todos os documentos aprovados

- Quando todos aprovados: sistema notifica admin que pacote está completo

## 14.3 Carta de Aceite e Transfer Form

Após aprovação de todos os documentos, o MatriculaUSA processa a documentação e emite a carta de aceite e o Transfer Form. O sistema comunica automaticamente ao sistema Migma quando esses documentos estão prontos.

### Trava Financeira — Transfer e COS

> **Regra de Liberação da Carta de Aceite**
>
> Placement Fee pago em 1x: carta de aceite liberada diretamente após aprovação de todos os documentos.
>
> Placement Fee parcelado em 2x: carta de aceite liberada somente após pagamento da 2ª parcela.
>
> Esta regra se aplica igualmente para Transfer e COS.
>
> Após I-20 pronto: Transfer e COS divergem em seus fluxos — ver seções 14.4 e 14.5.

Notificação ao cliente quando carta de aceite estiver pronta:

- Dashboard: mensagem destacada — Sua carta de aceite está pronta!

- Se 2ª parcela pendente: Para liberar sua carta, realize o pagamento da 2ª parcela do Placement Fee

- Após pagamento ou se já pago em 1x: Carta de Aceite + Transfer Form disponíveis para download

- Notificação automática: email + WhatsApp

Transfer Form — instrução didática exibida no sistema:

- Este formulário deve ser entregue à sua escola atual para solicitar a liberação do seu SEVIS

- Leve pessoalmente ao DSO (Designated School Official) ou envie por email conforme orientação da sua escola

- Campo de confirmação no sistema: Já entreguei o Transfer Form para minha escola atual ✓

- Após confirmação: notificação automática para admin da Migma

### Seção 14.4 — Conclusão do Transfer

- Cliente confirma entrega do Transfer Form para escola atual

- Escola atual libera o SEVIS

- Novo I-20 emitido pela Caroline/Oikos

- Sistema notifica cliente: Transferência concluída! Aguarde contato da universidade sobre o início das aulas

- Cliente receberá emails diretamente da universidade sobre orientação, datas e início do programa

- Status no dashboard: TRANSFER CONCLUÍDO

### Seção 14.5 — Fluxo COS pós-I-20

> **Pendente de Documentação — COS pós-I-20**
>
> O fluxo do COS após a emissão do I-20 é diferente do Transfer e será documentado separadamente.
>
> Envolve: preenchimento do Form I-539, Cover Letter, protocolo no USCIS, acompanhamento da decisão.
>
> Este fluxo será alinhado e documentado na próxima sessão de trabalho.

# 15. Módulo Financeiro — Cobrança Mensal Recorrente

Após a conclusão da matrícula, a Migma cobra mensalmente do cliente a diferença entre a tuition com bolsa escolhida e a tuition base da Migma. Este módulo documenta a lógica de cálculo, os valores e as regras de cobrança.

## 15.1 Fórmula de Cálculo

> **Fórmula — Mensalidade Migma**
>
> Mensalidade = (Tuition anual com bolsa - Tuition base Migma) ÷ 12
>
> Tuition base Migma por categoria:
>
> Bacharelado: USD 3.800/ano
>
> Mestrado (MBA, Business Analytics, Filosofia, Teologia): USD 4.200/ano
>
> Mestrado em Ciências da Computação (todas as ênfases): USD 5.500/ano

## 15.2 Tabela de Mensalidades — Caroline University

### Bacharelado em Administração — Base: USD 3.800/ano

| **Tuition c/ Bolsa** | **% Desconto** | **Placement Fee** | **Mensalidade Migma** | **Total 4 anos (48x)** |
|----------------------|----------------|-------------------|-----------------------|------------------------|
| USD 15.000           | 0%             | USD 0             | USD 933/mês           | USD 44.784             |
| USD 10.100           | 33%            | USD 200           | USD 525/mês           | USD 25.200             |
| USD 8.840            | 41%            | USD 600           | USD 420/mês           | USD 20.160             |
| USD 7.580            | 49%            | USD 1.000         | USD 315/mês           | USD 15.120             |
| USD 6.320            | 58%            | USD 1.400         | USD 210/mês           | USD 10.080             |
| USD 5.060            | 70%            | USD 1.800         | USD 105/mês           | USD 5.040              |

### MBA / Business Analytics / Filosofia — Base: USD 4.200/ano

| **Tuition c/ Bolsa** | **% Desconto** | **Placement Fee** | **Mensalidade Migma** | **Total 2 anos (24x)** |
|----------------------|----------------|-------------------|-----------------------|------------------------|
| USD 15.000           | 0%             | USD 0             | USD 900/mês           | USD 21.600             |
| USD 10.500           | 33%            | USD 200           | USD 525/mês           | USD 12.600             |
| USD 9.240            | 41%            | USD 600           | USD 420/mês           | USD 10.080             |
| USD 7.980            | 49%            | USD 1.000         | USD 315/mês           | USD 7.560              |
| USD 6.720            | 58%            | USD 1.400         | USD 210/mês           | USD 5.040              |
| USD 5.400            | 70%            | USD 1.800         | USD 100/mês           | USD 2.400              |

### Mestrado em Ciências da Computação — Base: USD 5.500/ano

| **Tuition c/ Bolsa** | **% Desconto** | **Placement Fee** | **Mensalidade Migma** | **Total 2 anos (24x)** |
|----------------------|----------------|-------------------|-----------------------|------------------------|
| USD 15.000           | 0%             | USD 0             | USD 791/mês           | USD 18.984             |
| USD 11.800           | 28%            | USD 200           | USD 525/mês           | USD 12.600             |
| USD 10.540           | 36%            | USD 600           | USD 420/mês           | USD 10.080             |
| USD 9.280            | 45%            | USD 1.000         | USD 315/mês           | USD 7.560              |
| USD 8.020            | 53%            | USD 1.400         | USD 210/mês           | USD 5.040              |
| USD 6.760            | 62%            | USD 1.800         | USD 105/mês           | USD 2.520              |

## 15.3 Tabela de Mensalidades — Oikos University

### Bacharelado Business / Filosofia / Teologia — Base: USD 3.800/ano

| **Tuition c/ Bolsa** | **% Desconto** | **Placement Fee** | **Mensalidade Migma** | **Total 4 anos (48x)** |
|----------------------|----------------|-------------------|-----------------------|------------------------|
| USD 15.000           | 0%             | USD 0             | USD 933/mês           | USD 44.784             |
| USD 10.100           | 33%            | USD 200           | USD 525/mês           | USD 25.200             |
| USD 8.840            | 41%            | USD 600           | USD 420/mês           | USD 20.160             |
| USD 7.580            | 49%            | USD 1.000         | USD 315/mês           | USD 15.120             |
| USD 6.320            | 58%            | USD 1.400         | USD 210/mês           | USD 10.080             |
| USD 5.060            | 66%            | USD 1.800         | USD 105/mês           | USD 5.040              |

### Mestrado Business / Filosofia / Teologia — Base: USD 4.200/ano

| **Tuition c/ Bolsa** | **% Desconto** | **Placement Fee** | **Mensalidade Migma** | **Total 2 anos (24x)** |
|----------------------|----------------|-------------------|-----------------------|------------------------|
| USD 15.000           | 0%             | USD 0             | USD 900/mês           | USD 21.600             |
| USD 10.500           | 30%            | USD 200           | USD 525/mês           | USD 12.600             |
| USD 9.240            | 38%            | USD 600           | USD 420/mês           | USD 10.080             |
| USD 7.980            | 47%            | USD 1.000         | USD 315/mês           | USD 7.560              |
| USD 6.720            | 55%            | USD 1.400         | USD 210/mês           | USD 5.040              |
| USD 5.460            | 64%            | USD 1.800         | USD 105/mês           | USD 2.520              |

## 15.4 Regras de Cobrança

> **Padrão Identificado — Mensalidade por Placement Fee**
>
> Independente da universidade (Caroline ou Oikos), a mensalidade Migma é sempre a mesma para o mesmo Placement Fee:
>
> Placement Fee USD 200 → sempre USD 525/mês
>
> Placement Fee USD 600 → sempre USD 420/mês
>
> Placement Fee USD 1.000 → sempre USD 315/mês
>
> Placement Fee USD 1.400 → sempre USD 210/mês
>
> Placement Fee USD 1.800 → USD 105/mês (Bach/CS) ou USD 100/mês (MBA Caroline)
>
> Quanto maior o Placement Fee pago, menor a mensalidade Migma — argumento de venda a destacar no modal de escolha de bolsa.

- Início da cobrança Transfer: 1 mês após a carta de aceite ser emitida

- Início da cobrança COS: 1 mês após aprovação do COS pelo USCIS

- Duração: Bacharelado = 48 parcelas (4 anos) \| Mestrado = 24 parcelas (2 anos)

- Métodos de pagamento: mesmos do checkout (Square/Parcelow/Pix/Zelle por IP)

- Cobrança recorrente automática — engenharia de implementação a cargo dos devs

- Cliente notificado em todos os canais: email + WhatsApp antes de cada vencimento

## 15.5 Isenção por Indicações

> **Regra de Isenção — 10 Indicações Fechadas**
>
> Ao atingir 10 indicações fechadas, a mensalidade Migma é ZERADA automaticamente.
>
> O sistema para as cobranças recorrentes imediatamente após confirmar a 10ª indicação fechada.
>
> Notificação ao cliente: Parabéns! Você atingiu 10 indicações. Sua mensalidade Migma foi zerada.
>
> O cliente continua pagando a tuition diretamente à universidade normalmente.
>
> Apenas a parte da Migma (diferença) é isenta — não afeta a tuition da universidade.

## 15.6 Perda de Bolsa pela Universidade

- Se o cliente perder a bolsa da universidade (GPA abaixo de 3.5 conforme Scholarship Agreement):

  - A mensalidade Migma NÃO muda — permanece calculada sobre a tuition original com bolsa contratada

  - O cliente passa a pagar a tuition cheia para a universidade por conta própria

  - A Migma não é responsável pela perda da bolsa acadêmica

## 10.5 Questionário do Processo Seletivo

- \[ \] Seção A: perguntas de perfil e preferências acadêmicas da Migma

- \[ \] Campo de áreas: 4 opções (Exatas & Tecnologia \| Negócios & Gestão \| Humanas & Sociais \| Saúde & Ciências) — obrigatório marcar exatamente 2

- \[ \] Sistema bloqueia seleção de 3ª área

- \[ \] Campo de regiões: 15 estados, candidato escolhe 3 livremente — universidades sempre California internamente

- \[ \] Obrigações quantitativas: 2 áreas, 2 frequências, 2 faixas de investimento, 3 regiões

- \[ \] Remover pergunta de tipo de processo (determinado pela URL)

- \[ \] Seção B: documentos e linha do tempo Q11 a Q17 MatriculaUSA

- \[ \] Seção C: responsabilidade financeira Q27 a Q29 MatriculaUSA

- \[ \] Seção D: regras do F-1 Q31 a Q40 MatriculaUSA — múltipla escolha

- \[ \] Seção E: mentalidade e comprometimento Q41 a Q50 MatriculaUSA

- \[ \] Transfer: campo de data para prazo máximo de transferência

- \[ \] COS: campo de data para vencimento do status/I-94

- \[ \] Ambas as datas geram contagem regressiva + alertas no dashboard

- \[ \] Tela de conclusão: animação contador até 1.481 + link DHS

- \[ \] Email de confirmação automático ao candidato

- \[ \] Botão Escolher Faculdades desabilitado até 24h após envio

# 10. Checklist de Implementação

## 10.1 Arquitetura e Identidade Visual

- \[ \] URLs de cada serviço definidas e registradas com devs

- \[ \] Backend identifica serviço pela rota da URL e carrega configurações

- \[ \] Identidade visual idêntica ao site atual da Migma em todos os componentes

- \[ \] Página única com barra de progresso de 3 steps sempre visível

## 10.2 Step 1 — Informações Pessoais + Pagamento

- \[ \] Topbar: logo Migma + Visa Checkout + seletor de idioma

- \[ \] Formulário: Nome, Email, WhatsApp, Senha, Confirmar Senha, Nº Dependentes

- \[ \] Preço dinâmico: \$400 + (\$150 × nº dep.) — resumo atualiza em tempo real

- \[ \] Card de garantia de reembolso

- \[ \] Botão 'Ler Contrato Completo' — expande/modal com texto completo

- \[ \] 2 checkboxes de aceite obrigatórios

- \[ \] Canvas de assinatura digital com Clear, Done e auto-confirmação em 2s

- \[ \] Salvar assinatura e log de aceite (timestamp + IP) no backend

- \[ \] Titularidade do cartão (Meu Cartão / Cartão de Terceiros) — antes dos métodos

- \[ \] Aviso de endereço de cobrança para cartão de terceiros

- \[ \] Detecção de IP → flag de região

- \[ \] Square: apenas US \| Parcelow: US e BR \| Pix: US e BR \| Zelle: US e BR

- \[ \] Botão CTA dinâmico conforme método selecionado

- \[ \] Redirecionamento para gateway após clicar no CTA

- \[ \] Step 2 liberado SOMENTE após confirmação de pagamento

## 10.3 Step 2 — Documentos & Verificação

- \[ \] Dados adicionais: data nasc., tipo/nº doc., endereço completo, estado civil, etc.

- \[ \] 3 áreas de upload: frente doc + verso doc + selfie

- \[ \] Preview + validação de formato e tamanho após upload

- \[ \] Envio dos arquivos ao backend

- \[ \] Botões: Voltar (Step 1) + Upload & Salvar (Step 3)

## 10.4 Step 3 — Confirmação Final

- \[ \] Resumo final do pedido

- \[ \] Confirmação de documentos enviados

- \[ \] Botão de conclusão + redirecionamento para tela de sucesso

# 11. Histórico de Versões

| **Versão** | **Data** | **Alterações**                                                                                                                                                                                                                                                         | **Autor**      |
|------------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------|
| 1.0        | Abr 2025 | Criação inicial — Step 1 documentado                                                                                                                                                                                                                                   | Equipe Produto |
| 2.0        | Abr 2025 | Steps 2 e 3. Preço \$400. Dependentes +\$150. Contrato completo. Uploads.                                                                                                                                                                                              | Equipe Produto |
| 3.0        | Abr 2025 | Roteamento por URL/serviço. Titularidade do cartão. Assinatura digital.                                                                                                                                                                                                | Equipe Produto |
| 4.0        | Abr 2025 | Correções: identidade visual = site atual Migma. Steps em página única. Contrato só abre ao clicar. Pix e Zelle em todos os IPs. Parcelow em todos. Square só US. Titularidade antes dos métodos. Assinatura no Step 1. Fluxo pós-pagamento antes do Step 2.           | Equipe Produto |
| 5.0        | Abr 2025 | Termos e Condições como link azul em modal scrollável. Remoção da palavra Contrato.                                                                                                                                                                                    | Equipe Produto |
| 6.0        | Abr 2025 | Questionário completo: perguntas originais Migma + absorvidas MatriculaUSA. Perguntas exclusivas Transfer e COS com contagem regressiva. Tela de conclusão com 1.481 instituições SEVIS.                                                                               | Equipe Produto |
| 7.0        | Abr 2025 | Questionário: 4 grandes áreas, obrigações quantitativas fechadas, regiões sempre California internamente.                                                                                                                                                              | Equipe Produto |
| 8.0        | Abr 2025 | Fluxo pós-questionário, tela de escolha de faculdades, modal de bolsas, dashboard admin, fluxo de documentos.                                                                                                                                                          | Equipe Produto |
| 9.0        | Abr 2025 | Catálogo de 15 instituições. Narrativa 1.481 para 15 com conceito de pré-aceite.                                                                                                                                                                                       | Equipe Produto |
| 10.0       | Abr 2025 | Mapeamento formulários Caroline/Oikos. Tela Dados Complementares. Geração automática IA. Pacote assinatura digital. Aprovação automática 24h. Programa indicação. Chat IA. Integração Migma-MatriculaUSA.                                                              | Equipe Produto |
| 11.0       | Abr 2025 | Fluxo pós-Placement Fee: My Applications + Global Documents. Carta de aceite + Transfer Form com trava financeira. Módulo financeiro completo: cobrança mensal recorrente com tabelas Caroline e Oikos. Isenção com 10 indicações. COS pós-I-20 marcado como pendente. | Equipe Produto |

*MIGMA INC. — Documentação Confidencial — v11.0*
