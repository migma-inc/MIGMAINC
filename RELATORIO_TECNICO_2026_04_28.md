# Relatrio Tcnico - 2026-04-28

## Atividades Realizadas

- **Migration de Banco de Dados**:
  - Aplicada `20260428000000_update_zelle_pending_table.sql`: Adicionadas colunas de aprovao cross-system.
  - Aplicada `20260428100000_fix_application_fee_zelle_table.sql`: Refatorao da tabela `application_fee_zelle_pending` para apontar para `institution_applications` em vez de `scholarship_applications`. Adicionadas colunas de pagamento em `institution_applications`.
- **Ajustes no Frontend**:
  - Corrigido `PaymentStep.tsx` para buscar corretamente a coluna `is_application_fee_paid` da tabela `institution_applications`.
  - Adicionada verificação de comprovantes Zelle pendentes ao carregar o componente, garantindo que o status "Aguardando confirmação" persista após refresh da página.
- **Correções em Edge Functions**:
  - `migma-approve-application-fee`: Adicionada sincronização com a tabela `user_profiles` para garantir que o status de pagamento global do usuário seja atualizado simultaneamente à aplicação.
  - `send-email`: Identificada ausência da função no ambiente de produção; realizada a implantação para restaurar o envio de notificações por email.
- **Deploy Final**: Todas as funções (`migma-approve-application-fee`, `migma-notify`, `send-email`) foram implantadas com sucesso após o login do usuário via CLI.
- **Fluxo de Notificações de Documentos Globais**:
  - Implementado disparo da notificação `admin_new_documents` no `DocumentsUploadStep.tsx` após submissão do pacote.
  - Refatorada a Edge Function `review-student-documents` para orquestrar o envio de e-mails (`all_documents_approved` e `admin_package_complete`) automaticamente ao aprovar o último documento.
  - Corrigida a URL de redirecionamento no e-mail de rejeição para apontar para o upload de documentos e não para o checkout.
- **Melhorias de UX e Traduções**:
  - Implementado polling automático no `PaymentStep.tsx` para atualizar o status de pagamentos Zelle sem refresh manual.
  - Adicionadas e corrigidas as chaves de tradução `already_paid_title` e `already_paid_desc` nos locais `pt.json` e `en.json`.
  - Padronizada a nomenclatura de "Taxa de Inscrição" para "Taxa de Matrícula" no fluxo de onboarding.
