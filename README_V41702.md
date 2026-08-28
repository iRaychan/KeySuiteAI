# KeySuite V4.17.02

## Role-assigned Product → Keylargo

Keylargo is now a first-class option under:

**Key → Role → Brand Assigned**

Owner can authorize:

- Keylargo → All Products / Series
- Keylargo → Baseplate
- Keylargo → Coupling
- Keylargo → KeyPLC Panel
- Keylargo → Manifold

### Restricted role behavior

When **Change Brand / Series = No**:

- Keylargo assigned → **Product → Keylargo** is available.
- Keylargo not assigned → the entire **Product → Keylargo** branch is hidden.
- If only Coupling is assigned, only **Product → Keylargo → Coupling** is available.
- B.G.Reich / TESK / OEM Brand authority remains independent.

### Coupling

This fixes the case where an Admin had Product permission but could not see Coupling.
Coupling now follows the **Keylargo role assignment**.

## Supabase

No new SQL is required. The existing `selection_scope.keys` structure already supports
`BrandId|Family` and `BrandId|*`, so this change uses the current role-authority database.
