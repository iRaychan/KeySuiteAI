# KeySuite V4.14.12.1 Hotfix

## Selection

B.G.Reich hydraulic Selection now shows:

- **CHC G2**
- **ES**

**CHC G1 is removed from Selection for now** because a real G1 hydraulic curve dataset has not been supplied.

CHC G1 remains available in:
- Product
- Price List
- Company & Pricing
- Category pricing

When G1 curve data is supplied later, it can be enabled in Selection as its own generation.

## Product CHC G2 load fix

The Product bridge now normalizes CHC model text before looking it up in the existing G2 curve database. This prevents valid G2 models from failing because of trailing spaces, spacing around hyphens, generation labels, or CHCS/CHCN display prefixes.

No CHC G2 hydraulic data is changed.

## Database

No new Supabase SQL is required for this hotfix if V4.14.12 is already installed.
