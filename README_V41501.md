# KeySuite V4.15.01 — Dynamic Brand Authorization

## Single Brand source of truth

**Brand Management active Brands** now drives:

1. **Role → Role Brand Assigned / Series**
2. **Customer → OEM / Assigned Brand**
3. **Dashboard → Brand / Series Settings**

This includes:
- B.G.Reich
- TESK
- every current active OEM Brand
- every future active OEM Brand added later

There is no hard-coded B.G.Reich / TESK-only list.

## Role Brand Assigned

Every active Brand is shown even if it has no OEM Series mapping yet.

Owner can authorize:
- the whole Brand using **All Products / Series**, or
- individual available hydraulic Series.

If **All Products / Series** is assigned, future Series added under that Brand remain authorized automatically.

A future OEM Brand appears in Role settings automatically, but a restricted user does **not** receive access until Owner authorizes that Brand.

## Dashboard → Brand / Series Settings

Dashboard now shows only Brands allowed by the current user's Role authorization.

- Unrestricted role / Change Brand-Series = Full → all active Brands.
- Restricted role → only Owner-authorized Brands.
- An authorized Brand with no hydraulic Series mapping still appears and shows **No active hydraulic Series mapped yet**.

Customer preference remains a secondary filter inside the Role-authorized Brand list; it cannot expose a Brand that the Role is not allowed to use.

## Customer Brand Assigned

V4.15 behavior is preserved:
all active Brands from Brand Management are available for Customer assignment, including future OEM Brands.

## CHC generation authority

For Role authorization:
- CHC
- CHC G1
- CHC G2

all belong to the CHC product family for visibility control.

This does not enable a G1 hydraulic curve.

## Protected

This build does **not** modify:
- `product.js`
- `selector/product.html`
- `selector/index.html`
- `selector-es/index.html`
- CHC G2 curve data / Product curve path
- CHC G1 curve status
- quotation PDF layout
- Price List data

## Supabase

No new SQL required.
