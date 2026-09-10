# Polygon Madikeri — Final Performance/Auth/Location Audit

This build is based directly on the uploaded PRIVATE_GROUPS_BP_TRADER_UPDATE(3) package.

Targeted corrections:
- Authentication recovery now uses a single shared Supabase refresh operation, preventing concurrent refresh-token races.
- A genuinely invalid persisted session is cleared locally instead of leaving the app stuck on “Preparing account…”.
- Short-lived in-memory GET caching speeds navigation and repeated reads; mutations invalidate affected caches.
- Complete/Reopen remains optimistic and immediate; no immediate second fetch is performed. A delayed reconciliation is used as a safety net.
- Offline completion snapshot updates are no longer awaited after the server commit.
- Location tracking is centralized at the authenticated app shell: an initial GPS fix is requested automatically, watchPosition keeps it current, and a lightweight position refresh runs while the app is visible. Server updates are throttled to about 15 seconds.
- Open Map and Team Location no longer create duplicate GPS watchers. Team Location polls latest team positions silently.
- Admin farmer export includes “Completed By / Enumerator”.
- Service-worker version bumped so the new frontend assets are picked up after deployment.

Existing workflow intentionally preserved:
- Farmer import/filter/search/pagination
- Complete/Reopen and remarks
- Private farmer groups
- BP/Trader/Group Open Map filters
- Map markers, navigation and GPS UI
- Admin/enumerator permissions
- Offline farmer/group data
