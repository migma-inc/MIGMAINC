# Fluxo Geração de Contrato e Assinatura em PDF

Este documento explica detalhadamente como o sistema lida com as informações do cliente, a coleta de documentos/selfies para a assinatura, e como tudo se une para **gerar o contrato PDF automaticamente após a confirmação do pagamento**.

---

## 🔁 Visão Geral do Fluxo

1. **Checkout (Coleta)**: O cliente preenche seus dados, faz o upload do documento e de uma selfie (que atua como ateste de veracidade da assinatura eletrônica) e aceita os termos.
2. **Pagamento (Webhook)**: O cliente realiza o pagamento. O sistema fica aguardando a confirmação real do pagamento através de Webhooks ou aprovação manual.
3. **Trigger da Edge Function**: Uma vez confirmado o pagamento, o banco de dados/webhook dispara uma requisição isolada para a edge function geradora dos PDFs.
4. **Construção do PDF**: O sistema pega as variáveis dinâmicas do cliente e as fotos dos documentos (via Firebase Storage/Supabase Storage dependendo do bucket) e desenha o arquivo em tempo real (jsPDF).
5. **Armazenamento e Vínculo**: O arquivo final gerado é feito o upload no Storage e o link público fica amarrado dentro do pedido na coluna `contract_pdf_url`.

---

## 1. Coleta de Dados e "Assinatura" (Uploads)

Durante o processo de Checkout, a "assinatura" eletrônica não é somente um clique no checkbox. O Migma exige prova de vida e documento.

- **Informações do Usuário:** Nome, e-mail, telefone, país, quantidade de unidades para o serviço. Eles ficam gravados inicialmente na tabela `visa_orders`.
- **Anexos Identitários:** Para validar a assinatura dos termos do contrato, o frontend coleta as imagens.
  - Podem vir da tabela `identity_files` (conectadas pelo `service_request_id`), contendo `document_front` (Frente do documento), `document_back` (Verso) e `selfie_doc` (A Selfie).
  - Ou, diretamente da tabela `visa_orders` pelos campos legados/emergenciais: `contract_document_url` e `contract_selfie_url`.
- Quando o usuário clica em "Assinar", esses arquivos sobem para o Storage e a variável `contract_signed_at` recebe o *timestamp* do aceite.

---

## 2. A Confirmação do Pagamento (O Gatilho)

A geração do PDF **não acontece desordenadamente**. Ela aguarda obrigatoriamente um "gatilho" confiável para confirmar que a relação comercial foi selada.

- **Stripe (Cartão de Crédito ou Pix):**
  Quando a transação ocorre, não geramos na hora as coisas. Esperamos o webhook da Stripe (`checkout.session.completed` ou `async_payment_succeeded`). Apenas quando o nosso endpoint webhook recebe e valida esse sucesso, nós atualizamos o `payment_status` do pedido e mandamos o comando (*invoke*) para a edge function de geração de PDF.
  
- **Parcelow:**
  Funciona com a mesma lógica. O webhook de fallback ou transação completada garante que só vamos gastar tempo de processamento e carimbar um contrato oficial se a API da processadora nos der o "OK".
  
- **Zelle:**
  Aqui a dinâmica difere sutilmente pela modalidade ser "semiautomática". O cliente anexa o comprovante, o pedido assume `pending`, mas *já engatilha* a geração do PDF, visto que a negociação Zelle já possui todas as partes envolvidas engajadas e os dados do comprovante em revisão.

---

## 3. A Geração do PDF (`generate-visa-contract-pdf`)

Esse é o verdadeiro cérebro da operação. O que acontece nos bastidores quando nosso Webhook chama a rota `/generate-visa-contract-pdf`?

1. **Agrupamento dos Dados:** A função cruza a identidade do pedido (`order_id`) com os detalhes do produto e o template do Contrato correspondente inserido dinamicamente na tabela `contract_templates`.
2. **Formatação Dinâmica:** Todas aquelas _tags_ ou espaços formatados no contrato (Ex: Nomes, Valores em Dólar e conversão para a moeda de pagamento real identificando se usou Cartão, Zelle, etc.) são preenchidas para esse cliente único.
3. **Anexagem das Provas de Autenticidade:**
   - O código lê as urls das imagens de identidade (Frente, Verso, Selfie e a imagem de rubrica/assinatura `signature_image_url` se existir).
   - Ele solicita ao nosso Storage (`visa-documents` ou `visa-signatures`) baixar essas imagens em buffer.
   - Usando a biblioteca `jsPDF`, o documento PDF é desenhado página a página.
4. **Alocação Fim a Fim no Documento Final:**
   - **Página 1:** Cabeçalho com informações da transação e do cliente.
   - **Páginas Meio:** Os termos do contrato que o template do banco enviou em texto corrido com quebras de linha automáticas.
   - **Página Final/Imagens:** Insere a **Foto da Frente**, **Costas** e a **Selfie (60x60mm)** de comprovação como assinatura digital e os Timestamps (Registros temporais incluindo o campo IP Address preenchido via cabeçalho do usuário).
5. **Rodapé de Validade:** Cada página leva um rodapé carimbado com "Generated on [DATA]" e um aviso de validade legal.

---

## 4. Conclusão e Entrega Sistêmica

Uma vez finalizada a compilação desse buffer, o robô faz automaticamente o **upload desse arquivo PDF gerado** de volta para o Supabase Storage dentro do diretório `contracts/visa-contracts/`.

- Um link criptografado ou público do Storage é montado e registrado na tabela do próprio pedido, substituindo o campo nulo: `visa_orders.contract_pdf_url = "https://..."`.
- O Administrador (e o Dashboard interno do "Seller") agora passa a ter um botão de atalho `[View Contract PDF]` mapeado para esse registro exato.
- Como o script está altamente desacoplado, manutenções no frontend ou design do checkout não afetam as regras e nem a consistência da validade legal criada por trás dos panos.
