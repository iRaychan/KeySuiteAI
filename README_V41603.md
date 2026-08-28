# KeySuite V4.16.03

## Fix
Dashboard → Quick Selection → Brand / Series Settings no longer blinks and disappears.

### Ownership
- Owner/Role assignment = maximum Brand/Series scope available to the user.
- User Dashboard Quick Selection preference = selectable subset within that authorized scope.
- Customer price permission remains separate under Key → Customer.

### Technical
The legacy customer-brand module no longer hides, renames, rebuilds, or filters `#ks39442Pref` / Quick Selection results. The V4.16.02 quick-selection module is the sole owner of that Dashboard UI.
