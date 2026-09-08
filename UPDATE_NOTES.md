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
