# Refresh + Fast Completion Update

This update makes only the requested changes:

1. **BP Number in Open Map farmer popup**
   - The BP number is now shown in the farmer popup.
   - No other popup fields or actions were changed.

2. **Complete / Reopen is immediate**
   - The Farmers page changes the visible card state immediately after the button is pressed.
   - The API update still happens first as the source of truth.
   - A background refresh reconciles the page afterward.
   - If the API update fails, the previous visible state is restored.
   - Completion audit logging no longer blocks the completion response; it is written in the background.

3. **Refresh on every React page**
   - The frontend build now creates `index.html` entry copies for every application route.
   - This prevents Render static-site deep-link refreshes such as `/farmers`, `/cluster-map`, `/admin/users`, etc. from returning `Not Found`.
   - The existing `_redirects` and `frontend/vercel.json` are kept unchanged as additional SPA fallbacks.
   - If the Render Static Site already has a rewrite rule, keep it; it is still the preferred configuration.

No farmer workflow, filtering logic, map workflow, admin permissions, database structure, or other page behavior was intentionally changed.
