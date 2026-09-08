# Polygon Project : Madikeri — Farmers UI Update

## Important database step
Run the updated `supabase/schema.sql` in Supabase SQL Editor before using the new importer. It adds:
- `farmers.name_in_bpm`
- `farmers.farm_name`
- `farmers.area_under_rejuvenation`

Then re-import the current master CSV once from **Admin Portal → Master Data**. The import upserts by BP Number and fills these fields from the source headers.

## Farmer source headers supported
- Bp Number / BP Number
- Farmer Name
- Name in BPM
- Farm Name
- Core area - Plot rea (Area under rejuvenation)
- phone number
- Cluster, Team, Day, Lat, Long and other existing fields

The area field is kept as one field exactly as supplied; negative values are not altered.

## Visit completion
- Clear `Complete` button on each farmer card
- Completed cards change appearance
- Completion timestamp is stored
- Reopen button removes completion
- Completion date filter supports Today and custom From/To dates

## Admin
- Admin can switch between Admin Portal and Enumerator Portal.
- Enumerators do not see the Admin Portal switch.
- Master data import/cluster import/cluster clear/report export are admin-only.
- Admin Overview has Download Report.

## Development
Backend: `cd backend && npm install && npm start`
Frontend: `cd frontend && npm install && npm run dev`


## Latest targeted fix — BP + fast completion + refresh
- Open Map farmer popup now includes **BP Number**.
- Complete/Reopen updates the visible Farmers card immediately, then reconciles with the server in the background.
- Completion audit logging no longer delays the completion response.
- Frontend builds route entry files so refreshing React routes on the Render static site does not return `Not Found`.
- No other workflow or map/filter/admin behavior was intentionally changed.

## Offline / low-network field mode
- Added IndexedDB-backed offline farmer snapshot and API response cache.
- Full farmer data is prepared in the background after a successful sign-in while online.
- Farmer filtering works from the saved snapshot when offline.
- Complete/Reopen actions queue locally when offline and synchronize automatically when connectivity returns.
- Open Map data remains available offline from the cached snapshot.
- Service worker caches the application shell and OpenStreetMap tiles as they are viewed.
- Offline refresh/deep links fall back to the cached application shell.
- No field navigation or existing workflow was removed or changed.
