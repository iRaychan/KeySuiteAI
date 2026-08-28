# KeySuite V4.14.10

## Correction: CHC G1 has its own Price List

V4.14.09 incorrectly displayed CHC G1 using mapped CHC G2 price rows.

V4.14.10 removes that behaviour completely.

### CHC G1
- Own independent Price List table: `ks_products_chc_g1`
- Price List model set follows the supplied G1 price workbook: **374 models**
- CHC / CHCS / CHCN prices are saved separately for G1
- USD / RMB / MYR source prices and rarity are stored independently from G2
- No G2 price fallback
- Owner can maintain G1 prices from **Price List → CHC → Generation → CHC G1**
- G1 technical/product master remains locked
- G1 hydraulic Selection remains disabled
- G1 quotation pricing, when called with `generation_code=G1`, uses only the G1 price table

### Initial prices
The supplied file `010 - CHC G1 (Pricelist) - 260823 - V1.0.xlsx` contains 0 for every pump-price cell.

To prevent accidental RM0 quotations, V4.14.10 initializes those G1 source prices as blank (`NULL`).
Enter the actual G1 prices in the Price List.

### CHC G2
No G2 price, curve, technical, dimension or PDF data is modified.

## Install over V4.14.09.1
1. Run `supabase/migrations/V41410_CHC_G1_INDEPENDENT_PRICELIST.sql`
2. If Supabase asks, choose **Run and enable RLS**
3. Run `supabase/migrations/V41410_VERIFY_CHC_G1_INDEPENDENT_PRICELIST.sql`
4. Upload the V4.14.10 GitHub files
5. Hard refresh / reopen KeySuite once

The G1 Price List should show **374 independent G1 rows**, with no `Price source: CHC G2 ...` text.
