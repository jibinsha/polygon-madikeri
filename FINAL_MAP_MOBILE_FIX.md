# Final Map + Mobile Fix

This version is based on the uploaded current project.

## Map reliability
- Leaflet maps now invalidate their size after mount, resize, and responsive layout changes.
- Dashboard map falls back to cluster GPS points if farmer GPS is not yet populated.
- Cluster selection is a MAP FOCUS/ZOOM only; it does not remove other clusters.
- On mobile, the Cluster Map uses a stacked layout: cluster list first, full-width map below.
- Team Location and Dashboard maps have protected mobile heights.

## Farmer data
The supplied `Final_Field_Plan.csv` is included. Its actual fields include:
- Farmer Name
- Name in BPM
- Farm Name
- Core area - Plot rea (Area under rejuvenation
- phone number
- Lat / Long
- Cluster / Day / Team

If existing Supabase farmer rows still show `—`, run the Admin > Master Data CSV import once to update those existing BP records.

## Validation
- All JSX files transpile successfully with the installed TypeScript parser.
- Backend `server.js` passes `node --check`.
- No secrets or node_modules are included in the ZIP.
