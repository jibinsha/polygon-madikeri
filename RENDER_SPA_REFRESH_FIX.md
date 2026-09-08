# Render SPA refresh fix

For the Render Static Site `polygon-madikeri-frontend`, add this rewrite in the Render dashboard:

- Source: `/*`
- Destination: `/index.html`
- Action: Rewrite

This preserves React Router routes such as `/cluster-map`, `/farmers`, and `/dashboard` when the browser is refreshed directly.

The project also contains `frontend/public/_redirects` as a harmless fallback for hosts that honor `_redirects`.
