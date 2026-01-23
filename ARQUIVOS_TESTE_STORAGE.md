# Lista de Arquivos Identificados como Teste (Supabase Storage)

Esta lista contém arquivos identificados como órfãos (não referenciados em pedidos no banco de dados) ou com nomes que indicam testes de desenvolvimento (como nomes de membros da equipe ou padrões de preenchimento rápido).

## 1. Bucket: `contracts`
Estes arquivos foram gerados durante testes das Edge Functions de PDF.

| Arquivo | Criado em | Motivo |
| :--- | :--- | :--- |
| `visa-contracts/visa_contract_paulo_victor_victor_ribeiro_dos_santos_ORD-MAN-20260122-0069_2026-01-22_1769118098758.pdf` | 2026-01-22 | Nome da equipe / Órfão |
| `visa-annexes/annex_i_paulo_victor_victor_ribeiro_dos_santos_ORD-MAN-20260122-0069_2026-01-22_1769118098725.pdf` | 2026-01-22 | Nome da equipe / Órfão |
| `invoices/invoice_ORD-MAN-20260122-0069_1769118131018.pdf` | 2026-01-22 | Órfão |
| `visa-contracts/visa_contract_henrique_ORD-20260107...pdf` | 2026-01-07 | Nome da equipe / Órfão |
| `invoices/invoice_ORD-MAN-20260122-5886...pdf` | 2026-01-22 | Órfão (múltiplas versões) |

## 2. Bucket: `visa-signatures`
Contém uma enorme quantidade de arquivos `.png` órfãos, prováveis testes do componente de assinatura.

**Amostra de arquivos (Total > 100):**
* `1769118093142-7o1rqh.png`
* `1769112632390-1p3rf.png`
* `1769111259148-tgy19m.png`
* `1769111007004-ax9xqj.png`
* `1769109881743-uvdb36.png`
* `1769034205045-8b9eds.png`
* `1769033096903-ktggrf.png`
* `1768946937074-2qpqz6.png`
* `1768931525713-iewr42.png`

## 3. Bucket: `visa-documents`
Arquivos de documentos carregados sem finalização de pedidos ou testes de upload.

| Caminho | Quantidade | Motivo |
| :--- | :--- | :--- |
| `documents/` | ~400+ órfãos | Uploads sem pedido vinculado |
| `selfies/` | ~200+ órfãos | Uploads sem pedido vinculado |
| `zelle-receipts/` | 6 arquivos | Testes de upload de comprovante Zelle |

## 4. Pastas Órfãs / Testes Iniciais
* `identity-photos/signatures/` (1 arquivo)
* `identity-photos/photos/` (1 arquivo)
* `visa-documents/contracts/` (1 arquivo isolado)

---
**Observação:** Arquivos "Órfãos" são aqueles cujo URL público não consta em nenhuma coluna da tabela `visa_orders`.
