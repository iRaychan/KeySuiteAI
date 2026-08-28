# KeySuite V4.14.11

## Product → CHC generation selection

Added **CHC G1** and **CHC G2** to Product → CHC.

Default:
- ✓ CHC G1
- ✓ CHC G2

At least one generation must remain selected.

### G1 Product result
- Customer-visible model = G1 model.
- Hydraulic curve / motor / technical performance = mapped G2 equivalent.
- Price = **G1 independent Price List only**.
- Dimension = supplied G1 dimension data.
- CHC dimension uses the G1 CHC envelope.
- CHCS / CHCN use the G1 stainless envelope.
- G1 technical/product master remains non-amendable.

### G2 Product result
Existing G2 behaviour is preserved. No G2 curve data, model data, dimension data, price table or PDF layout is replaced.

## Price completion counters

Global completion rule is now:

**Count a price only when value > 0.**

Therefore these are all treated as not entered:
- blank
- NULL
- 0
- 0.00
- negative values

Applied to:
- CHC G1
- CHC G2
- ES
- GWS
- KeyPLC
- Manifold

Motor and Coupling already used `> 0`, so their existing logic is preserved.

Example:
If a group has 1,227 expected USD price cells and all are zero:

`USD 0/1,227`

## Database

No new Supabase migration is required for V4.14.11 if V4.14.10 was already installed.

V4.14.10 independent G1 Price List remains required for G1 quotation pricing.
