# KeySuite V4.17.07

## GWS Role Brand Assigned
GWS is now a permanent house Brand under **Key → Role → Brand Setting**:

- All Products / Series → `GWS|*`
- GWS Tank → `GWS|TANK`

A non-Owner user only sees **Product → GWS → Tank** when the Role Brand scope allows it.

The V4.17.06 scope database is generic, so it already persists GWS keys.

## Key → Customer Role Permission
New permission:

**Customer Settings (Key → Customer)**

- None — card/page hidden
- View — page visible, read-only
- Full — edit Customer pricing settings, Brand Margin and Brand / Series Price Preference

Owner is fixed Full.

**Customer Assigned Brand remains Owner-only**, even when another role has Customer Settings = Full.

## SQL
No new V4.17.07 SQL is required.

Existing migrations still required if not already installed:
- `V41706_KEYLARGO_ROLE_SCOPE_PERSISTENCE.sql`
- `V41705_CUSTOMER_PRICE_PREFERENCE_TEXT_ID.sql`

No CHC/ES curve data, hydraulic engine, Price List or pricing formula was changed.
