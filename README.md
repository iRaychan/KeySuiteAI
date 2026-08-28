KeySuite V4.16.08

## V4.16.04

Dashboard Quick Selection Brand / Series is now strictly customer Price-gated. See `README_V41604.md`.

# KeySuite V4.16.02 FULL CLEAN

## Update
- Product → CHC Impeller Configuration is collapsible and starts collapsed.
- Dashboard Quick Selection now shows Brand / Series Settings.
- Each user can choose a subset of the Brand / Series authorized by the Owner.
- Restricted users cannot select outside their assigned Brand / Series scope.
- No new Supabase SQL is required.

---

# KeySuite V4.14.09.1 FULL CLEAN

## Hotfix

Fixes login/runtime error:

`Secure data could not be loaded: selectedChcGeneration is not defined`

Cause: V4.14.09 Price List logic referenced the CHC generation state without declaring it under JavaScript strict mode.

Fix:
- declares `selectedChcGeneration` with safe default `G2`
- preserves saved G1/G2 choice from localStorage during initialization
- bumps Price List browser cache query to `414091`
- bumps service-worker cache to `keysuite-v414091`

No database schema or price data change is required for this hotfix.
CHC G2 data/curve/dimension/PDF remain unchanged.
CHC G1 remains Price List read-only and hydraulic Selection disabled.

---

# KeySuite V4.14.09 FULL CLEAN

## CHC G1 / G2

V4.14.09 completes the visible CHC G1 Price List integration.

### CHC G2
- Existing/current CHC generation.
- Existing model names, prices, selector, curves, technical data, dimensions and PDF behaviour are unchanged.
- Price List remains editable according to the existing role permissions.

### CHC G1
- 409 G1 models.
- Available as production/Product data from V4.14.08.
- Hydraulic Selection remains disabled.
- App amendment remains disabled.
- Price List is now visible from **Price List → CHC G1 / G2 → Generation: CHC G1**.
- G1 price and rarity display follows the mapped G2 source model.
- G1 Price List is read-only.
- G1 dimensions remain the supplied G1 dimensions:
  - CHC uses the G1 CHC dimension profile.
  - CHCS and CHCN use the supplied G1 stainless dimension profile.

## Upgrade database order

For a database still on V4.14.06, run in order:

1. `supabase/migrations/V41407_CHC_GENERATIONS.sql`
2. `supabase/migrations/V41408_CHC_G1_PRODUCTION.sql`
3. `supabase/migrations/V41409_CHC_G1_PRICELIST.sql`
4. `supabase/migrations/V41409_VERIFY_CHC_G1_PRICELIST.sql`

If V4.14.07 and V4.14.08 are already installed, run only V4.14.09 + verification.

If Supabase shows the RLS safety prompt, choose **Run and enable RLS**.

## GitHub deployment

Upload the contents of this folder to the existing KeySuite GitHub Pages repository.

V4.14.09 changes the browser Price List integration and bumps the service-worker cache to `keysuite-v41409`.


## V4.16.03
- Fixed Dashboard → Quick Selection → Brand / Series Settings blinking then disappearing.
- Removed legacy Customer Brand/Series Dashboard ownership that forced the panel to `display:none` after initial render.
- Dashboard Quick Selection Brand/Series is now owned only by the user preference module and remains constrained by Owner/Role Brand-Series authority.
- Customer Brand/Series price permission remains under Key → Customer and no longer hides/rebuilds Dashboard Quick Selection settings/results.


## V4.16.06
Quick Selection permission/save regression fix. See README_V41606.md.


## V4.16.07
Category margin visual indicator: Product Rules with 0% Margin are filled/highlighted; non-zero Margin rules remain normal. The selected Margin row is also highlighted at 0%.


## V4.16.08
- Category Compare View now lists CHC G1 and CHC G2 separately.
- Each generation reads and edits its independent category Margin / Normal / Rare / Transport rule.
- Compare View CHC saves now use the generation-specific category RPC to keep G1 and G2 independent.
- Other Category Compare products are unchanged.
