# 📋 Tasks Detalhadas - Melhorias Dashboard Seller

**Data de Criação:** 27 de Janeiro de 2025  
**Status:** 🟡 Pendente  
**Prioridade:** Alta

---

## 🎯 Visão Geral

Este documento detalha todas as tasks necessárias para melhorar o dashboard do seller, incluindo sistema de comissões, correções mobile e melhorias de UX.

---

## 📝 TASK 1: Sistema de Comissão - Card e Cálculo Mensal

### **Descrição**
Implementar sistema de comissão para vendedores, mostrando comissão do mês atual no dashboard. O sistema deve calcular automaticamente a comissão baseada nas vendas completadas.

### **Requisitos Técnicos**

#### **1.1. Estrutura de Banco de Dados**
- Criar tabela `seller_commissions` para armazenar comissões calculadas
- Campos necessários:
  - `id` (UUID, PK)
  - `seller_id` (TEXT, FK para sellers.seller_id_public)
  - `order_id` (UUID, FK para visa_orders.id)
  - `commission_percentage` (DECIMAL) - Percentual de comissão aplicado
  - `order_total_usd` (DECIMAL) - Valor total do pedido
  - `commission_amount_usd` (DECIMAL) - Valor da comissão calculada
  - `commission_status` (TEXT) - 'pending', 'paid', 'cancelled'
  - `payment_date` (TIMESTAMPTZ) - Data do pagamento da comissão (null se pending)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)

#### **1.2. Configuração de Comissão**
- Criar tabela `seller_commission_settings` para configurar percentual por seller
- Campos:
  - `id` (UUID, PK)
  - `seller_id` (TEXT, FK, UNIQUE)
  - `commission_percentage` (DECIMAL) - Ex: 10.00 para 10%
  - `is_active` (BOOLEAN)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
- **Default:** Se não houver configuração, usar percentual padrão (a definir pelo cliente)

#### **1.3. Trigger/Function para Cálculo Automático**
- Criar trigger que calcula comissão automaticamente quando:
  - `visa_orders.payment_status` muda para `'completed'`
  - E `visa_orders.seller_id` não é NULL
- Função PostgreSQL: `calculate_seller_commission(order_id UUID)`
- Lógica:
  1. Buscar percentual de comissão do seller (ou usar default)
  2. Calcular: `commission = total_price_usd * (commission_percentage / 100)`
  3. Inserir registro em `seller_commissions` com status `'pending'`

#### **1.4. Card de Comissão no Dashboard**
- **Arquivo:** `src/pages/seller/SellerOverview.tsx`
- Adicionar novo card mostrando:
  - **Comissão do Mês Atual:** Soma de todas as comissões com `created_at` no mês atual
  - **Comissão Total Pendente:** Soma de todas as comissões com status `'pending'`
  - **Comissão Total Paga:** Soma de todas as comissões com status `'paid'`
- Estilo: Seguir padrão dos outros cards (gradiente gold)
- Ícone: `Coins` ou `DollarSign` do lucide-react

#### **1.5. Query para Buscar Comissões**
- Função TypeScript em `src/lib/seller-commissions.ts`:
  ```typescript
  export async function getSellerCommissions(sellerId: string, period?: 'month' | 'all') {
    // Buscar comissões do seller
    // Filtrar por período se especificado
    // Retornar dados agregados
  }
  ```

### **Arquivos a Modificar/Criar**
- ✅ `supabase/migrations/XXXXXX_create_seller_commissions.sql` (nova migration)
- ✅ `supabase/migrations/XXXXXX_create_seller_commission_settings.sql` (nova migration)
- ✅ `src/pages/seller/SellerOverview.tsx` (adicionar card)
- ✅ `src/lib/seller-commissions.ts` (nova função utilitária)
- ✅ `src/types/seller.ts` (adicionar interfaces TypeScript)

### **Critérios de Aceitação**
- [ ] Tabela `seller_commissions` criada e populada automaticamente
- [ ] Card de comissão aparece no dashboard
- [ ] Comissão do mês é calculada corretamente
- [ ] Comissão é gerada automaticamente quando venda é completada
- [ ] Dados são atualizados em tempo real

---

## 📝 TASK 2: Correção - Erro de Assinatura de Contrato no Mobile

### **Descrição**
Corrigir erro que ocorre na hora de assinar o contrato quando acessado via dispositivo mobile. O problema pode estar relacionado ao upload de selfie, validação de arquivo ou interface touch.

### **Requisitos Técnicos**

#### **2.1. Investigação do Problema**
- **Arquivo Principal:** `src/components/checkout/ContractSigning.tsx`
- Verificar:
  1. Input de arquivo funciona em mobile?
  2. Preview da imagem aparece corretamente?
  3. Upload para Supabase Storage funciona?
  4. Validações de tamanho/tipo estão bloqueando?
  5. Interface touch está acessível?

#### **2.2. Correções Prováveis**

**A. Input de Arquivo Mobile**
- Adicionar atributos específicos para mobile:
  ```tsx
  <input
    type="file"
    accept="image/*"
    capture="environment" // Usa câmera traseira
    // ou
    capture="user" // Usa câmera frontal
  />
  ```

**B. Melhorar Feedback Visual**
- Adicionar loading state durante upload
- Mostrar progresso do upload
- Mensagens de erro mais claras

**C. Ajustar Validações**
- Verificar se validação de tamanho (5MB) está muito restritiva
- Adicionar compressão de imagem antes do upload (opcional)

**D. Responsividade do Componente**
- Garantir que botões sejam grandes o suficiente para touch
- Espaçamento adequado entre elementos
- Preview da imagem responsivo

#### **2.3. Testes Necessários**
- Testar em:
  - iOS Safari
  - Android Chrome
  - Dispositivos com diferentes resoluções
- Cenários:
  - Upload via câmera
  - Upload da galeria
  - Upload de arquivo grande (>5MB)
  - Upload de formato não suportado

### **Arquivos a Modificar**
- ✅ `src/components/checkout/ContractSigning.tsx` (correções principais)
- ✅ `src/components/checkout/DocumentUpload.tsx` (se aplicável)
- ✅ Adicionar logs de debug para identificar problema específico

### **Critérios de Aceitação**
- [ ] Upload funciona em iOS Safari
- [ ] Upload funciona em Android Chrome
- [ ] Preview da imagem aparece corretamente
- [ ] Mensagens de erro são claras
- [ ] Interface é acessível via touch
- [ ] Upload completa com sucesso

---

## 📝 TASK 3: Filtro de Período (Mês e Acumulado)

### **Descrição**
Adicionar filtro no dashboard para visualizar dados do mês atual ou acumulado (todos os dados históricos).

### **Requisitos Técnicos**

#### **3.1. Componente de Filtro**
- **Arquivo:** `src/pages/seller/SellerOverview.tsx`
- Adicionar dropdown/segmented control com opções:
  - "Este Mês" (month)
  - "Acumulado" (all)
- Estado: `const [periodFilter, setPeriodFilter] = useState<'month' | 'all'>('month')`

#### **3.2. Aplicar Filtro nas Queries**
- Modificar queries de stats para filtrar por período:
  ```typescript
  const startDate = periodFilter === 'month' 
    ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    : null;
  
  const { data: ordersData } = await supabase
    .from('visa_orders')
    .select('*')
    .eq('seller_id', seller.seller_id_public)
    .gte('created_at', startDate?.toISOString() || '1970-01-01')
    .order('created_at', { ascending: false });
  ```

#### **3.3. Atualizar Cards de Stats**
- Todos os cards devem refletir o período selecionado:
  - Total Sales
  - Completed
  - Pending
  - Total Revenue
  - **Comissão do Mês** (se Task 1 estiver completa)

#### **3.4. UI/UX**
- Usar componente `Select` do shadcn/ui ou criar segmented control customizado
- Posicionar no topo do dashboard, próximo ao título
- Mostrar indicador visual do período ativo
- Atualizar automaticamente ao mudar filtro

### **Arquivos a Modificar**
- ✅ `src/pages/seller/SellerOverview.tsx` (adicionar filtro e lógica)
- ✅ Criar componente `PeriodFilter.tsx` (opcional, para reutilização)

### **Critérios de Aceitação**
- [ ] Filtro aparece no dashboard
- [ ] Mudança de filtro atualiza todos os cards
- [ ] Dados do mês são calculados corretamente
- [ ] Dados acumulados mostram histórico completo
- [ ] Performance é adequada (sem lag)

---

## 📝 TASK 4: Gráficos de Histórico (Receita, Contratos e Comissão)

### **Descrição**
Adicionar gráficos visuais mostrando histórico de receita, contratos assinados e comissão ao longo do tempo.

### **Requisitos Técnicos**

#### **4.1. Biblioteca de Gráficos**
- Instalar: `recharts` (recomendado) ou `chart.js`
  ```bash
  npm install recharts
  ```

#### **4.2. Dados para Gráficos**
- Criar função para agregar dados por período (diário/semanal/mensal):
  ```typescript
  export async function getSellerChartData(
    sellerId: string, 
    period: 'day' | 'week' | 'month',
    dateRange: { start: Date, end: Date }
  ) {
    // Agregar vendas por período
    // Retornar array com: { date, revenue, contracts, commission }
  }
  ```

#### **4.3. Componentes de Gráfico**

**A. Gráfico de Receita**
- Tipo: Line Chart ou Area Chart
- Eixo X: Data (dia/semana/mês)
- Eixo Y: Valor em USD
- Mostrar: Receita total por período

**B. Gráfico de Contratos**
- Tipo: Bar Chart
- Eixo X: Data
- Eixo Y: Quantidade
- Mostrar: Número de contratos assinados por período

**C. Gráfico de Comissão**
- Tipo: Line Chart
- Eixo X: Data
- Eixo Y: Valor em USD
- Mostrar: Comissão acumulada ou por período

#### **4.4. Filtro de Período nos Gráficos**
- Adicionar opções:
  - "Últimos 7 dias"
  - "Últimos 30 dias"
  - "Últimos 3 meses"
  - "Últimos 6 meses"
  - "Último ano"
- Permitir seleção de período customizado (date picker)

#### **4.5. Layout**
- Criar seção "Analytics" ou "Charts" no dashboard
- Usar `Card` para envolver cada gráfico
- Grid responsivo: 1 coluna mobile, 2 colunas tablet, 3 colunas desktop

### **Arquivos a Criar/Modificar**
- ✅ `src/components/seller/RevenueChart.tsx` (novo componente)
- ✅ `src/components/seller/ContractsChart.tsx` (novo componente)
- ✅ `src/components/seller/CommissionChart.tsx` (novo componente)
- ✅ `src/pages/seller/SellerOverview.tsx` (adicionar seção de gráficos)
- ✅ `src/lib/seller-analytics.ts` (funções de agregação)
- ✅ `package.json` (adicionar dependência recharts)

### **Critérios de Aceitação**
- [ ] Gráficos aparecem no dashboard
- [ ] Dados são carregados corretamente
- [ ] Gráficos são responsivos
- [ ] Filtro de período funciona
- [ ] Performance é adequada (sem lag)
- [ ] Gráficos são acessíveis (legendas, cores contrastantes)

---

## 📝 TASK 5: Responsividade Mobile no Dashboard Seller

### **Descrição**
Garantir que todo o dashboard do seller seja totalmente responsivo e funcional em dispositivos mobile.

### **Requisitos Técnicos**

#### **5.1. Cards de Estatísticas**
- **Arquivo:** `src/pages/seller/SellerOverview.tsx`
- Grid atual: `grid-cols-1 md:grid-cols-4`
- Verificar:
  - Cards empilham corretamente em mobile
  - Texto não quebra de forma estranha
  - Ícones têm tamanho adequado
  - Espaçamento entre cards é confortável

#### **5.2. Tabelas (se houver)**
- Verificar tabelas em outras páginas do seller:
  - `src/pages/seller/SellerOrders.tsx`
- Implementar:
  - Scroll horizontal se necessário
  - Ou converter para cards em mobile
  - Botões de ação acessíveis via touch

#### **5.3. Gráficos (Task 4)**
- Garantir que gráficos sejam responsivos:
  - Altura mínima adequada
  - Labels legíveis
  - Tooltips funcionam em touch
  - Scroll horizontal se necessário

#### **5.4. Navegação**
- Verificar menu lateral (se houver):
  - Deve ser colapsável em mobile
  - Hamburger menu funcional
  - Links acessíveis

#### **5.5. Formulários**
- Verificar formulários no dashboard:
  - Inputs têm tamanho adequado (min-height: 44px para touch)
  - Botões são grandes o suficiente
  - Espaçamento entre campos é confortável

#### **5.6. Modais e Dialogs**
- Verificar modais (PDF viewer, etc):
  - Fecham corretamente em mobile
  - Não ultrapassam limites da tela
  - Botões de fechar são acessíveis

#### **5.7. Testes de Breakpoints**
- Testar em:
  - Mobile: 320px - 480px
  - Tablet: 481px - 768px
  - Desktop: 769px+
- Usar DevTools do Chrome/Firefox para testar

### **Arquivos a Modificar**
- ✅ `src/pages/seller/SellerOverview.tsx`
- ✅ `src/pages/seller/SellerOrders.tsx`
- ✅ `src/pages/seller/SellerFunnel.tsx`
- ✅ `src/pages/seller/SellerLinks.tsx`
- ✅ `src/components/seller/SellerDashboardLayout.tsx` (menu/navegação)
- ✅ Todos os componentes de gráfico (Task 4)

### **Critérios de Aceitação**
- [ ] Dashboard é totalmente funcional em mobile (320px+)
- [ ] Todos os cards são legíveis e acessíveis
- [ ] Botões têm tamanho adequado para touch (min 44x44px)
- [ ] Texto não quebra de forma estranha
- [ ] Gráficos são legíveis em mobile
- [ ] Navegação funciona perfeitamente
- [ ] Não há scroll horizontal indesejado
- [ ] Testado em iOS e Android

---

## 🔄 Ordem de Implementação Sugerida

1. **TASK 2** (Correção Mobile Contrato) - **PRIORIDADE ALTA** (bug crítico)
2. **TASK 1** (Sistema de Comissão) - Base para outras features
3. **TASK 5** (Responsividade) - Melhora UX geral
4. **TASK 3** (Filtro de Período) - Complementa Task 1
5. **TASK 4** (Gráficos) - Depende de Task 1 e Task 3

---

## 📊 Estimativa de Tempo

- **TASK 1:** 4-6 horas
- **TASK 2:** 2-3 horas
- **TASK 3:** 2-3 horas
- **TASK 4:** 4-5 horas
- **TASK 5:** 3-4 horas

**Total:** 15-21 horas

---

## ✅ Checklist Final

- [ ] Todas as tasks implementadas
- [ ] Testes realizados em mobile
- [ ] Testes realizados em desktop
- [ ] Código revisado
- [ ] Documentação atualizada
- [ ] Deploy realizado

---

## 📝 Notas Adicionais

- **Sistema de Comissão:** Aguardar confirmação do cliente sobre percentual e regras de cálculo
- **Mobile:** Testar em dispositivos reais, não apenas em DevTools
- **Performance:** Monitorar tempo de carregamento após implementação dos gráficos
- **Acessibilidade:** Garantir contraste adequado e navegação por teclado


