# KeySuite V4.17.01

## Invitation + Password Recovery

### Existing user with no password
The user can now press **Forgot Password?** on the KeySuite login page, enter the approved email, open the newest Supabase recovery email, and create a new password.

### New invitation
The invitation email returns to the live KeySuite site and automatically opens **Create KeySuite Password**.

### Password recovery
The recovery email returns to KeySuite and automatically opens **Set New Password**.

### Auth redirect
Invitation and recovery email links use:

`https://iraychan.github.io/KeySuite/`

instead of the current localhost test address.

### Role status
The previous **Login ready** status is replaced with **Account created** because an Auth account can exist before a password is created.

## Supabase
No new SQL required.

No Edge Function redeploy is required for this build.

Ensure Supabase **Authentication → URL Configuration → Redirect URLs** includes:

`https://iraychan.github.io/KeySuite/**`
