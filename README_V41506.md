# KeySuite V4.15.06

## Preference locations are now separated

### Key → Customer → Brand / Series Price Preference
This is **Price only**.

- Tick = customer can use price / quote for that Brand / Series.
- Untick = price / quote unavailable.
- Unticked rows do not appear in the Left Customer Quick Selection preference.

### Left Panel → Customers → Brand / Series Preference
This is **Quick Selection only**.

- Only Price-authorized Brand / Series are shown.
- Tick = show in Quick Selection / Curve.
- Untick = hide from Quick Selection.
- CHC G1 never appears here because it has no hydraulic curve.

### Hierarchy

**Role Brand Authorized → Customer Price Preference → Customer Quick Selection Preference**

The previous Quick Selection tick is preserved in the background while Price is OFF.
If Price is enabled again, its previous Quick Selection preference returns.

## Dashboard
The old Dashboard Brand / Series preference editor is hidden. Quick Selection uses the selected Customer's saved preference.

## Protected
No changes to Product, CHC/ES selectors, Price List, Pricing engine, Multi-brand quotation mapping, or PDF layout.

## Supabase
No new SQL required.
