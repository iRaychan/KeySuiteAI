# KeySuite V4.15.12

## Product → CHC G2 → Curve

Added:

- Save Display Settings
- Reset to Default
- Save status

Saved Product CHC G2 display controls:

- 2P / 3P / 4P / 5P / 6P
- Duty points D1–D6
- System curve
- After-orifice curve
- Operating point

Product CHC G2 uses its own saved setting namespace `CHC_PRODUCT`, separate from Selection → CHC G2.

## Supabase SQL required

Run:

`supabase/migrations/V41512_CHC_PRODUCT_DISPLAY_SETTINGS.sql`

Optional verification:

`supabase/migrations/V41512_VERIFY_CHC_PRODUCT_DISPLAY_SETTINGS.sql`

No CHC G2 hydraulic curve data or Selection CHC logic was changed.
