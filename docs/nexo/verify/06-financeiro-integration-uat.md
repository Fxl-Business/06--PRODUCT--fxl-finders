# UAT manual - Phase 06: integração fxl-financiero + payout CSV

Roteiro de teste manual ponta-a-ponta (PT-BR) do fluxo referral → checkout → conversão →
comissão → pagamento. O teste automatizado (T13,
`apps/api/test/rls/conversion-webhook-contract.test.ts`) é o gate de regressão primário;
os casos abaixo são complementares e cobrem o fluxo entre os dois apps.

## Pré-condições

- fxl-financiero rodando localmente com a branch `feat/fxl-sales-integration`
  (aplicar o patch `docs/nexo/cross-repo/06-financeiro-integration.patch` + migration `063`).
- FXL Sales API rodando localmente (porta `3006`) + Postgres em `5006`.
- FXL Sales DB migrado (`pnpm --filter @fxl-sales/api db:migrate`) - a migration
  `0006_fxl_financiero_seed` cria o app `fxl-financiero` (slug …ci**e**ro).
- Em fxl-financiero `.env`: `FXL_SALES_API_URL=http://localhost:3006` +
  `FXL_SALES_WEBHOOK_SECRET=<segredo-de-teste-local>`.
- No FXL Sales DB, ajustar o `apps.webhook_signing_secret` do slug `fxl-financiero`
  para o MESMO `<segredo-de-teste-local>` (o seed gera um segredo aleatório; rotacionar
  para o valor de teste no UAT):
  ```sql
  UPDATE apps SET webhook_signing_secret = '<segredo-de-teste-local>'
  WHERE slug = 'fxl-financiero';
  ```
- Um finder aprovado no FXL Sales com `cpf` + `pix_key` preenchidos, e um referral_link
  ativo apontando para o app `fxl-financiero`.

## Casos de teste

Cada caso: passos → resultado esperado → [ ] pass / [ ] fail.

- **TC01 - Captura do referral no checkout**
  Passos: clicar no referral link → ser redirecionado para `/precos?ref=<click_id>&fxl_sig=<hmac>`
  no fxl-financiero → seguir o fluxo até `/checkout/credit-card` → concluir um checkout.
  Esperado: a linha `checkout_attempts` criada tem `click_id` e `fxl_sig` preenchidos
  (cookies `fxl_ref`/`fxl_sig` setados HttpOnly pelo middleware). [ ] pass [ ] fail

- **TC02 - Webhook na marcação de first_paid_at**
  Passos: admin (fxl-financiero) marca `first_paid_at` da org (`POST /partners/orgs/:orgId/first-paid`).
  Esperado: FXL Sales recebe o webhook em `POST /api/v1/conversions`; uma linha
  `webhook_events` com `source='fxl-financiero'`; o body inclui os campos PII
  (`customer_name`/`customer_phone`/`customer_cpf`). [ ] pass [ ] fail

- **TC03 - Comissão criada e promoção automática (D-K)**
  Passos: após TC02, a conversão gera comissão(ões) com `status='pending'`; backdatear
  `hold_until` para o passado e rodar `POST /api/v1/admin/commissions/promote-locked`.
  Esperado: as comissões vão direto `pending → locked` (SEM passo `approved`). [ ] pass [ ] fail

- **TC04 - Lista de finders prontos + bloqueio por CPF/PIX**
  Passos: admin acessa `/admin/payouts`.
  Esperado: lista os finders com comissões `locked`; finder SEM CPF/PIX aparece com badge
  "Sem CPF/PIX" e checkbox DESABILITADO (não some da lista). [ ] pass [ ] fail

- **TC05 - Criar pagamentos**
  Passos: selecionar finders pagáveis → "Criar Pagamentos".
  Esperado: cria 1 linha `payouts` por finder (status `draft`); navega para
  `/admin/payouts/batches`. [ ] pass [ ] fail

- **TC06 - Download CSV (Excel PT-BR)**
  Passos: em `/admin/payouts/batches`, clicar "Baixar CSV".
  Esperado: o arquivo abre no Excel PT-BR sem diálogo de codificação (BOM presente, sem
  caracteres quebrados); a 1ª linha é exatamente
  `finder_name,cpf,pix_key,pix_key_type,amount_brl,commission_ids`; valores em pt-BR
  (ex.: `1.234,56`). [ ] pass [ ] fail

- **TC07 - Reserva mantém locked (D-Q)**
  Passos: após TC05, inspecionar as comissões reservadas.
  Esperado: as comissões continuam `status='locked'` com `paid_payout_id` preenchido -
  NÃO viram `in_payout` (esse status não existe). [ ] pass [ ] fail

- **TC08 - Marcar como Pago (reserve→pay)**
  Passos: clicar "Marcar como Pago" → confirmar no diálogo.
  Esperado: o payout vira `paid`; as comissões reservadas vão `locked → paid`
  (`paid_at` preenchido). [ ] pass [ ] fail

- **TC09 - Idempotência (replay)**
  Passos: reenviar o MESMO webhook (mesmo `idempotency_key`).
  Esperado: `200 { status: 'duplicate' }`; nenhuma conversão/comissão/lead duplicada. [ ] pass [ ] fail

- **TC10 - Assinatura inválida → 401 genérico (D-O)**
  Passos: enviar o webhook com `FXL_SALES_WEBHOOK_SECRET` errado.
  Esperado: FXL Sales rejeita com `401 { error: 'unauthorized' }` (sem revelar se a
  `source` existe). [ ] pass [ ] fail

- **TC11 - Trilha de auditoria**
  Passos: consultar `audit_log` (ou `/admin/audit`) após TC05 + TC08.
  Esperado: há entradas para pagamento criado/reservado e pagamento marcado pago
  (`action` = `payout.mark_paid`), encadeadas na hash-chain. [ ] pass [ ] fail

## Observações

- `fxl_sig` é PERSISTIDO no fxl-financiero mas NÃO é verificado em v1.0 (D-P).
- `finder_code` é enviado como `null` pelo fxl-financiero (a tabela `referral_links`
  vive no FXL Sales); a atribuição resolve por `click_id` (D-M).
- Aprovação por duas pessoas está DIFERIDA para v1.1 (D6) - sem badge de aprovação em v1.0.
