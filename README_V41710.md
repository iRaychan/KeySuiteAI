# KeySuite V4.17.10

## Fix — Brand / Series Price Preference saving

V4.17.10 replaces the old V3.96.3 Price Preference save RPC with a generic
central Supabase store.

It accepts all current and future text Brand / Series keys, including:

- Keylargo — Baseplate / Coupling / KeyPLC Panel / Manifold
- GWS — GWS Tank
- M.O.S — Motor
- B.G.Reich / OEM / TESK / other active Brands and their Price Groups

Existing legacy Customer preferences are imported automatically the first time
they are read after the V4.17.10 migration is installed.

## Brand-level checkbox

Each Brand card under **Key → Customer → Brand / Series Price Preference** now
has an **All Series** checkbox.

- Tick Brand → ticks every visible Role-authorized series under that Brand.
- Untick Brand → clears every visible Role-authorized series under that Brand.
- Some series ticked → Brand checkbox shows a partial / indeterminate state.
- Hidden series outside the current user's Role Brand Assigned are preserved and
  are not changed by the Brand checkbox.

## Left Panel rule remains unchanged

- No Quick Selection Customer → Role Brand Assigned.
- Customer selected → Role Brand Assigned ∩ Customer Brand / Series Price Preference.
- No Price Preference ticks → no Brand / Series for that Customer.

Curve Preference remains separate.

## Required Supabase migration

Run:

`supabase/migrations/V41710_GENERIC_CUSTOMER_PRICE_PREFERENCE.sql`

Optional verification:

`supabase/migrations/V41710_VERIFY_GENERIC_CUSTOMER_PRICE_PREFERENCE.sql`

No CHC/ES hydraulic data, curve engine, Price List or pricing formula was changed.
