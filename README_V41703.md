# KeySuite V4.17.03

## Customer OEM Price authority fix

This build fixes the case:

- Owner opens Company A → OEM Price is enabled.
- Admin role is assigned OEM.
- Admin opens the same Company A → OEM Price incorrectly appears unavailable.

### Correct rule

**Role Brand Assigned AND Customer Price Preference**

| Role allows OEM | Company A OEM Price | Result |
|---|---|---|
| Yes | Yes | Price available |
| Yes | No | Price unavailable |
| No | Yes | Price unavailable |
| No | No | Price unavailable |

### What changed

1. Customer Brand / Series Price Preference is read from central Supabase data for every user.
2. Browser localStorage is no longer used as an authoritative Price Preference fallback.
3. The Role Brand authority-load race now forces the selected Customer preference to reload.
4. A V4.17.03 same-company Supabase read RPC lets Admin read the exact Customer preference saved by Owner.
5. If Supabase cannot load the Customer Price Preference, KeySuite shows a database-read error instead of silently treating OEM as unticked.

## Required Supabase SQL

Run:

`supabase/migrations/V41703_CUSTOMER_PRICE_PREFERENCE_READ.sql`

Then refresh KeySuite and sign in again as Admin.

No pricing formula, CHC/ES curve, selector, product, or quotation logic was changed.
