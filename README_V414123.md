# KeySuite V4.14.12.3 — CHC G2 Product Curve Display Hotfix

Fixed **Product → B.G.Reich → CHC G2 → Curve** not appearing.

Changes:
- G2 curve dialog opens immediately from the user's Curve click.
- The existing selector iframe is moved into the dialog and shown immediately.
- Added an iframe `load` fallback so the product message is sent even if the child FRAME_READY message is missed.
- Kept the exact 409-model CHC G2 curve catalogue from V4.14.12.2.
- Revalidated all 409 existing CHC G2 hydraulic models.
- CHC G1 Curve remains disabled/removed for now.
- No Supabase SQL changes.
