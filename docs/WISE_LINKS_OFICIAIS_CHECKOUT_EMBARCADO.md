# 🔗 Links Oficiais da Wise - Checkout Embarcado e OAuth 2.0 + mTLS

**Data**: 2026-01-12  
**Para**: Cliente  
**Objetivo**: Documentação oficial da Wise sobre checkout embarcado e integração como parceiro

---

## 📋 DOCUMENTAÇÃO OFICIAL DA WISE

### 1. Guia de Conta Parceiro (Partner Account Guide)
**Link**: https://docs.wise.com/api-docs/guides/partner-account

**Conteúdo**:
- Como se tornar parceiro da Wise
- Autenticação OAuth 2.0
- Configuração de mTLS (Mutual TLS)
- Ambientes Sandbox e Production
- Endpoints da API

---

### 2. Autenticação e Segurança - mTLS
**Link**: https://docs.wise.com/guides/developer/auth-and-security/mtls

**Conteúdo**:
- Como gerar certificados mTLS
- Como configurar Certificate Signing Request (CSR)
- Como fazer upload de certificados
- Configuração de trust store
- Requisitos de segurança

---

### 3. Checkout Embarcado - Autenticação e Acesso
**Link**: https://docs.wise.com/guides/product/send-money/use-cases/embedded/authentication-and-access

**Conteúdo**:
- Como obter credenciais OAuth 2.0 (Client ID e Client Secret)
- Como configurar mTLS para checkout embarcado
- Como obter tokens de acesso
- Requisitos para checkout embarcado

---

### 4. Guia de Integração de Checkout Embarcado
**Link**: https://docs.wise.com/guides/product/send-money/use-cases/embedded

**Conteúdo**:
- Visão geral do checkout embarcado
- Fluxo de integração
- Requisitos técnicos
- Melhores práticas

---

## 📧 CONTATO PARA SOLICITAR ACESSO

### Email Oficial da Wise para Parceiros
**Email**: `partnerwise@wise.com`

**Assunto Sugerido**: "Request for Embedded Checkout API Access - OAuth 2.0 + mTLS"

**Informações a Incluir no Email**:
- Nome da empresa/organização
- Caso de uso (checkout embarcado para pagamentos)
- Volume estimado de transações
- Necessidade de checkout embarcado (sem redirecionamento)
- Requisito de OAuth 2.0 + mTLS

---

## 🔐 DOCUMENTAÇÃO DE AUTENTICAÇÃO

### Personal Tokens (Método Atual - Limitações)
**Link**: https://docs.wise.com/api-docs/features/authentication-access/personal-tokens

**O que a documentação oficial da Wise diz**:

1. **Para quem é Personal Token**:
   > "Use a personal API token if you're a small business user automating your own Wise account."

2. **Para quem é OAuth 2.0**:
   > "Use OAuth 2.0 if you're a partner building for end customers or a large enterprise"

3. **Limitações do Personal Token**:
   - Alguns endpoints e ações não estão disponíveis
   - **EU/UK**: Devido a PSD2, você **não pode fundar transfers** ou ver balance statements via API com Personal Token

**⚠️ CONCLUSÃO LÓGICA**:
- Checkout embarcado é para **"end customers"** (clientes finais)
- Personal Token é para **"automating your own account"** (automatizar sua própria conta)
- OAuth 2.0 é para **"partners building for end customers"** (parceiros construindo para clientes finais)

**Portanto**: Como checkout embarcado é para clientes finais, e Personal Token é apenas para automatizar sua própria conta, **Personal Token não é adequado para checkout embarcado**. É necessário OAuth 2.0.

**Link direto**: https://docs.wise.com/api-docs/features/authentication-access/personal-tokens

---

### OAuth 2.0 Authentication
**Link**: https://docs.wise.com/api-docs/features/authentication-access/oauth-2-0

**Conteúdo**:
- Como funciona OAuth 2.0 com Wise
- Client Credentials Grant
- Authorization Code Grant
- Renovação de tokens
- Escopos disponíveis

**✅ CONFIRMAÇÃO OFICIAL**: OAuth 2.0 é o método recomendado para parceiros e checkout embarcado.

---

### Embedded SCA Component (Componente de Autenticação Embarcado)
**Link**: https://docs.wise.com/guides/developer/auth-and-security/embedded-sca-component

**Conteúdo**:
- Componente JavaScript para embarcar autenticação Wise no seu site
- Evita redirecionamentos completos
- **Requer OAuth 2.0** (não funciona com Personal Token)
- Melhora experiência do usuário em checkout embarcado

**⚠️ IMPORTANTE**: Este componente **requer OAuth 2.0** e não funciona com Personal Token.

---

## 🌍 AMBIENTES E ENDPOINTS

### Sandbox (Ambiente de Testes)
- **mTLS Endpoint**: `https://api-mtls.wise-sandbox.com`
- **Non-mTLS Endpoint**: `https://api.wise-sandbox.com`
- **OAuth Token URL**: `https://api-mtls.wise-sandbox.com/oauth/token`

### Production (Ambiente de Produção)
- **mTLS Endpoint**: `https://api-mtls.transferwise.com`
- **Non-mTLS Endpoint**: `https://api.wise.com`
- **OAuth Token URL**: `https://api-mtls.transferwise.com/oauth/token`

**Nota**: Para checkout embarcado, é **obrigatório** usar endpoints **mTLS**.

---

## 📚 DOCUMENTAÇÃO GERAL DA API

### API Reference (Referência Completa da API)
**Link**: https://docs.wise.com/api-reference/

**Conteúdo**:
- Todos os endpoints disponíveis
- Parâmetros e respostas
- Exemplos de requisições
- Códigos de erro

---

### Developer Hub (Hub do Desenvolvedor)
**Link**: https://wise.com/developer

**Conteúdo**:
- Dashboard para gerenciar credenciais
- Upload de certificados CSR
- Visualização de certificados assinados
- Download de certificados CA
- Gerenciamento de webhooks

---

## 📄 TERMOS E CONDIÇÕES

### API Terms and Conditions
**Link**: https://wise.com/public-resources/assets/documents/api/api_terms_and_conditions.pdf

**Conteúdo**:
- Termos de uso da API Wise
- Responsabilidades do parceiro
- Limitações e restrições
- Políticas de segurança

---

## 🔄 PROCESSO DE APROVAÇÃO

### Passo a Passo Oficial:

1. **Contato Inicial**
   - Enviar email para `partnerwise@wise.com`
   - Explicar caso de uso e necessidade

2. **Avaliação da Wise**
   - Wise avalia a aplicação
   - Pode solicitar documentação adicional
   - Processo pode levar 2-4 semanas

3. **Aprovação**
   - Wise fornece acesso ao Developer Hub
   - Recebe `client_id` e `client_secret`
   - Instruções para gerar certificados

4. **Configuração**
   - Gerar CSR e fazer upload no Developer Hub
   - Receber certificado assinado
   - Download do certificado CA
   - Configurar mTLS

5. **Testes**
   - Testar em sandbox
   - Validar checkout embarcado
   - Configurar webhooks

6. **Produção**
   - Migrar para ambiente production
   - Monitorar e ajustar

---

## ⚠️ REQUISITOS IMPORTANTES

### Para Checkout Embarcado:

1. ✅ **OAuth 2.0** (obrigatório)
   - Client ID e Client Secret
   - Tokens de acesso (renovação a cada 12 horas)

2. ✅ **mTLS** (obrigatório)
   - Certificado de cliente assinado pela Wise
   - Chave privada (RSA 2048+ ou ECC 256+)
   - Certificado CA da Wise

3. ✅ **Aprovação da Wise** (obrigatório)
   - Não é automático
   - Requer contato e avaliação
   - Pode levar semanas

4. ✅ **Conta Business Verificada** (pode ser necessário)
   - Depende do caso de uso
   - Wise avalia durante aprovação

---

## 📞 SUPORTE

### Wise Developer Support
- **Email**: `partnerwise@wise.com`
- **Documentação**: https://docs.wise.com/
- **Status da API**: Verificar status em caso de problemas

---

## ✅ RESUMO PARA O CLIENTE

**Para ter checkout embarcado igual ao Stripe:**

1. **É necessário** entrar em contato com Wise via `partnerwise@wise.com`
2. **É necessário** obter aprovação para acesso OAuth 2.0 + mTLS
3. **É necessário** configurar certificados mTLS
4. **Tempo estimado**: 5-8 semanas (incluindo aprovação)

### ⚠️ POR QUE Personal Token NÃO Serve para Checkout Embarcado

**Baseado na documentação oficial da Wise**:

1. **Personal Token é para**: "small business user automating your own Wise account"
2. **OAuth 2.0 é para**: "partner building for end customers or a large enterprise"
3. **Checkout embarcado é para**: Clientes finais (end customers)
4. **Limitação PSD2**: Personal Token não pode fundar transfers via API

**Conclusão**: Como checkout embarcado serve clientes finais, e Personal Token é apenas para automatizar sua própria conta, **é necessário OAuth 2.0** para checkout embarcado.

**Documentação oficial**:
- Personal Tokens: https://docs.wise.com/api-docs/features/authentication-access/personal-tokens
- Embedded Checkout Auth: https://docs.wise.com/guides/product/send-money/use-cases/embedded/authentication-and-access

**Links Principais**:
- 📖 Guia Parceiro: https://docs.wise.com/api-docs/guides/partner-account
- 🔐 Personal Tokens (limitações): https://docs.wise.com/api-docs/features/authentication-access/personal-tokens
- 🔐 mTLS Guide: https://docs.wise.com/guides/developer/auth-and-security/mtls
- 💳 Checkout Embarcado: https://docs.wise.com/guides/product/send-money/use-cases/embedded/authentication-and-access
- 🎨 Embedded SCA Component: https://docs.wise.com/guides/developer/auth-and-security/embedded-sca-component
- 📧 Contato: `partnerwise@wise.com`

---

**Última atualização**: 2026-01-12
