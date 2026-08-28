# KeySuite V4.17.09

## Customer Brand authority simplified

The separate **Customer Assigned Brands** control has been removed from
**Key → Customer**.

### Left Panel

**No Quick Selection customer selected**
- shows everything permitted by **Role Brand Assigned**.

**Quick Selection customer selected**
- shows **Role Brand Assigned ∩ Customer Brand / Series Price Preference**.

This applies to all Customers.

If the selected Customer has no Price Preference ticks, no Brand / Series is shown
for that Customer.

### Brand / Series Price Preference

A checked Price row now means that Brand / Series is assigned to the Customer.

Supported entries include:
- B.G.Reich / OEM / TESK / other active Brands
- Keylargo — Baseplate, Coupling, KeyPLC Panel, Manifold
- GWS — GWS Tank
- M.O.S — Motor

### Curve Preference

Curve / Quick Selection Preference remains separate and can only further restrict
Price-authorized hydraulic series.

## Supabase

No new SQL is required for V4.17.09.

The old V4.17.08 Customer Assigned Brands table can remain in Supabase; V4.17.09
does not read or write it.

No CHC/ES hydraulic data, curve engine, Price List or pricing formula was changed.
