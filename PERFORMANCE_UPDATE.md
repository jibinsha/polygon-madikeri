# Polygon Project : Madikeri — Performance Update

This build keeps the existing application workflow unchanged.

## Main improvements

- Open Map loads farmer points independently from team locations so the farmer map can render first.
- Open Map sends only the fields required for markers and the farmer popup.
- Farmer map data uses a short server cache and Supabase requests are reduced.
- Team locations use a 5-second server cache and only recent location history is downloaded.
- Team location history cleanup is moved off the critical request path.
- Live device location gets an immediate `getCurrentPosition` call when Open Map opens and then uses `watchPosition`.
- Current user location is automatically centered on the map when first received.
- All team-member markers use the same colour.
- Farmer popup contains only: Farmer Name, Farm Name, Area under rejuvenation, Distance, Completion date, Enumerator (when available), plus Call and Navigate.
- Farmers page keeps previous results visible while a filter request is loading and caches recent filter results for instant repeat access.
- Search debounce reduced to 220 ms.
- Dashboard no longer requests or calculates map/cluster data; it loads only completion totals and trader-wise completion.
- Dashboard UI removes the map section and focuses on completion and trader completion.
- Authentication keeps the current Supabase workflow but avoids unnecessary session reads, avoids repeated profile calls on token refresh, and refreshes an expired token transparently.

## Live location limitation

Browser geolocation is live while the authenticated web app is open and the device/browser permits location access. A normal web page cannot continue sharing GPS after it is fully closed or the browser is stopped.

## Deployment

Backend Render environment:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`
- `FRONTEND_ORIGIN`

Frontend Render environment:
- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not commit real `.env` files or service-role keys.
