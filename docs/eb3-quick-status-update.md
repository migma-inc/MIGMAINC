# Relatório de Atualização - Botão Rápido de Status (EB-3)

## Resumo
Adicionamos a funcionalidade de "Ativar/Suspender" diretamente na listagem principal de programas EB-3 (`/dashboard/eb3-recurring`), permitindo gestão rápida sem necessidade de entrar na página de detalhes.

## Mudanças Realizadas

### Frontend (`src/pages/admin/EB3RecurringManagement.tsx`)
1.  **Nova Coluna**: Adicionada uma coluna de ação no início da tabela (antes de "Client").
2.  **Botão de Ação**: Inserido um botão com ícone de Power (`<Power />`).
    *   **Verde**: Indica programa Ativo. Clicar sugere Suspensão.
    *   **Cinza**: Indica programa Cancelado/Inativo. Clicar sugere Ativação.
3.  **Lógica de Handler**: Reutilizada a mesma lógica da página de detalhes (`toggle_eb3_recurrence_status`), incluindo validação e atualização local da lista após a mudança.
4.  **Modal de Confirmação**: Adicionado um `Dialog` para confirmar a ação e, opcionalmente, inserir um motivo para o log.

## Como Testar
1.  Acesse o Dashboard Administrativo EB-3.
2.  Localize a nova coluna com botões redondos no lado esquerdo da tabela.
3.  Clique no botão de um cliente.
4.  Confirme a ação no modal que aparecerá.
5.  Verifique se o ícone muda de cor e se o status na coluna "Status" é atualizado.
