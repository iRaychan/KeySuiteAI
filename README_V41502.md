# KeySuite V4.15.02 — OEM Price Group

## OEM Series terminology

**Product Group** is renamed to **Price Group** in Brand → OEM Series Mapping.

The row is now:

**Brand | Price Group | Brand Series | Base Sub Series | Selling Sub Series | Active**

## CHC split

CHC is now commercially split into:

- **CHC G1**
- **CHC G2**

These are the active CHC Price Groups.

Generic **CHC** is no longer offered when creating a new OEM mapping because it no longer identifies an unambiguous price source.

Existing old rows stored as `CHC` are preserved and displayed as:

**CHC (Legacy)**

They are not auto-converted because KeySuite cannot safely guess whether an old OEM mapping should use G1 or G2. The owner can change each legacy row to CHC G1 or CHC G2 explicitly.

## Meaning

- **Price Group** = which KeySuite price source / generation the OEM product follows.
- **Brand Series** = the selling/display series name used by that Brand.
- **Base Sub Series** = source/base series.
- **Selling Sub Series** = OEM-facing mapped sub-series.

Example:

`TESK | CHC G2 | SVM | CHC 15 | SVM 15`

means TESK SVM uses the CHC G2 commercial price source.

## Protected

This build does not modify:

- `product.js`
- `selector/product.html`
- CHC hydraulic selector
- ES selector
- `pricelist.js`
- CHC G2 curve data / Product curve path
- quotation PDF layout

## Supabase

No new SQL required.
