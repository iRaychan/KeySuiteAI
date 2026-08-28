# KeySuite V4.14.12.2 — CHC Product Curve Hotfix

## Fixed

The blocking message:

`This CHC model could not be loaded.`

has been removed from the CHC Product curve path.

### Product → B.G.Reich → CHC G2

G2 Product models now come directly from the exact existing CHC G2 selector/curve database (**409 models**), rather than deriving the Product model list from the Price List table.

This guarantees that every Product G2 **Curve** button points to an actual existing G2 hydraulic model.

The curve dialog now opens only after the selector confirms the curve was prepared, so a failed load cannot leave a hanging blank popup.

A static hydraulic initialization test passed for all **409 G2 curve models**.

### Product → B.G.Reich → CHC G1

CHC G1 has no dedicated hydraulic curve dataset yet, so the **Curve button is removed** for G1.

G1 remains available for:
- Quote
- Assembly
- Price List
- Company & Pricing

G1 Quote / Assembly no longer opens the selector iframe. It uses the supplied G1 technical model data directly, together with:
- G1 own Price List
- G1 own dimensions
- generation code G1

### Selection

B.G.Reich hydraulic Selection remains:
- CHC G2
- ES

CHC G1 stays hidden from Selection until a real G1 curve dataset is supplied.

## Supabase

No new SQL is required if V4.14.12 is already installed.
