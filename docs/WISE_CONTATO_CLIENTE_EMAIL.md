# 📧 Guia para Contato com Wise - Solicitação de Checkout Embarcado

**Data**: 2026-01-12  
**Para**: Cliente  
**Objetivo**: Informações completas para entrar em contato com Wise e solicitar acesso a checkout embarcado

---

## 📧 CONTATO OFICIAL DA WISE

### Email para Parceiros
**Email**: `partnerwise@wise.com`

**Assunto Sugerido**:
```
Request for Embedded Checkout API Access - OAuth 2.0 + mTLS Partnership
```

---

## 📝 MODELO DE EMAIL PARA ENVIAR

### Assunto
```
Request for Embedded Checkout API Access - OAuth 2.0 + mTLS Partnership
```

### Corpo do Email

```
Prezados,

Somos [NOME DA EMPRESA] e gostaríamos de solicitar acesso à API da Wise Platform para implementar checkout embarcado em nossa plataforma de pagamentos.

CASO DE USO:
- Integração de Wise como método de pagamento em nosso checkout online
- Necessidade de checkout embarcado (sem redirecionamento para plataforma Wise)
- Processamento de pagamentos de clientes finais através de nossa plataforma
- Volume estimado: [ESTIMATIVA DE TRANSAÇÕES/MÊS]

REQUISITOS TÉCNICOS:
- OAuth 2.0 para autenticação (não Personal Token)
- mTLS (Mutual TLS) para segurança
- Acesso a endpoints de checkout embarcado
- Sandbox environment para testes iniciais

INFORMAÇÕES DA EMPRESA:
- Nome: [NOME DA EMPRESA]
- Website: [WEBSITE]
- Tipo de negócio: [DESCRIÇÃO DO NEGÓCIO]
- País: [PAÍS]

Estamos prontos para fornecer qualquer documentação adicional necessária e seguimos à disposição para uma conversa inicial.

Atenciosamente,
[NOME]
[CARGO]
[EMAIL]
[TELEFONE]
```

---

## 📋 O QUE EXPLICAR PARA A WISE

### 1. Caso de Uso Principal
- **O que**: Integrar Wise como método de pagamento no checkout online
- **Por quê**: Oferecer opção de pagamento internacional com taxas competitivas
- **Como**: Checkout embarcado diretamente no site (sem redirecionamento)

### 2. Necessidade Técnica
- **OAuth 2.0**: Necessário porque estamos construindo para clientes finais (não apenas automatizando nossa própria conta)
- **mTLS**: Requisito de segurança para checkout embarcado
- **Checkout Embarcado**: Cliente não deve ser redirecionado para Wise (experiência similar ao Stripe)

### 3. Volume e Escala
- Volume estimado de transações por mês
- Crescimento projetado
- Tipos de transações (valores, moedas, frequência)

### 4. Informações da Empresa
- Nome legal da empresa
- Website
- Tipo de negócio
- País de operação
- Status de verificação (se aplicável)

---

## 🔗 LINKS IMPORTANTES PARA REFERÊNCIA

### Documentação Oficial da Wise

1. **Guia de Conta Parceiro**
   - Link: https://docs.wise.com/api-docs/guides/partner-account
   - Explica processo de se tornar parceiro

2. **Checkout Embarcado - Autenticação**
   - Link: https://docs.wise.com/guides/product/send-money/use-cases/embedded/authentication-and-access
   - Requisitos técnicos para checkout embarcado

3. **Guia mTLS**
   - Link: https://docs.wise.com/guides/developer/auth-and-security/mtls
   - Como configurar certificados mTLS

4. **Personal Tokens vs OAuth 2.0**
   - Link: https://docs.wise.com/api-docs/features/authentication-access/personal-tokens
   - Explica por que OAuth 2.0 é necessário para parceiros

---

## ⚠️ PONTOS IMPORTANTES A MENCIONAR

### 1. Por que não Personal Token?
- Personal Token é para "small business automating your own account"
- Estamos construindo para "end customers" (clientes finais)
- Wise recomenda OAuth 2.0 para parceiros

### 2. Por que Checkout Embarcado?
- Melhor experiência do usuário (sem redirecionamento)
- Consistência com outros métodos de pagamento (Stripe)
- Redução de abandono de carrinho

### 3. Compromisso com Segurança
- Implementaremos mTLS conforme documentação
- Seguiremos todas as práticas de segurança recomendadas
- Estamos dispostos a passar por processo de verificação

---

## 📊 INFORMAÇÕES TÉCNICAS QUE A WISE PODE SOLICITAR

### Informações Básicas
- [ ] Nome legal da empresa
- [ ] Website
- [ ] País de operação
- [ ] Tipo de negócio
- [ ] Volume estimado de transações

### Informações Técnicas
- [ ] Stack tecnológico (ex: Supabase Edge Functions)
- [ ] Ambiente de desenvolvimento (sandbox/production)
- [ ] Capacidade de implementar mTLS
- [ ] Equipe técnica disponível

### Informações de Negócio
- [ ] Modelo de negócio
- [ ] Casos de uso específicos
- [ ] Moedas suportadas
- [ ] Regiões de operação

---

## ⏱️ PROCESSO ESPERADO

### Fase 1: Contato Inicial (1-2 semanas)
- Envio do email
- Resposta inicial da Wise
- Possível call/meeting para entender caso de uso

### Fase 2: Avaliação (2-4 semanas)
- Wise avalia aplicação
- Pode solicitar documentação adicional
- Verificação de empresa (se necessário)

### Fase 3: Aprovação e Setup (1-2 semanas)
- Acesso ao Developer Hub
- Recebimento de `client_id` e `client_secret`
- Instruções para gerar certificados mTLS
- Configuração de sandbox

### Fase 4: Implementação (1-2 semanas)
- Geração de certificados CSR
- Upload de certificados
- Configuração de mTLS
- Testes em sandbox

**Tempo Total Estimado**: 5-8 semanas

---

## ✅ CHECKLIST ANTES DE ENVIAR EMAIL

### Informações Preparadas
- [ ] Nome da empresa
- [ ] Website
- [ ] Descrição do negócio
- [ ] Volume estimado de transações
- [ ] Caso de uso bem definido
- [ ] Contato técnico disponível

### Documentação Preparada
- [ ] Documentos da empresa (se solicitados)
- [ ] Informações sobre stack tecnológico
- [ ] Capacidade de implementar mTLS

### Expectativas Definidas
- [ ] Entendimento de que processo leva semanas
- [ ] Compromisso com requisitos de segurança
- [ ] Disponibilidade para calls/meetings

---

## 📞 CONTATOS ALTERNATIVOS

### Se não houver resposta em 1 semana:
- Reenviar email com follow-up
- Verificar se email foi recebido
- Considerar contato via Developer Hub: https://wise.com/developer

### Suporte Técnico (após aprovação):
- Email: `api@wise.com`
- Disponível durante horário comercial
- 24/7 para emergências (após aprovação)

---

## 🎯 RESUMO EXECUTIVO PARA O CLIENTE

**O que fazer**:
1. ✅ Preparar informações da empresa
2. ✅ Definir caso de uso claro
3. ✅ Enviar email para `partnerwise@wise.com`
4. ✅ Aguardar resposta (1-2 semanas)
5. ✅ Participar de calls/meetings se solicitado
6. ✅ Fornecer documentação adicional se necessário

**O que esperar**:
- ⏱️ Processo leva 5-8 semanas no total
- 📋 Wise pode solicitar documentação adicional
- 🔐 Será necessário configurar mTLS após aprovação
- ✅ Acesso a sandbox primeiro, depois production

**Links essenciais**:
- 📧 Email: `partnerwise@wise.com`
- 📖 Guia Parceiro: https://docs.wise.com/api-docs/guides/partner-account
- 💳 Checkout Embarcado: https://docs.wise.com/guides/product/send-money/use-cases/embedded/authentication-and-access

---

## 📝 NOTAS ADICIONAIS

### Dicas para Sucesso:
1. **Seja específico**: Explique claramente o caso de uso
2. **Seja honesto**: Informe volume realista de transações
3. **Seja paciente**: Processo de aprovação leva tempo
4. **Seja preparado**: Tenha documentação pronta
5. **Seja proativo**: Responda rapidamente a solicitações da Wise

### O que NÃO fazer:
- ❌ Não mencione que já está usando Personal Token (não é relevante)
- ❌ Não pressione por resposta rápida
- ❌ Não omita informações importantes
- ❌ Não prometa volumes que não pode cumprir

---

**Última atualização**: 2026-01-12
