# Reformulação do Dashboard de Analytics (HoS)

Este documento detalha as etapas para implementar as mudanças solicitadas na reunião entre Arthur e Paulo Victor sobre o painel de análise de vendas.

## Fase 1: Reestruturação da Página e Abas
- [x] Criar estrutura de abas principais na página `HeadOfSalesAnalytics`:
    - [x] Aba "Contratos" (Foco em quantidade)
    - [x] Aba "Faturamento" (Foco em valores financeiros)
- [x] Adicionar título "ACUMULADO DO ANO" nos 3 primeiros cards da página.
- [x] Reposicionar o histórico anual de vendas geral na horizontal (primeira linha, acima dos rankings).
- [x] Inverter a ordem de exibição: "Ranking de Vendedores" e depois "Histórico Mensal por Vendedor".

## Fase 2: Regras de Negócio e Contagem de Contratos
- [x] Modificar a lógica de contagem de contratos (`getTeamYearlyAnalytics`):
    - [x] Mapear "Visto de Estudante Americano" (Initial, COS, Transfer).
    - [x] Regra: Para Initial/COS/Transfer, a venda de um contrato ocorre no "Processo Seletivo" OU no "Full Payment" (Ignorar I-20 e Scholarship para contagem de volume de contratos).
    - [x] Criar categoria "Visto de Turista Americano" (B1 Revolution e B1 Premium Plan).
    - [x] Criar categoria "Visto de Turista Canadense" (Canada Tourist Visa - Premium Plan e Revolution ETA).
- [x] Implementar cálculo de média mensal (Vendas Totais / Mês Vigente do ano). Ex: Março = 3.

## Fase 3: Refinamento Visual dos Gráficos (Aba Contratos)
- [x] Organizar todos os gráficos do maior para o menor valor (Decrescente).
- [x] Adicionar porcentagem dentro da barra do gráfico.
- [x] Remover ou ocultar o eixo X.
- [x] Trocar a ordem de exibição nos tooltips/legendas para "Contrato / Porcentagem".
- [x] Ocultar vendedores E serviços com 0 vendas nos gráficos.
- [x] Adicionar quantidade de vendas (badge) dentro/acima do gráfico de "Histórico Mensal por Vendedor".
- [x] Adicionar média anual (Total / Mês atual) no "Histórico Mensal por Vendedor".
- [x] Adicionar badge indicando "Qtd de Vendas 2026" acima do gráfico de Ranking de Vendedores.
- [x] Substituir/Adicionar gráfico do tipo "Barras Empilhadas" (Stacked Bar Chart).

## Fase 4: Aba de Valor Vendido (Faturamento)
- [x] Criar gráfico "Histórico mensal de receita" (Barras horizontais por mês).
- [x] Criar gráfico "Receita gerada por serviço" (Barras horizontais, ordenado por % de participação).
- [x] Criar seção "HISTÓRICO DO VALOR LÍQUIDO DE VENDAS":
    - [x] Gráfico "Valor líquido por vendedor no ano" (Barras horizontais ordenadas).
    - [x] Gráfico "Histórico mensal do valor líquido por vendedor" (Barras agrupadas por mês/vendedor com linhas de média por vendedor).
- [x] Criar seção de análise semanal (mês selecionado):
    - [x] Gráfico "Valor líquido em [Mês] por semana" (Barras verticais por semana + Total).
    - [x] Gráfico "Valor líquido por vendedor em [Mês]" (Barras horizontais).
    - [x] Gráfico "Valor líquido por vendedor em [Mês] na [N]ª semana" com seletor de semana.
