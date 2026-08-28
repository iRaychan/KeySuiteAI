# KeySuite V4.17.05

## 1. Customer Price Preference — TEXT Customer ID fix
KeySuite Customer IDs such as `COID00001` are text IDs, not UUIDs.

Run:

`supabase/migrations/V41705_CUSTOMER_PRICE_PREFERENCE_TEXT_ID.sql`

This removes the incorrect V4.17.03 UUID wrapper and installs the same-company TEXT-ID read RPC.

## 2. Permanent Keylargo in Role Brand Assigned
**Key → Role → Brand Assigned** always contains:

- Keylargo → All Products / Series
- Baseplate
- Coupling
- KeyPLC Panel
- Manifold

Keylargo no longer depends on a Brand Management row.

## 3. Role Brand Assigned is maximum authority
For every non-Owner:

**Role Brand Assigned** is always the maximum Brand access.

`Change Brand / Series` cannot bypass the Role Brand assignment.

## 4. Left Panel Customer filtering
No Customer selected:
- Left Panel shows all Brands assigned to the logged-in user.

Customer selected:
- Left Panel = **Role Brand Assigned ∩ Customer Assigned Brand**.

The Owner-set **Customer Assigned Brand** is the source.
Customer Price Preference and Customer Quick/Curve Preference do **not** determine the Left Panel Brand list.

## 5. CHC G1 visible model name
The visible `G1` badge after each G1 model is removed.

Example:

`CHC 8-1 G1` → `CHC 8-1`

Internal G1 routing, G1 Price List, G1 dimensions and IE2 motor identity remain unchanged.

## 6. Quick Selection Customer X
If the current working quotation has items:
- X asks for confirmation.
- Confirm → deletes the current working quotation items and starts a blank quotation.
- Cancel → nothing changes.
- Sealed quotation → cannot clear/delete.

No CHC/ES hydraulic curve data or pricing formula was changed.
