# 📋 Tasks Simples - Dashboard Seller (Para Trello)

---

## 🎯 TASK 1: Sistema de Comissão - Card e Cálculo Mensal

**Descrição:** Implementar sistema de comissão para vendedores. Criar tabelas no banco, trigger automático de cálculo, e card no dashboard mostrando comissão do mês.

**Arquivos:**
- Nova migration: `seller_commissions` e `seller_commission_settings`
- `src/pages/seller/SellerOverview.tsx` (adicionar card)
- `src/lib/seller-commissions.ts` (nova função)

**Critérios:**
- Comissão calculada automaticamente quando venda completa
- Card mostra comissão do mês atual
- Dados atualizados em tempo real

---

## 🐛 TASK 2: Correção - Erro de Assinatura de Contrato no Mobile

**Descrição:** Corrigir erro que ocorre ao assinar contrato via mobile. Verificar upload de selfie, validações e interface touch.

**Arquivos:**
- `src/components/checkout/ContractSigning.tsx`

**Critérios:**
- Upload funciona em iOS e Android
- Preview aparece corretamente
- Interface acessível via touch
- Mensagens de erro claras

---

## ✨ TASK 3: Filtro de Período (Mês e Acumulado)

**Descrição:** Adicionar filtro no dashboard para visualizar dados do mês atual ou acumulado (histórico completo).

**Arquivos:**
- `src/pages/seller/SellerOverview.tsx`

**Critérios:**
- Dropdown com opções "Este Mês" e "Acumulado"
- Todos os cards atualizam ao mudar filtro
- Dados calculados corretamente

---

## 📊 TASK 4: Gráficos de Histórico (Receita, Contratos e Comissão)

**Descrição:** Adicionar gráficos visuais mostrando histórico de receita, contratos assinados e comissão ao longo do tempo.

**Arquivos:**
- `src/components/seller/RevenueChart.tsx` (novo)
- `src/components/seller/ContractsChart.tsx` (novo)
- `src/components/seller/CommissionChart.tsx` (novo)
- `src/pages/seller/SellerOverview.tsx`
- `src/lib/seller-analytics.ts` (novo)

**Dependências:**
- Instalar `recharts`: `npm install recharts`

**Critérios:**
- 3 gráficos: Receita, Contratos, Comissão
- Filtro de período (7 dias, 30 dias, 3 meses, etc)
- Gráficos responsivos e acessíveis

---

## 📱 TASK 5: Responsividade Mobile no Dashboard Seller

**Descrição:** Garantir que todo o dashboard seja totalmente responsivo e funcional em dispositivos mobile.

**Arquivos:**
- `src/pages/seller/SellerOverview.tsx`
- `src/pages/seller/SellerOrders.tsx`
- `src/pages/seller/SellerFunnel.tsx`
- `src/pages/seller/SellerLinks.tsx`
- `src/components/seller/SellerDashboardLayout.tsx`

**Critérios:**
- Funcional em mobile (320px+)
- Botões com tamanho adequado para touch (min 44x44px)
- Cards empilham corretamente
- Gráficos legíveis em mobile
- Navegação funciona perfeitamente
- Testado em iOS e Android

---

## 🔄 Ordem Sugerida

1. TASK 2 (Bug crítico - Mobile)
2. TASK 1 (Base para outras features)
3. TASK 5 (Melhora UX geral)
4. TASK 3 (Complementa Task 1)
5. TASK 4 (Depende de Task 1 e 3)

---

## ⏱️ Estimativa Total

**15-21 horas**



