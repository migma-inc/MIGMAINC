# TODO — Automatizar Envio de Pacote para MatriculaUSA

**Data:** 2026-04-28
**Prioridade:** Alta
**Status:** ⏳ Pendente

---

## Problema Atual

Após o admin do Migma clicar em **"Montar Pacote"**, o ZIP é gerado corretamente com:
- `/formularios/` — todos os formulários assinados pelo aluno
- `/documentos/` — todos os documentos aprovados (global document requests)

Porém, **o envio para o MatriculaUSA é 100% manual**:

1. Admin baixa o ZIP no Migma
2. Admin descompacta o arquivo localmente
3. Admin acessa o painel do MatriculaUSA
4. Admin localiza o aluno lá
5. Admin faz upload de **cada arquivo individualmente**
6. Repete para cada aluno

Isso é inviável em escala. Com 10, 20 alunos simultâneos, o processo vira um gargalo operacional enorme.

O próprio código da `package-matriculausa` já documenta isso internamente:

```
NOTA FUTURA:
Este processo sera automatizado via API do MatriculaUSA
quando os endpoints de upload estiverem disponiveis.
```

---

## O Que Precisa Ser Feito

### Objetivo
Quando o admin clicar em **"Montar Pacote"** (ou em um novo botão **"Enviar para MatriculaUSA"**), o sistema deve automaticamente:

1. Pegar todos os arquivos do pacote (formulários assinados + documentos aprovados)
2. Enviar cada arquivo para o perfil correto do aluno no MatriculaUSA via API
3. Notificar o admin do MatriculaUSA que há um novo pacote aguardando processamento
4. Registrar no Migma que o pacote foi enviado (`package_status = 'sent'`)

---

## Arquitetura Proposta

### Opção A — Upload direto via API do MatriculaUSA (ideal)

Criar uma edge function no Migma (`send-package-to-matriculausa`) que:

1. Recebe o `application_id`
2. Busca os arquivos do ZIP já montado no storage do Migma
3. Para cada arquivo, chama um endpoint do MatriculaUSA que aceita o upload
4. Atualiza `package_status = 'sent'` no Migma

**Pré-requisito:** O MatriculaUSA precisa expor endpoints de upload autenticados.

---

### Opção B — Webhook de notificação + upload pelo MatriculaUSA (alternativa)

O Migma chama um webhook no MatriculaUSA informando:
- Email do aluno
- URL do ZIP no storage do Migma (signed URL válida por 7 dias)

O MatriculaUSA então faz o download do ZIP e processa internamente.

**Vantagem:** Não precisa de endpoints de upload individuais no MatriculaUSA.
**Desvantagem:** Depende de implementação no lado do MatriculaUSA.

---

### Opção C — Email automático com ZIP anexado (solução temporária)

Enquanto as opções A ou B não estão prontas:

Ao clicar em "Montar Pacote", o sistema envia automaticamente um email para o admin do MatriculaUSA com:
- Link para download do ZIP (signed URL de 7 dias)
- Nome do aluno, email, tipo de processo
- Instruções de upload

**Vantagem:** Implementável hoje, sem dependência do MatriculaUSA.
**Desvantagem:** Ainda exige trabalho manual do lado do MatriculaUSA.

---

## O Que Já Existe e Funciona

| Componente | Status |
|---|---|
| Geração do ZIP com formulários + docs aprovados | ✅ Funcionando |
| Upload do ZIP para storage `matriculausa-packages` | ✅ Funcionando |
| Signed URL de 7 dias para download | ✅ Funcionando |
| Email ao admin Migma que pacote está pronto (`admin_package_complete`) | ✅ Funcionando |
| Email ao aluno que pacote foi enviado (`package_sent_matriculausa`) | ✅ Funcionando |
| **Envio automático dos arquivos para o MatriculaUSA** | ❌ Manual |

---

## Arquivos Relevantes

| Arquivo | Descrição |
|---|---|
| `supabase/functions/package-matriculausa/index.ts` | Monta o ZIP e salva no storage — onde a automação deve ser adicionada |
| `src/pages/admin/AdminUserDetail.tsx` | UI do admin — botão "Montar Pacote" (linha ~1055) e "Baixar ZIP" (linha ~1063) |
| `supabase/functions/migma-notify/index.ts` | Sistema de notificações — adicionar trigger `package_sent_to_matriculausa` se necessário |

---

## Fluxo Atual (Manual) vs. Fluxo Desejado (Automático)

### Atual ❌
```
Admin clica "Montar Pacote"
        ↓
ZIP gerado no Migma
        ↓
Admin baixa ZIP manualmente
        ↓
Admin abre ZIP localmente
        ↓
Admin entra no MatriculaUSA
        ↓
Admin faz upload arquivo por arquivo
        ↓
Admin do MatriculaUSA processa
        ↓
Admin do MatriculaUSA faz upload da carta de aceite
        ↓
Migma notificado automaticamente ← só aqui começa a automação
```

### Desejado ✅
```
Admin clica "Montar Pacote" (ou "Enviar para MatriculaUSA")
        ↓
ZIP montado + enviado automaticamente ao MatriculaUSA
        ↓
Admin do MatriculaUSA recebe notificação: "Novo pacote aguardando"
        ↓
Admin do MatriculaUSA processa com a universidade
        ↓
Admin do MatriculaUSA faz upload da carta de aceite
        ↓
Migma notificado automaticamente ← já funciona
        ↓
Aluno recebe email com carta de aceite ← já funciona
```

---

## Decisão Necessária Antes de Implementar

Antes de codificar, definir:

- [ ] Qual opção seguir (A, B ou C)?
- [ ] O MatriculaUSA vai expor endpoints de upload? Se sim, quais?
- [ ] Ou o MatriculaUSA vai consumir o ZIP via URL? Se sim, implementar webhook receptor no MatriculaUSA
- [ ] Enquanto isso, implementar Opção C (email com link do ZIP) como solução temporária?
