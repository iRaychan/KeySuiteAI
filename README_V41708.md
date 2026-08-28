# KeySuite V4.17.08

## Customer Assigned Brands — multi-select
Owner can now assign more than one Brand to a Customer.

Example:
- Customer: B.G.Reich + OEM
- User Role Brand Assigned: B.G.Reich + OEM + TESK + Keylargo
- Left Panel after selecting that Customer: **B.G.Reich + OEM only**

Rule:
**Left Panel = Role Brand Assigned ∩ Customer Assigned Brands**

No Customer Assigned Brand tick means no Customer-level Brand restriction.

Permanent house Brands Keylargo and GWS are also available in Customer Assigned Brands.

## Brand / Series Price Preference
Key → Customer → Brand / Series Price Preference now also includes:
- Keylargo → Baseplate
- Keylargo → Coupling
- Keylargo → KeyPLC Panel
- Keylargo → Manifold
- GWS → GWS Tank
- M.O.S → Motor

These Price ticks are commercial permission only. They do not decide which Brand
appears in the Left Panel.

## Required SQL
Run:

`supabase/migrations/V41708_CUSTOMER_ASSIGNED_BRANDS_MULTI.sql`

This creates the multi-Brand Customer scope and migrates the previous single
Customer Brand assignment into the new store.

Existing V4.17.06 Role scope and V4.17.05 Customer Price Preference migrations
remain required if they have not already been installed.

No CHC/ES hydraulic curve data, Price List values, or pricing formulas were changed.
