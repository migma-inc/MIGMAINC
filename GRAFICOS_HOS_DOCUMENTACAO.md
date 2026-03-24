# Documentação Técnica: Gráficos do Dashboard Head of Sales (HoS)

Este documento detalha a finalidade e a regra de negócio de cada gráfico presente no dashboard de análise do time de vendas.

---

## 1. Visão Geral do Time (Anual)

### 1.1. Ranking de Vendedores (Anual)
- **Tipo**: Barra Horizontal
- **Finalidade**: Identificar os maiores contribuidores de vendas do time no acumulado do ano selecionado.
- **Métricas**: Número absoluto de vendas e percentual de participação no total do time.
- **Uso**: Avaliação de performance anual e reconhecimento de talentos.

### 1.2. Histórico Mensal por Vendedor (Anual)
- **Tipo**: Coluna Agrupada (Clustered)
- **Finalidade**: Visualizar a constância de cada vendedor mês a mês.
- **Diferencial**: Permite comparar diretamente o desempenho entre vendedores em um mesmo mês, revelando quem liderou cada período.
- **Uso**: Identificar sazonalidade individual e picos de produtividade.

---

## 2. Detalhamento Estratégico (Mensal)

Os gráficos desta seção são filtrados pelo **Seletor de Mês** no topo do dashboard.

### 2.1. Vendas por Semana
- **Tipo**: Coluna Vertical
- **Finalidade**: Analisar o fluxo de fechamento de contratos dentro do mês selecionado.
- **Divisão**: 1ªS (Dias 1-7), 2ªS (8-14), 3ªS (15-21), 4ªS (22-28), 5ªS (29-31).
- **Uso**: Entender o comportamento do cliente (ex: se compram mais no início ou fim do mês) e ajustar estratégias de fechamento.

### 2.2. Ranking do Time no Mês
- **Tipo**: Barra Horizontal
- **Finalidade**: Focada no desempenho de curto prazo.
- **Uso**: Monitoramento de metas mensais e premiações de "Vendedor do Mês".

---

## 3. Mix de Serviços e Conversão (Anual)

### 3.1. Distribuição de Serviços (Anual)
- **Tipo**: Rosca (Donut)
- **Finalidade**: Mostrar o peso de cada categoria de serviço (Estudante, Turista, etc.) no faturamento total do time.
- **Uso**: Ajustar o foco comercial e entender quais categorias são o "carro-chefe" da operação.

### 3.2. Detalhe: Vistos de Estudante / Vistos de Turista
- **Tipo**: Rosca (Donut) com Placeholder
- **Finalidade**: Mergulho profundo (Deep Dive) em cada categoria para ver o desempenho de sub-produtos (ex: Inicial vs Renovação vs Transferência).
- **Recurso**: Se não houver vendas em uma categoria, o gráfico exibe um círculo neutro (placeholder) para manter a integridade visual da página.

---

## 4. Histórico Geral

### 4.1. Histórico Anual de Vendas (Geral)
- **Tipo**: Combinado (Área + Linha de Média)
- **Finalidade**: Mostrar a saúde macro do time de vendas.
- **Média Móvel**: A linha amarela indica a média de vendas por mês, permitindo saber se o mês atual está acima ou abaixo da performance esperada.
