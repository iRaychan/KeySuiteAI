# KeySuite V4.14.12

## Product hierarchy

Product navigation is now:

**Product**
- **B.G.Reich**
  - **CHC G1**
  - **CHC G2**
  - **End Suction**
  - **Motor**

CHC G1 and CHC G2 are separate Product entries. The combined generation tick selector has been removed.

### CHC G1
- visible G1 model
- mapped G2 hydraulic / technical source
- independent G1 Price List
- G1 dimensions
- G1 product master protected

### CHC G2
Existing/current CHC behaviour remains unchanged.

## Company & Pricing

CHC is now split into:
- CHC G1
- CHC G2

Existing CHC category settings are migrated to CHC G2 unchanged.

CHC G1 receives a one-time starting copy during migration. After migration the rules are independent:
- G1 saves to CHC_G1 only
- G2 saves to CHC_G2
- G2 also keeps the legacy CHC rule synchronized for compatibility

Category Management also shows CHC G1 and CHC G2 separately.

## Upgrade

Run:
1. `supabase/migrations/V41412_CHC_GENERATION_COMPANY_PRICING.sql`
2. `supabase/migrations/V41412_VERIFY_CHC_GENERATION_COMPANY_PRICING.sql`

If Supabase asks, choose **Run and enable RLS**.

No CHC G2 Price List, curve, technical data, dimensions or PDF layout are changed.
