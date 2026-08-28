# KeySuite V4.17.04

## Quick Selection customer hang fix

### Problem
After entering/selecting a Customer in Quick Selection, the page could freeze.

### Cause
V4.17.03 correctly treated a failed Customer Price Preference read as unknown, but
Quick Selection kept calling `loadPreference()` again on every render. When the
failed preference was already cached, each retry completed immediately and caused
another render/retry. This created a tight loop and froze the page.

### Fix
- Stop automatic retry once a Customer Price Preference read fails.
- Show the actual Supabase error instead of hanging.
- Add an explicit **Retry** button.
- Clear the old error when a different Customer is selected.
- Preserve the existing Role Brand Assigned AND Customer Price Preference rule.

## Supabase
No **new** SQL is required for V4.17.04.

The V4.17.03 migration is still required for the cross-user Customer pricing fix:

`supabase/migrations/V41703_CUSTOMER_PRICE_PREFERENCE_READ.sql`

No curve, selector hydraulic engine, pricing formula, Product, or quotation logic was changed.
