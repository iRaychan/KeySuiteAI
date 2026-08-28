# KeySuite V4.17.06

## Keylargo Role Brand Assigned persistence fix

### Problem
Under **Key → Role → Brand Setting → Keylargo**, the Owner could tick Keylargo /
Coupling / Baseplate / KeyPLC / Manifold and save, but after refresh the ticks
returned to OFF.

### Fix
V4.17.06 adds persistent Role scope storage supporting:

- `KEYLARGO|*`
- `KEYLARGO|BASEPLATE`
- `KEYLARGO|COUPLING`
- `KEYLARGO|KEYPLC`
- `KEYLARGO|MANIFOLD`

Existing B.G.Reich / TESK / OEM / other Brand assignments are preserved using the
old scope store as a migration fallback. Normal Brand scopes are dual-written for
compatibility.

## Required Supabase SQL

Run:

`supabase/migrations/V41706_KEYLARGO_ROLE_SCOPE_PERSISTENCE.sql`

Then refresh KeySuite, edit the user, tick Keylargo / Coupling as required, Save
User, refresh again, and reopen the user. The ticks should remain saved.

If the V4.17.05 Customer Price Preference TEXT-ID migration has not yet been run,
it remains required separately for the `COID00001` pricing fix.
