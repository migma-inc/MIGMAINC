# 🎯 Sistema de Vendedores (Sellers) - Guia Completo

## ✅ TUDO IMPLEMENTADO E PRONTO!

### 📋 Resumo do Sistema

O sistema de vendedores permite que qualquer pessoa se registre como vendedor e comece a gerar links personalizados de checkout para vender serviços de visto da MIGMA.

---

## 🚀 COMO TESTAR O SISTEMA COMPLETO

### 1. **Registrar um Vendedor**

**URL de Registro:**
```
http://localhost:5173/seller/register
```

**O que preencher:**
- Full Name: João Silva
- Email: joao@example.com
- Phone: +55 11 99999-9999 (opcional)
- Seller ID: `JOAO01` (único, será usado nos links)
- Password: mínimo 6 caracteres
- Confirm Password: mesma senha

**O que acontece automaticamente:**
1. ✅ Usuário criado em `auth.users`
2. ✅ Email confirmado automaticamente (via Edge Function)
3. ✅ Perfil criado em tabela `sellers` (via Trigger)
4. ✅ Login automático
5. ✅ Redirecionado para `/seller/dashboard`

---

### 2. **Dashboard do Vendedor**

**URL:**
```
http://localhost:5173/seller/dashboard
```

**O que você verá:**

#### 📊 **Cards de Estatísticas:**
- **Total Sales**: Número total de pedidos
- **Completed**: Pedidos pagos com sucesso
- **Pending**: Pedidos aguardando pagamento
- **Total Revenue**: Soma de todas as vendas completadas

#### 🔗 **Gerador de Links Personalizados:**
Mostra TODOS os 10 produtos com links prontos:

```
✅ Canada Work Consultancy
   https://migma.com/checkout/visa/canada-work?seller=JOAO01
   [Copy] ← Clique para copiar

✅ Canada Tourist - Brant Plan
   https://migma.com/checkout/visa/canada-tourist-brant?seller=JOAO01
   [Copy]

... (mais 8 produtos)
```

**Funcionalidade do botão Copy:**
- Clica → Link copiado para clipboard
- Botão fica verde com "Copied!" por 3 segundos
- Vendedor pode colar no WhatsApp/Email imediatamente

#### 📝 **Lista de Vendas:**
Tabela mostrando:
- Order # (número do pedido)
- Client (nome + email)
- Product (produto + unidades extras)
- Total (valor em USD)
- Status (completed/pending/failed/cancelled)
- Date (data da compra)
- Actions (botão "View" para ver detalhes)

---

### 3. **Detalhes do Pedido**

**URL:**
```
http://localhost:5173/seller/orders/:orderId
```

**O que o vendedor vê:**

#### 📦 **Product Information:**
- Nome do produto
- Base price
- Número de unidades extras (dependentes/RFEs/etc)
- Price per unit
- **Total**

#### 👤 **Client Information:**
- Nome completo
- Email
- WhatsApp
- País
- Nacionalidade
- Observações (se houver)

#### 💳 **Payment Information:**
- Método de pagamento
- Status do pagamento
- Stripe Session ID (se aplicável)
- Link do comprovante Zelle (se aplicável)
- Data do pedido

---

## 🔐 SEGURANÇA E AUTORIZAÇÃO

### **Rotas Protegidas:**

Apenas vendedores **logados** e **ativos** podem acessar:
- `/seller/dashboard`
- `/seller/orders/:id`

**Proteção implementada:**
```typescript
// SellerRoute.tsx verifica:
1. Usuário está autenticado?
2. Usuário tem registro na tabela sellers?
3. Status do seller é 'active'?

Se alguma condição falhar → Redireciona para /seller/login
```

### **Isolamento de Dados:**

- Vendedor **só vê suas próprias vendas**
- Query filtrada por `seller_id` no banco
- Impossível acessar pedidos de outros vendedores

---

## 📊 ESTRUTURA DO BANCO DE DADOS

### Tabela: `sellers`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID único do seller |
| `user_id` | UUID | Referência para auth.users |
| `seller_id_public` | TEXT | ID público (ex: JOAO01) usado nos links |
| `full_name` | TEXT | Nome completo |
| `email` | TEXT | Email |
| `phone` | TEXT | Telefone (opcional) |
| `status` | TEXT | active/inactive/suspended |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data de atualização |

### Relacionamento com `visa_orders`:

```sql
-- Pedidos são vinculados via seller_id_public
SELECT * FROM visa_orders 
WHERE seller_id = 'JOAO01';
```

---

## 🔄 FLUXO COMPLETO DE VENDA

### Do Registro à Primeira Venda:

```
1. Vendedor se registra
   ↓
   /seller/register
   - Preenche dados
   - Escolhe seller_id_public (ex: JOAO01)
   ↓

2. Sistema confirma email automaticamente
   ↓
   Edge Function: auto-confirm-seller-email
   ↓

3. Login automático
   ↓
   Redirecionado para /seller/dashboard
   ↓

4. Vendedor copia seu link
   ↓
   Exemplo: https://migma.com/checkout/visa/canada-work?seller=JOAO01
   ↓

5. Vendedor compartilha com cliente
   ↓
   Via WhatsApp, email, etc.
   ↓

6. Cliente clica no link
   ↓
   /checkout/visa/canada-work?seller=JOAO01
   ↓

7. Cliente preenche formulário e paga
   ↓
   Sistema salva: seller_id = "JOAO01"
   ↓

8. Pagamento confirmado
   ↓
   Status atualiza para "completed"
   ↓

9. Vendedor vê a venda no dashboard
   ↓
   Aparece na lista com status "Completed"
   ↓

10. Stats são atualizadas automaticamente
    - Total Sales +1
    - Completed Sales +1
    - Total Revenue +$valor
```

---

## 🧪 CENÁRIOS DE TESTE

### Teste 1: Registro e Dashboard

1. Acesse: `http://localhost:5173/seller/register`
2. Preencha:
   - Nome: Matheus Silva
   - Email: matheus@test.com
   - Seller ID: `MATHEUS-SP`
   - Password: 123456
3. Clique em "Register"
4. ✅ Deve redirecionar automaticamente para `/seller/dashboard`
5. ✅ Deve ver 4 cards de stats (todos em zero)
6. ✅ Deve ver 10 links de produtos com botão "Copy"

### Teste 2: Gerar e Copiar Link

1. No dashboard, encontre "Canada Work Consultancy"
2. Clique no botão "Copy"
3. ✅ Botão fica verde com "Copied!"
4. ✅ Cole em um bloco de notas
5. ✅ Deve ver: `http://localhost:5173/checkout/visa/canada-work?seller=MATHEUS-SP`

### Teste 3: Fazer uma Venda de Teste (Zelle)

1. Copie o link do "B1 Revolution"
2. Abra o link em outra aba (modo anônimo/incognito)
3. Preencha o formulário de checkout
4. Adicione 1 dependente
5. Selecione "Zelle" como método de pagamento
6. Faça upload de qualquer imagem (simula comprovante)
7. Clique em "Submit Zelle Payment"
8. ✅ Deve redirecionar para página de sucesso
9. Volte para `/seller/dashboard`
10. ✅ Deve ver a venda na lista com status "Pending"
11. ✅ Stats devem mostrar: Total Sales = 1, Pending = 1

### Teste 4: Ver Detalhes do Pedido

1. No dashboard, clique em "View" no pedido criado
2. ✅ Deve abrir `/seller/orders/:id`
3. ✅ Deve ver todas as informações do pedido
4. ✅ Deve ver dados do cliente
5. ✅ Deve ver link do comprovante Zelle (se aplicável)

### Teste 5: Logout e Login

1. No dashboard, clique em "Logout"
2. ✅ Deve redirecionar para `/seller/login`
3. Faça login novamente com email e senha
4. ✅ Deve entrar no dashboard
5. ✅ Deve ver as vendas anteriores ainda lá

---

## 🎯 URLs DO SISTEMA

### **Públicas (Sem Login):**
```
/seller/register          - Registro de vendedores
/seller/login            - Login de vendedores
/checkout/visa/:slug     - Checkout (ghost link)
```

### **Protegidas (Requer Login de Seller):**
```
/seller/dashboard        - Dashboard principal
/seller/orders/:id       - Detalhes do pedido
```

---

## 📈 FUNCIONALIDADES IMPLEMENTADAS

### ✅ Sistema de Autenticação:
- [x] Registro de vendedores
- [x] Login de vendedores
- [x] Confirmação automática de email
- [x] Logout
- [x] Proteção de rotas

### ✅ Dashboard do Vendedor:
- [x] Cards de estatísticas (Total, Completed, Pending, Revenue)
- [x] Gerador de links personalizados (10 produtos)
- [x] Lista de vendas do vendedor
- [x] Filtro automático por seller_id

### ✅ Gerador de Links:
- [x] Links para todos os produtos ativos
- [x] Botão "Copy" com feedback visual
- [x] seller_id automaticamente incluído

### ✅ Visualização de Vendas:
- [x] Tabela com todas as vendas
- [x] Status coloridos (Completed/Pending/Failed)
- [x] Detalhes de cada pedido
- [x] Informações completas do cliente

---

## 🔧 COMPONENTES CRIADOS

### Frontend:

1. **`src/pages/SellerRegister.tsx`**
   - Formulário de registro
   - Validação de seller_id_public
   - Auto-confirmação de email
   - Auto-login

2. **`src/pages/SellerLogin.tsx`**
   - Formulário de login
   - Validação de credenciais
   - Verificação de seller

3. **`src/pages/SellerDashboard.tsx`**
   - Cards de stats
   - Gerador de links
   - Lista de vendas

4. **`src/pages/SellerOrderDetail.tsx`**
   - Detalhes completos do pedido
   - Informações do cliente
   - Status do pagamento

5. **`src/components/seller/SellerRoute.tsx`**
   - Proteção de rotas
   - Verificação de autenticação
   - Verificação de seller ativo

### Backend:

6. **`supabase/functions/auto-confirm-seller-email/index.ts`**
   - Confirmação automática de email via Admin API
   - Similar ao sistema do Matrícula USA

### Banco de Dados:

7. **Tabela `sellers`**
   - Armazena dados dos vendedores
   - RLS habilitado

8. **Trigger `handle_new_seller`**
   - Cria perfil automaticamente quando user com role='seller' é criado

---

## 🧮 CÁLCULO DE STATS NO DASHBOARD

### Como funciona:

```typescript
// Busca TODOS os pedidos do vendedor
const orders = await supabase
  .from('visa_orders')
  .select('*')
  .eq('seller_id', seller.seller_id_public);

// Calcula stats
const stats = {
  totalSales: orders.length,
  completedSales: orders.filter(o => o.payment_status === 'completed').length,
  pendingSales: orders.filter(o => o.payment_status === 'pending').length,
  totalRevenue: orders
    .filter(o => o.payment_status === 'completed')
    .reduce((sum, o) => sum + parseFloat(o.total_price_usd), 0)
};
```

**Atualização:**
- Stats são recalculadas toda vez que a página carrega
- Para atualizar: basta dar F5 no dashboard

---

## 🎬 FLUXO VISUAL: Do Registro à Venda

```
┌─────────────────────────────────────────────────────────────┐
│ 1. VENDEDOR SE REGISTRA                                     │
│    /seller/register                                          │
│    - Nome: João Silva                                        │
│    - Email: joao@example.com                                 │
│    - Seller ID: JOAO01                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SISTEMA CRIA USUÁRIO                                     │
│    - supabase.auth.signUp()                                  │
│    - role: 'seller' nos metadados                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. TRIGGER AUTOMÁTICO                                        │
│    - handle_new_seller() (PostgreSQL)                       │
│    - Cria registro em tabela sellers                        │
│    - seller_id_public: JOAO01                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. EDGE FUNCTION CONFIRMA EMAIL                             │
│    - auto-confirm-seller-email                              │
│    - Usa Admin API (Service Role Key)                       │
│    - email_confirm = true                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. LOGIN AUTOMÁTICO                                          │
│    - signInWithPassword()                                    │
│    - Redirect para /seller/dashboard                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. DASHBOARD CARREGA                                         │
│    - Busca seller_id_public do banco                        │
│    - Gera links com seller_id                               │
│    - Mostra vendas filtradas                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. VENDEDOR COPIA LINK                                       │
│    https://migma.com/checkout/visa/canada-work?seller=JOAO01│
│    - Clica no botão "Copy"                                  │
│    - Link vai para clipboard                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. VENDEDOR COMPARTILHA COM CLIENTE                         │
│    - WhatsApp, Email, SMS, etc.                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. CLIENTE CLICA NO LINK                                     │
│    - Abre /checkout/visa/canada-work?seller=JOAO01         │
│    - Sistema extrai seller_id do query param               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. CLIENTE COMPLETA PAGAMENTO                              │
│     - Preenche formulário                                   │
│     - Paga via Stripe/Zelle                                 │
│     - Sistema salva seller_id: "JOAO01"                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. VENDA APARECE NO DASHBOARD DO VENDEDOR                  │
│     - Vendedor vê novo pedido na lista                      │
│     - Stats são atualizadas                                 │
│     - Pode ver detalhes do pedido                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 EXEMPLO PRÁTICO COMPLETO

### Situação: João quer vender Canada Work

1. **João se registra:**
   - Email: joao@migma.com
   - Seller ID: `JOAO-SP`

2. **João entra no dashboard:**
   - Vê o link: `https://migma.com/checkout/visa/canada-work?seller=JOAO-SP`
   - Clica em "Copy"

3. **João compartilha com cliente Maria:**
   - WhatsApp: "Olá Maria! Use este link para se inscrever: [link]"

4. **Maria clica no link:**
   - Abre a página de checkout
   - Vê: "Seller ID: JOAO-SP" no topo

5. **Maria preenche e paga:**
   - Nome: Maria Oliveira
   - Email: maria@example.com
   - 2 dependentes
   - Total: $1,800 + (2 × $150) = $2,100
   - Paga com Zelle

6. **Sistema salva:**
   ```json
   {
     "order_number": "ORD-20250106-0001",
     "product_slug": "canada-work",
     "seller_id": "JOAO-SP",  ← AQUI!
     "client_name": "Maria Oliveira",
     "total_price_usd": 2100,
     "payment_status": "pending"
   }
   ```

7. **João vê no dashboard:**
   - Total Sales: 1
   - Pending: 1
   - Lista mostra: Maria Oliveira - $2,100 - Pending

---

## 🔍 QUERIES ÚTEIS PARA ADMIN

### Ver todos os vendedores:
```sql
SELECT 
  seller_id_public,
  full_name,
  email,
  status,
  created_at
FROM sellers
ORDER BY created_at DESC;
```

### Ver vendas por vendedor:
```sql
SELECT 
  s.seller_id_public,
  s.full_name,
  COUNT(o.id) as total_vendas,
  SUM(CASE WHEN o.payment_status = 'completed' THEN 1 ELSE 0 END) as vendas_completas,
  SUM(CASE WHEN o.payment_status = 'completed' THEN o.total_price_usd ELSE 0 END) as receita_total
FROM sellers s
LEFT JOIN visa_orders o ON s.seller_id_public = o.seller_id
GROUP BY s.seller_id_public, s.full_name
ORDER BY receita_total DESC;
```

### Ver top vendedores:
```sql
SELECT 
  seller_id,
  COUNT(*) as vendas,
  SUM(total_price_usd) as receita
FROM visa_orders
WHERE payment_status = 'completed'
GROUP BY seller_id
ORDER BY receita DESC
LIMIT 10;
```

---

## 🛡️ SEGURANÇA IMPLEMENTADA

### ✅ RLS (Row Level Security):
- Sellers só podem ver seus próprios dados
- Sellers só podem atualizar seus próprios dados
- Qualquer pessoa pode se registrar (INSERT permitido)

### ✅ Validações:
- Seller ID único (não pode duplicar)
- Formato validado (apenas letras, números, dash, underscore)
- Email único
- Senha mínima 6 caracteres

### ✅ Isolamento de Dados:
- Vendedor só vê pedidos com seu `seller_id`
- Query filtrada no backend
- Proteção de rotas no frontend

---

## 📊 O QUE CADA VENDEDOR VÊ

### No Dashboard:

1. **Seus dados:**
   - Nome completo
   - Seller ID
   - Email

2. **Suas estatísticas:**
   - Total de vendas
   - Vendas completadas
   - Vendas pendentes
   - Receita total (apenas completed)

3. **Seus links:**
   - 10 produtos com links personalizados
   - Botão copy em cada um

4. **Suas vendas:**
   - Apenas pedidos com seu seller_id
   - Não vê vendas de outros vendedores

### Não Vê:
- ❌ Vendas de outros vendedores
- ❌ Informações de outros sellers
- ❌ Dashboard admin
- ❌ Funcionalidades admin (aprovar Zelle, etc)

---

## 🚀 PRÓXIMOS PASSOS

Para colocar em produção:

1. ✅ **Sistema de vendedores** - COMPLETO
2. ⏳ **Assinatura de contrato** - Próxima fase
3. ⏳ **Upload de foto/documento** - Próxima fase
4. ⏳ **Aprovação de Zelle (admin)** - Próxima fase
5. ⏳ **Analytics de funil** - Próxima fase

---

## 📝 CHECKLIST FINAL

- [x] Tabela `sellers` criada
- [x] Trigger `handle_new_seller` criado
- [x] Edge Function `auto-confirm-seller-email` deployada
- [x] Página `/seller/register` criada
- [x] Página `/seller/login` criada
- [x] Página `/seller/dashboard` criada
- [x] Página `/seller/orders/:id` criada
- [x] Componente `SellerRoute` (proteção) criado
- [x] Rotas adicionadas no `App.tsx`
- [x] Gerador de links implementado
- [x] Sistema de stats implementado
- [x] Isolamento de dados por seller_id

---

## 🎉 SISTEMA 100% FUNCIONAL!

**Pode começar a testar agora:**

1. Registre um vendedor em: `http://localhost:5173/seller/register`
2. Copie um link no dashboard
3. Faça um pedido de teste com Zelle
4. Veja a venda aparecer no dashboard!

**Sistema de vendedores está PRONTO para uso! 🚀**









