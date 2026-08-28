# KeySuite V4.14.12.4 — CHC G2 Product Curve Direct-Load Fix

This hotfix changes the CHC G2 Product Curve loading method.

## Previous problem
The Product page opened the selector iframe and then relied on a parent → iframe `postMessage` to tell the iframe which CHC model to draw. In deployment this could miss the initialization timing, leaving the Product Curve dialog with no curve.

## New behaviour
**Product → B.G.Reich → CHC G2 → Curve**

The selected G2 model is now placed directly into the selector iframe URL:

`selector/product.html?product=1&model=...`

The selector reads the model from the URL and initializes the curve itself on load.

Therefore the Curve display no longer depends on `FRAME_READY` or the first `postMessage` arriving at the correct time.

## Preserved
- exact 409-model CHC G2 curve catalogue
- CHC G2 hydraulic database unchanged
- CHC G1 Curve remains removed
- CHC G1 Product / Price List / Company Pricing remain available
- no Supabase SQL change
