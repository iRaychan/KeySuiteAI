# KeySuite V4.15 — Customer OEM Brand Assignment Restore

## Fixed

Customer Brand assignment now reads directly from the active **Brand Management** master list.

So under Customer / Company Pricing → **OEM / Assigned Brand**, the list contains:

- B.G.Reich
- TESK
- every active OEM Brand
- future active OEM Brands added later

An OEM Brand does **not** need an OEM Series mapping just to appear in the Customer assignment dropdown.

## Customer Brand / Series Settings

The V4.14 Product Group split introduced `CHC_G2`.

Customer Brand / Series settings and Quick Selection previously only recognized the literal family code `CHC`, which could make an OEM Brand mapped as `CHC_G2` disappear.

V4.15 recognizes:

- `CHC` → hydraulic CHC
- `CHC_G2` → hydraulic CHC
- `ES` → hydraulic ES

`CHC_G1` remains excluded from hydraulic Quick Selection because G1 still has no curve.

## Protected

This build does **not** modify:

- `product.js`
- `selector/product.html`
- `selector/index.html`
- CHC G2 curve data
- CHC G2 Product curve path
- CHC G1 curve status
- Price List data
- quotation PDF layout

## Supabase

No new SQL is required.
