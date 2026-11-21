# OakHaven owner-only financial ledger (DRAFT)

## Deployment hold
**Do not merge, deploy or run SQL without explicit owner approval.** This change is isolated from the current production dashboard. No personal transactions, account numbers, balances, creditors, source XLSX/CSV, credentials or individual schedules are committed in this branch.

## What is implemented
- Supabase SQL schema: `supabase/owner_finance_ledger.sql` with four owner-scoped RLS tables. No seed statements.
- `/finance`: manually reconcile account balances and debts, maintain expected income/payment events and upload local CSV.
- `POST /api/finance/import`: owner authentication, same-origin write token, 150-record cap, strict shape validation, preview without writes, SHA-256 fingerprint deduplication, conflict-safe insert.
- `GET/POST /api/finance/ledger`: owner-only reads and upsert by account label / creditor / event label+date; responses cannot be cached.
- Old bank UX links to /finance and explicitly warns that its legacy case-study data is not reconciled.

## Before merge (required)
1. **Security:** review RLS in an isolated Supabase environment. Confirm unauthorized/anonymous users cannot read or write; verify production `OAKHAVEN_OWNER_USER_ID` still matches the intended owner.
2. **Data hygiene:** existing older code contains a hardcoded example dataset; this PR **does not remove it yet**, to avoid breaking historical tests/old UI. Before enabling the new ledger in production, decide on secure legacy-data retirement and cross-module synchronization. Do not treat legacy bank balances as reconciled.
3. **Migration:** apply the SQL using Supabase SQL Editor only after review, *before* deploying code. Back up schema. Never upload personal movements to GitHub.
4. **Test:** `npm test`, `npx tsc --noEmit`, `npm run build`, isolated database tests for RLS, CSV preview/commit, duplicate import twice, CSRF, session expiry, and per-owner isolation. Connector edits did not execute this suite.
5. **User acceptance:** provide the private CSV file through the chat (not GitHub); review its 130 records locally, confirm 'opening balance' rows are not income, check 14 later records, inspect duplicates, and *then* explicitly authorize the browser import.
6. **Financial accuracy:** current balance must be reconciled per account. Future investments, savings payouts and salary events stay 'expected' until paid; do not credit them to cash today. Loan principal and currently-due installments must not be added twice; settled debts require zero amount due.
7. **Reliability:** verify the deployment process contains no automatic PR preview against real production Supabase before authorizing rollout.

## CSV columns
`Fecha,Tipo,Categoría,Monto,Descripción,Método de Pago`, UTF-8 with header, up to 150 rows. Types: `Ingreso`, `Gasto`, `Saldo inicial`, `Transferencia`. Existing old records are **not** migrated by this code; the ledger starts empty. Fingerprint matches transaction time, type, category, amount, description, payment method (not raw CSV ID). Inspect collision warnings before saving.

## Open limitations / Release blockers
- No automatic synchronization with legacy `player_treasury`, Debt Bosses or GP/XP. This is deliberate to avoid double-counting and unintended rewards.
- The old dashboard still contains hardcoded sample records and localStorage balances. These need a separate audited retirement plan.
- CSV import currently does not support spreadsheets directly; convert to the private CSV file; it is **never stored in this repository**.
- Persistence requires the SQL migration. Until then, API returns 503 (fail closed).
- Changes have not been executed against user's financial data or deployed.
