# KeySuite V4.16.05

## Customer Brand / Series Preference binding fix

- Fixed Key → Customer Brand / Series Price Preference saving to a previously opened customer (commonly Apex).
- Cause: the persistent editor accumulated click listeners that captured stale customer IDs.
- Price editor now keeps one listener and resolves the currently displayed customer at save time.
- Applied the same stale-listener fix to Brand / Series Curve / Quick Selection preference.
- No Supabase schema change required.
