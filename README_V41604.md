# KeySuite V4.16.04

## Dashboard Quick Selection — Customer Price Gate

- Dashboard → Quick Selection → Brand / Series Settings now shows only Brand / Series with **Price ticked** for the currently selected customer under **Key → Customer**.
- Final visibility rule: **Role / Owner allowed ∩ Customer Price enabled ∩ User Quick Selection preference**.
- Unticked customer Price Brand / Series are hidden from the Quick Selection settings and cannot produce Quick Selection results.
- If no customer is selected, Quick Selection Brand / Series shows a Select Customer message.
- If the selected customer has no Price-enabled hydraulic Brand / Series, the panel shows an explicit empty-state message.
- Changing customer or saving customer Price preference refreshes the Dashboard Brand / Series panel immediately.
- Customer Curve Preference is no longer used as an extra Dashboard Quick Selection gate; Dashboard user preference is the user-selectable subset after the customer Price gate.

No new Supabase migration is required.
