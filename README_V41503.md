# KeySuite V4.15.03 — CHC Price Group Final Split

## Price Group

Generic **CHC** is removed.

The CHC Price Groups are now only:

- **CHC G1**
- **CHC G2**

Old OEM mapping rows stored as `CHC` are migrated permanently to `CHC_G2`.

## CHC G1

CHC G1 does **not** need a curve in order to quote.

Available:
- Product
- own G1 Price List
- Company & Pricing
- Quote
- Assembly

Not available yet:
- Curve
- hydraulic Selection

Dashboard now shows:

**CHC G1 · Price / Quote available · Curve / Selection unavailable**

instead of the misleading generic no-series message.

## CHC G2

CHC G2 remains the current hydraulic CHC generation.

Available:
- Product
- own G2 Price List
- Company & Pricing
- Quote
- Assembly
- Curve
- hydraulic Selection

Dashboard / Quick Selection explicitly treats CHC G2 as the CHC hydraulic series.

## Supabase

Run:

1. `supabase/migrations/V41503_CHC_G2_PRICE_GROUP_MIGRATION.sql`
2. `supabase/migrations/V41503_VERIFY_CHC_PRICE_GROUPS.sql`

The verification should report zero generic `CHC` mapping rows.

## Protected

No changes were made to:
- `product.js`
- CHC Product curve selector
- CHC hydraulic selector
- ES selector
- `pricelist.js`
- `pricing.js`
- quotation PDF layout
