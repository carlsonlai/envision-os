# Contact Import — Apr 2026

Data prepared from `~/Desktop/contact/Carlson and 2,472 others.vcf` cross-referenced with 16 Apple Mail `.mbox` files (~19,736 messages).

## Files

- `contacts.csv` — **292 leads** ready for import into `Lead` table.
  - By score: HOT=5, WARM=1, COLD=286
  - By status: QUALIFIED=6 (have email history), NURTURE=13 (partners/same-industry), NEW=273
- `competitors_excluded.csv` — 5 competitor contacts **not imported** (exclude from pipeline).
- `phone_only_audience.csv` — 2,138 phone-only contacts for WhatsApp retargeting (not CRM-eligible since `Lead.email` is required).

## Run the import

```bash
cd ~/Desktop/Jobs/envision-os

# 1. Dry run first — prints summary, writes nothing
npx ts-node --transpile-only scripts/import-contacts.ts

# 2. Apply for real
npx ts-node --transpile-only scripts/import-contacts.ts --apply
```

*(If `tsx` is installed you can use `npx tsx scripts/import-contacts.ts` instead.)*

The script is idempotent: leads matched by email are **updated (only blanks filled in)**, so your manual edits are preserved. Re-run any time with a refreshed CSV.

## Pipeline mapping used

| Bucket                  | Email Status      | Score | Status     |
|-------------------------|-------------------|-------|------------|
| Developers (clients)    | Active (≤12 mo)   | HOT   | QUALIFIED  |
| Developers / others     | Recent (1–2 y)    | WARM  | QUALIFIED  |
| Same Industry / Partner | any               | COLD  | NURTURE    |
| Unknown / Other         | Inactive or none  | COLD  | NEW        |
| Competitors             | —                 | —     | *excluded* |

## Next conversion-pipeline steps

1. Run the import with `--apply`.
2. Open `/leads` in Envicion OS — filter by `score=HOT` → these are your 5 priority outreach contacts.
3. For each HOT lead: send personalized re-engagement email → move to `PROPOSAL_SENT` when quote goes out.
4. NURTURE bucket → add to a monthly newsletter campaign (not 1:1 outreach).
5. NEW/COLD → segment into retargeting audiences (Meta Custom Audience, LinkedIn Matched, WhatsApp Broadcast via `phone_only_audience.csv`).
