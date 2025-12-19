# Guia de Testes - Sistema de Reunião Global Partner

## Pré-requisitos

1. **Acesso ao Admin Dashboard**: Faça login em `/dashboard`
2. **Aplicação de teste**: Tenha pelo menos uma aplicação com status `pending` no banco
3. **Email configurado**: Verifique se o Supabase Edge Function `send-email` está funcionando

## Fluxo de Testes Completo

### Teste 1: Aprovação Inicial com Agendamento de Reunião

**Objetivo**: Testar o fluxo completo desde a aprovação inicial até o envio do email de reunião.

**Passos**:
1. Acesse `/dashboard`
2. Localize uma aplicação com status `pending`
3. Clique no botão **"Approve"**
4. **Verificar**: O modal `MeetingScheduleModal` deve abrir
5. Preencha os campos:
   - **Meeting Date**: Selecione uma data futura (ex: amanhã)
   - **Meeting Time**: Digite um horário (ex: "14:00" ou "2:00 PM")
   - **Meeting Link**: Cole um link válido (ex: "https://zoom.us/j/123456789")
   - **Scheduled By** (opcional): Digite seu nome
6. Clique em **"Schedule Meeting & Send Email"**
7. **Verificar**: 
   - Modal fecha
   - Mensagem de sucesso aparece
   - Status da aplicação muda para `approved_for_meeting`
   - Email é enviado para o candidato

**O que verificar no email**:
- Subject: "Your MIGMA Global Partner Application Has Been Approved - Meeting Scheduled"
- Contém data formatada da reunião
- Contém horário da reunião
- Contém link da reunião (clicável)
- Design está correto (logo, cores, etc.)

**O que verificar no banco de dados**:
```sql
SELECT 
  id, 
  full_name, 
  status, 
  meeting_date, 
  meeting_time, 
  meeting_link, 
  meeting_scheduled_at, 
  meeting_scheduled_by 
FROM global_partner_applications 
WHERE status = 'approved_for_meeting';
```

### Teste 2: Visualização de Informações de Reunião

**Objetivo**: Verificar se as informações de reunião aparecem corretamente na interface.

**Passos**:
1. Acesse `/dashboard`
2. Localize a aplicação que foi aprovada no Teste 1
3. **Verificar na lista**:
   - Badge mostra "Approved for Meeting" (amarelo)
   - Card amarelo com informações da reunião aparece
   - Data, horário e link estão visíveis
4. Clique em **"View Details"**
5. **Verificar na página de detalhes**:
   - Seção "Meeting Information" aparece
   - Todos os dados da reunião estão corretos
   - Link da reunião é clicável

### Teste 3: Aprovação Pós-Reunião

**Objetivo**: Testar o segundo passo do fluxo - aprovar após a reunião e enviar link do contrato.

**Passos**:
1. Acesse `/dashboard`
2. Localize a aplicação com status `approved_for_meeting`
3. Clique no botão **"Approve After Meeting"** (na lista ou na página de detalhes)
4. **Verificar**: Modal de confirmação aparece
5. Confirme a aprovação
6. **Verificar**:
   - Mensagem de sucesso aparece
   - Status muda para `approved_for_contract`
   - Email com link do contrato é enviado

**O que verificar no email**:
- Subject: "Congratulations! Your MIGMA Global Partner Application Has Been Approved"
- Contém link para `/partner-terms?token=...`
- Link é válido e funciona

**O que verificar no banco de dados**:
```sql
SELECT 
  id, 
  full_name, 
  status 
FROM global_partner_applications 
WHERE status = 'approved_for_contract';
```

Verificar também se o token foi criado:
```sql
SELECT * 
FROM partner_terms_acceptances 
WHERE application_id = '<id_da_aplicacao>';
```

### Teste 4: Validações do Modal de Reunião

**Objetivo**: Testar todas as validações do formulário.

**Testes de validação**:
1. **Data no passado**: Tente selecionar uma data passada → Deve mostrar erro
2. **Data vazia**: Deixe a data vazia → Deve mostrar "Date is required"
3. **Horário vazio**: Deixe o horário vazio → Deve mostrar "Time is required"
4. **Link vazio**: Deixe o link vazio → Deve mostrar "Meeting link is required"
5. **Link inválido**: Digite "não-é-um-link" → Deve mostrar "Please enter a valid URL"
6. **Todos os campos válidos**: Preencha tudo corretamente → Deve permitir submit

### Teste 5: Filtros e Status Badges

**Objetivo**: Verificar se os filtros e badges funcionam corretamente.

**Passos**:
1. Acesse `/dashboard`
2. Use o filtro de status:
   - Selecione "Approved for Meeting" → Deve mostrar apenas aplicações com esse status
   - Selecione "Approved for Contract" → Deve mostrar apenas aplicações com esse status
   - Selecione "All" → Deve mostrar todas
3. **Verificar badges**:
   - `pending`: Dourado
   - `approved_for_meeting`: Amarelo
   - `approved_for_contract`: Verde
   - `rejected`: Vermelho

### Teste 6: Acesso ao Link do Contrato

**Objetivo**: Verificar se o link do contrato funciona após aprovação pós-reunião.

**Passos**:
1. Após o Teste 3, copie o link do contrato do email
2. Abra o link em uma nova aba (modo anônimo)
3. **Verificar**:
   - Página `/partner-terms` carrega
   - Contrato é exibido
   - Proteção de conteúdo está ativa (não pode copiar, imprimir, etc.)
   - Formulário de aceite aparece

### Teste 7: Estatísticas do Dashboard

**Objetivo**: Verificar se as estatísticas incluem os novos status.

**Passos**:
1. Acesse `/dashboard`
2. **Verificar cards de estatísticas**:
   - Total
   - Pending
   - Approved (legacy)
   - Approved for Meeting (se houver)
   - Approved for Contract (se houver)
   - Rejected

**Nota**: Os cards podem precisar ser atualizados para mostrar os novos status separadamente.

### Teste 8: Compatibilidade com Aplicações Antigas

**Objetivo**: Verificar se aplicações com status `approved` (legacy) ainda funcionam.

**Passos**:
1. Se houver aplicações antigas com status `approved`, verifique:
   - Elas ainda aparecem na lista
   - Podem ser visualizadas normalmente
   - O sistema não quebra ao processá-las

## Testes de Erro

### Teste 9: Erro ao Enviar Email

**Cenário**: Simular falha no envio de email.

**Como testar**:
- Desative temporariamente a Edge Function `send-email`
- Tente aprovar uma aplicação
- **Verificar**: Sistema deve mostrar mensagem de sucesso parcial (status atualizado, mas email falhou)

### Teste 10: Aplicação Não Encontrada

**Cenário**: Tentar aprovar aplicação que não existe.

**Como testar**:
- Use um ID inválido (se possível via API direta)
- **Verificar**: Sistema deve retornar erro apropriado

## Checklist de Validação

- [ ] Modal de reunião abre corretamente
- [ ] Validações do formulário funcionam
- [ ] Dados são salvos no banco corretamente
- [ ] Status muda para `approved_for_meeting`
- [ ] Email de reunião é enviado com dados corretos
- [ ] Informações de reunião aparecem na lista
- [ ] Informações de reunião aparecem na página de detalhes
- [ ] Botão "Approve After Meeting" aparece para status `approved_for_meeting`
- [ ] Aprovação pós-reunião funciona
- [ ] Status muda para `approved_for_contract`
- [ ] Email com link do contrato é enviado
- [ ] Token é gerado corretamente
- [ ] Link do contrato funciona
- [ ] Filtros funcionam
- [ ] Badges mostram cores corretas
- [ ] Estatísticas são atualizadas

## Comandos SQL Úteis para Testes

### Ver todas as aplicações com reunião agendada:
```sql
SELECT 
  id, 
  full_name, 
  email, 
  status, 
  meeting_date, 
  meeting_time, 
  meeting_link 
FROM global_partner_applications 
WHERE meeting_date IS NOT NULL 
ORDER BY meeting_date DESC;
```

### Resetar status de uma aplicação para testar novamente:
```sql
UPDATE global_partner_applications 
SET 
  status = 'pending',
  meeting_date = NULL,
  meeting_time = NULL,
  meeting_link = NULL,
  meeting_scheduled_at = NULL,
  meeting_scheduled_by = NULL
WHERE id = '<id_da_aplicacao>';
```

### Ver tokens gerados:
```sql
SELECT 
  pt.*,
  gpa.full_name,
  gpa.email
FROM partner_terms_acceptances pt
JOIN global_partner_applications gpa ON pt.application_id = gpa.id
ORDER BY pt.created_at DESC;
```

## Dicas de Teste

1. **Use dados reais**: Crie uma aplicação de teste com dados realistas
2. **Teste em diferentes navegadores**: Chrome, Firefox, Edge
3. **Teste responsividade**: Mobile, tablet, desktop
4. **Verifique logs**: Console do navegador e logs do Supabase
5. **Teste com múltiplas aplicações**: Para verificar listas e filtros

## Problemas Comuns e Soluções

### Email não está sendo enviado
- Verifique se a Edge Function `send-email` está deployada
- Verifique os secrets do Supabase (SMTP configurado)
- Veja os logs da Edge Function no Supabase Dashboard

### Status não está mudando
- Verifique se a migração foi aplicada corretamente
- Verifique os logs do console do navegador
- Verifique se há erros no banco de dados

### Modal não abre
- Verifique o console do navegador para erros JavaScript
- Verifique se o componente `MeetingScheduleModal` está importado corretamente

### Informações de reunião não aparecem
- Verifique se os dados foram salvos no banco
- Verifique se o componente está fazendo o fetch correto
- Verifique se os campos estão sendo retornados na query

