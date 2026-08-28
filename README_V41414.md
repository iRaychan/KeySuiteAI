# KeySuite V4.14.14

## Product → B.G.Reich → CHC G2 → Curve

CHC G2 Product Curve is restored to the **last known-good V4.14.10 Product path**.

For G2, the following are restored from V4.14.10:
- `ensureFrame()`
- `send(model, action)`
- G2 model-list / Curve handler
- `selector/product.html`

`selector/product.html` is byte-for-byte the V4.14.10 known-good file.

Therefore selecting:

**Product → B.G.Reich → CHC G2 → CHC 15-30 → Curve**

passes **CHC 15-30 specifically** into the original G2 Product curve bridge.

No experimental G2 catalogue or URL-based curve loader is used.

## CHC G1

G1 is isolated from the G2 curve path:
- Product available
- Quote available
- Assembly available
- own G1 Price List / dimensions
- **no Curve button**
- no hydraulic Selection

## Brand → OEM Series Mapping

- mapping inputs/selects/buttons aligned on one row
- removed `Family CHC · No generation split`
- removed the G1/G2 helper lines below Product Group

## Supabase

No new SQL is required if V4.14.13 was already installed.
