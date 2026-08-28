# KeySuite V4.16.06

Quick Selection permission/save regression fix.

- Account Brand / Series assignment is now the absolute maximum Quick Selection scope for every non-Owner user, regardless of Change Brand / Series permission.
- Dashboard choices are now: Account Assigned ∩ Customer Price Enabled ∩ User Quick Selection Preference.
- An intentionally empty user Quick Selection preference remains empty after save/reload; it no longer resets to all allowed entries.
- Saving the visible subset preserves hidden preferences for other customers.
- Quick Selection local preference is read first so a successful local save is not overwritten by stale/unavailable cloud data.
- Customer Brand / Series Price editors also respect the signed-in account assignment for non-Owner users.
- Owner retains full active Brand / Series visibility.
- No new Supabase SQL is required.
