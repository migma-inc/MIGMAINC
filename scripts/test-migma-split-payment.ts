/**
 * Automated integration test for the Migma Split Payment flow.
 *
 * Strategy: bypass Parcelow entirely.
 *   - Directly INSERT into split_payments with fake order IDs.
 *   - Simulate Parcelow webhooks for P1 and P2.
 *   - Assert DB state transitions at each step.
 *   - Print what each UI page would show to the student.
 *
 * This tests our entire backend (webhook logic, state machine,
 * migma-payment-completed invocation) with zero dependency on
 * Parcelow API, CPF validation, or sandbox availability.
 *
 * Run:
 *   npx tsx scripts/test-migma-split-payment.ts
 *
 * Requirements:
 *   SUPABASE_SERVICE_ROLE_KEY must be in .env
 *   (VITE_SUPABASE_URL is already in .env)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Load .env ──────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* rely on real env */ }
}
loadEnv();

const SUPABASE_URL            = process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing env vars. Add SUPABASE_SERVICE_ROLE_KEY to .env');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

// ─── Terminal helpers ────────────────────────────────────────────────────────
const R  = '\x1b[0m';
const G  = '\x1b[32m';
const RE = '\x1b[31m';
const C  = '\x1b[36m';
const Y  = '\x1b[33m';
const D  = '\x1b[2m';
const B  = '\x1b[1m';

let failures = 0;
let totalAsserts = 0;

function step(n: number | string, msg: string) {
  console.log(`\n${C}${B}[STEP ${n}]${R} ${B}${msg}${R}`);
}

function assert(cond: boolean, msg: string) {
  totalAsserts++;
  if (cond) {
    console.log(`  ${G}✔${R}  ${msg}`);
  } else {
    console.error(`  ${RE}✘${R}  ${msg}`);
    failures++;
  }
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function invokeWebhook(body: Record<string, unknown>) {
  const res = await fetch(`${FUNCTIONS_BASE}/parcelow-webhook`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

// ─── UI Renderers ────────────────────────────────────────────────────────────
// These functions print exactly what the React pages would show to the student.

function renderRedirectSuccessPage(split: Record<string, unknown>) {
  const p1Method = String(split.part1_payment_method ?? '').toUpperCase();
  const p2Method = String(split.part2_payment_method ?? '').toUpperCase();
  const p1Amount = parseFloat(String(split.part1_amount_usd ?? 0)).toFixed(2);
  const p2Amount = parseFloat(String(split.part2_amount_usd ?? 0)).toFixed(2);
  const total    = parseFloat(String(split.total_amount_usd ?? 0)).toFixed(2);
  const orderId  = split.order_id ?? '(migma — sem order_id)';

  console.log(`
${Y}┌─────────────────────────────────────────────────────────┐
│           SplitPaymentRedirectSuccessStyle              │
│             /checkout/split-payment/redirect            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✅  Pagamento Bem-sucedido!                             │
│  A primeira parte do pagamento foi processada           │
│  com sucesso.                                           │
│                                                         │
│  ┌── Resumo do Pedido ── [SPLIT PAYMENT] ─────────────┐ │
│  │  Referência do Pedido:  ${String(orderId).padEnd(28)}│ │
│  │  Preço Total:           US$ ${total.padEnd(25)}│ │
│  │                                                    │ │
│  │  ┌─────────────────────┐ ┌──────────────────────┐ │ │
│  │  │ PARTE 1 (${p1Method.padEnd(4)})        │ │ PARTE 2 (${p2Method.padEnd(4)})       │ │ │
│  │  │ US$ ${p1Amount.padEnd(16)}│ │ US$ ${p2Amount.padEnd(15)}│ │ │
│  │  │ ✓ PAGO              │ │ ○ PENDENTE           │ │ │
│  │  └─────────────────────┘ └──────────────────────┘ │ │
│  │                                                    │ │
│  │  ┌────────────────────────────────────────────┐   │ │
│  │  │  Redirecionando para a Parte 2             │   │ │
│  │  │              [ 10 ]                        │   │ │
│  │  │              segundos                      │   │ │
│  │  └────────────────────────────────────────────┘   │ │
│  │  [  Pagar Parte 2 Agora  →  ]                      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  Seu progresso foi salvo. Assim que a Parte 2 for       │
│  concluída, o pedido será finalizado.                   │
│                                                         │
└─────────────────────────────────────────────────────────┘${R}`);
}

function renderFinalSuccessPage(split: Record<string, unknown>) {
  const service  = String(split.migma_service_type ?? 'transfer');
  const total    = parseFloat(String(split.total_amount_usd ?? 0)).toFixed(2);
  const p1Amount = parseFloat(String(split.part1_amount_usd ?? 0)).toFixed(2);
  const p2Amount = parseFloat(String(split.part2_amount_usd ?? 0)).toFixed(2);
  const p1Method = String(split.part1_payment_method ?? '').toUpperCase();
  const p2Method = String(split.part2_payment_method ?? '').toUpperCase();

  console.log(`
${G}┌─────────────────────────────────────────────────────────┐
│    SplitPaymentRedirectFlow → fully_completed           │
│    Redirects to: /student/checkout/${service.padEnd(20)}│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🎉  Primeira Parte Paga! → Segunda Parte Paga!         │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Parte 1 (${p1Method.padEnd(4)}):   US$ ${p1Amount.padEnd(10)}  ✔ completed  │   │
│  │  Parte 2 (${p2Method.padEnd(4)}):   US$ ${p2Amount.padEnd(10)}  ✔ completed  │   │
│  │  ─────────────────────────────────────────────  │   │
│  │  Total:          US$ ${total.padEnd(32)}│   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  → Redirecting to /student/checkout/${service}?success=true
│                                                         │
│  MigmaCheckout receives success=true                    │
│  handleVerifyAndAdvance() polls:                        │
│    user_profiles.has_paid_selection_process_fee = true  │
│  → Advances to Step 2 (document upload)                 │
│                                                         │
└─────────────────────────────────────────────────────────┘${R}`);
}

// ─── Test config ─────────────────────────────────────────────────────────────
const TS          = Date.now();
const TEST_EMAIL  = `test-split-${TS}@test.migma.com`;
const SERVICE     = 'transfer';
const TOTAL       = 400;
const P1_AMOUNT   = 200;
const P2_AMOUNT   = 200;
const FAKE_P1_ID  = `TEST-P1-${TS}`;
const FAKE_P2_ID  = `TEST-P2-${TS}`;

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(` ${B}🧪  MIGMA SPLIT PAYMENT — AUTOMATED TEST${R}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${D} Email      : ${TEST_EMAIL}`);
  console.log(` Split      : $${P1_AMOUNT} card  +  $${P2_AMOUNT} pix  =  $${TOTAL} total`);
  console.log(` Fake P1 ID : ${FAKE_P1_ID}`);
  console.log(` Fake P2 ID : ${FAKE_P2_ID}${R}`);

  let userId     = '';
  let splitId    = '';

  // ── 1. Create test user ────────────────────────────────────────────────────
  step(1, 'Create test user (Supabase Auth)');

  const { data: u, error: uErr } = await db.auth.admin.createUser({
    email: TEST_EMAIL,
    password: `Test${TS}!`,
    email_confirm: true,
    user_metadata: { full_name: 'Teste Split Payment' },
  });

  if (uErr || !u.user) {
    console.error(`${RE}❌  Cannot create user: ${uErr?.message}${R}`);
    process.exit(1);
  }
  userId = u.user.id;
  assert(!!userId, `User created — id: ${userId}`);

  try {
    // ── 2. Insert split_payments directly (no Parcelow API) ──────────────────
    step(2, 'INSERT into split_payments (bypassing Parcelow API)');

    const insertPayload = {
      source:                    'migma',
      migma_user_id:             userId,
      migma_service_type:        SERVICE,
      order_id:                  null,
      total_amount_usd:          TOTAL,
      part1_amount_usd:          P1_AMOUNT,
      part1_payment_method:      'card',
      part1_parcelow_order_id:   FAKE_P1_ID,
      part1_parcelow_checkout_url: `https://sandbox-2.parcelow.com.br/fake/${FAKE_P1_ID}`,
      part2_amount_usd:          P2_AMOUNT,
      part2_payment_method:      'pix',
      part2_parcelow_order_id:   FAKE_P2_ID,
      part2_parcelow_checkout_url: `https://sandbox-2.parcelow.com.br/fake/${FAKE_P2_ID}`,
      overall_status:            'pending',
      part1_payment_status:      'pending',
      part2_payment_status:      'pending',
    };

    const { data: inserted, error: insertErr } = await db
      .from('split_payments')
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr || !inserted) {
      console.error(`${RE}❌  INSERT failed: ${insertErr?.message}${R}`);
      throw new Error('abort');
    }

    splitId = inserted.id as string;
    assert(!!splitId,                                 `Record created — id: ${splitId}`);
    assert(inserted.source          === 'migma',      'source = migma');
    assert(inserted.migma_user_id   === userId,       'migma_user_id correct');
    assert(inserted.overall_status  === 'pending',    'overall_status = pending');
    assert(inserted.part1_parcelow_order_id === FAKE_P1_ID, `P1 ID = ${FAKE_P1_ID}`);
    assert(inserted.part2_parcelow_order_id === FAKE_P2_ID, `P2 ID = ${FAKE_P2_ID}`);

    // ── 3. What the redirect page shows BEFORE any webhook ───────────────────
    step(3, 'UI snapshot: student lands on redirect page (P1 not yet confirmed)');
    console.log(`
${D}  → /checkout/split-payment/redirect?split_payment_id=${splitId}
  The page calls fetchSplitPaymentStatus() and reads the DB.
  part1_payment_status = 'pending' → startCountdown(part1_parcelow_checkout_url, 3)
  Shows 3-second countdown then redirects to the (fake) Parcelow P1 URL.
  [In a real flow the student pays here — we simulate that with the webhook below]${R}`);

    // ── 4. Fire webhook — Part 1 paid ─────────────────────────────────────────
    step(4, 'Simulate Parcelow webhook: Part 1 paid (event_order_paid)');

    const { status: s1, text: t1 } = await invokeWebhook({
      event: 'event_order_paid',
      order: {
        id:           FAKE_P1_ID,
        status_text:  'Paid',
        total_usd:    P1_AMOUNT * 100,
        total_brl:    P1_AMOUNT * 500,
        installments: 1,
        payments: [{ total_brl: P1_AMOUNT * 500, installments: 1 }],
      },
    });

    assert(s1 < 300, `Webhook P1 HTTP ${s1} (expected < 300)`);
    console.log(`  ${D}Response: ${t1.slice(0, 200)}${R}`);

    await sleep(1500);

    // ── 5. Assert state after P1 ──────────────────────────────────────────────
    step(5, 'Assert DB state after Part 1 webhook');

    const { data: afterP1 } = await db
      .from('split_payments')
      .select('part1_payment_status, part2_payment_status, overall_status')
      .eq('id', splitId)
      .single();

    console.log(`  ${D}DB: ${JSON.stringify(afterP1)}${R}`);
    assert(afterP1?.part1_payment_status === 'completed',       'part1_payment_status = completed');
    assert(afterP1?.part2_payment_status !== 'completed',       'part2 still pending');
    assert(afterP1?.overall_status       === 'part1_completed', 'overall_status = part1_completed');

    // ── 6. What the success page shows AFTER P1 ───────────────────────────────
    step(6, 'UI snapshot: SplitPaymentRedirectSuccessStyle (after P1 paid)');

    const { data: splitForUI } = await db
      .from('split_payments')
      .select('*')
      .eq('id', splitId)
      .single();

    renderRedirectSuccessPage(splitForUI as Record<string, unknown>);

    // ── 7. Fire webhook — Part 2 paid ─────────────────────────────────────────
    step(7, 'Simulate Parcelow webhook: Part 2 paid (event_order_paid)');

    const { status: s2, text: t2 } = await invokeWebhook({
      event: 'event_order_paid',
      order: {
        id:           FAKE_P2_ID,
        status_text:  'Paid',
        total_usd:    P2_AMOUNT * 100,
        total_brl:    P2_AMOUNT * 500,
        installments: 1,
        payments: [{ total_brl: P2_AMOUNT * 500, installments: 1 }],
      },
    });

    assert(s2 < 300, `Webhook P2 HTTP ${s2} (expected < 300)`);
    console.log(`  ${D}Response: ${t2.slice(0, 200)}${R}`);

    // migma-payment-completed is called async inside the webhook
    await sleep(3000);

    // ── 8. Assert final state ─────────────────────────────────────────────────
    step(8, 'Assert DB state after Part 2 webhook');

    const { data: finalSplit } = await db
      .from('split_payments')
      .select('*')
      .eq('id', splitId)
      .single();

    console.log(`  ${D}DB: ${JSON.stringify({
      overall_status:       finalSplit?.overall_status,
      part1_payment_status: finalSplit?.part1_payment_status,
      part2_payment_status: finalSplit?.part2_payment_status,
    })}${R}`);

    assert(finalSplit?.overall_status       === 'fully_completed', 'overall_status = fully_completed');
    assert(finalSplit?.part1_payment_status === 'completed',       'part1 = completed');
    assert(finalSplit?.part2_payment_status === 'completed',       'part2 = completed');

    // ── 9. What the final redirect page shows ────────────────────────────────
    step(9, 'UI snapshot: SplitPaymentRedirectFlow (fully_completed branch)');
    renderFinalSuccessPage(finalSplit as Record<string, unknown>);

    // ── 10. Verify user_profiles flag ─────────────────────────────────────────
    step(10, 'Verify user_profiles.has_paid_selection_process_fee');

    const { data: profile } = await db
      .from('user_profiles')
      .select('has_paid_selection_process_fee, user_id')
      .eq('user_id', userId)
      .maybeSingle();

    console.log(`  ${D}Profile: ${JSON.stringify(profile)}${R}`);
    assert(
      profile?.has_paid_selection_process_fee === true,
      'has_paid_selection_process_fee = true',
    );

  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────────
    step('🧹', 'Cleanup test data');
    if (splitId) {
      const { error: delSplit } = await db.from('split_payments').delete().eq('id', splitId);
      assert(!delSplit, `split_payments ${splitId} deleted`);
    }
    if (userId) {
      await db.from('user_profiles').delete().eq('user_id', userId);
      const { error: delUser } = await db.auth.admin.deleteUser(userId);
      assert(!delUser, `Auth user ${userId} deleted`);
    }
  }

  // ─── Result ──────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (failures === 0) {
    console.log(`${G}${B} 🎉  ALL ${totalAsserts} ASSERTIONS PASSED${R}`);
  } else {
    console.log(`${RE}${B} ❌  ${failures} / ${totalAsserts} ASSERTION(S) FAILED${R}`);
    process.exit(1);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error(`\n${RE}❌  Unhandled error:${R}`, err);
  process.exit(1);
});
