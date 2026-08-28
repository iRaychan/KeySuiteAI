# KeySuite V4.14.13 — Brand Product Groups

## Brand → OEM Series Mapping → Product Group

Product Group now allows:

- **CHC**
- **CHC G1**
- **CHC G2**
- **End Suction**
- **Motor**

CHC G1 and CHC G2 are separate commercial Product Groups even though both use the base engineering family `CHC`.

### Internal identity

| Product Group | Base Family | Generation | Price Group |
|---|---|---|---|
| CHC | CHC | — | CHC |
| CHC G1 | CHC | G1 | CHC_G1 |
| CHC G2 | CHC | G2 | CHC_G2 |
| End Suction | ES | — | ES |
| Motor | MOTOR | — | MOTOR |

Quotation rows are stamped with the exact Brand Product Group, generation and price-group identity.

This allows a Brand to have both **CHC G1** and **CHC G2** without price-source ambiguity.

### TESK / other Brands

A Brand can still use generic **CHC** when it does not need a generation split.

If a Brand later needs two CHC generations, it can add **CHC G1** and **CHC G2** separately.

## Product / Curve protection

This build changes the **Brand Product Group / OEM mapping layer only**.

It does **not** modify:
- `product.js`
- `selector/product.html`
- CHC G2 hydraulic curve data
- CHC G2 Product curve behavior
- CHC G1/G2 Price List data
- quotation PDF layout

## Supabase

Run:
1. `supabase/migrations/V41413_BRAND_PRODUCT_GROUPS.sql`
2. `supabase/migrations/V41413_VERIFY_BRAND_PRODUCT_GROUPS.sql`

Then deploy the frontend patch.
