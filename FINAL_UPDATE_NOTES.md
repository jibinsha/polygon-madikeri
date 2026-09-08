# Final mobile/data update

## Mobile UI
The frontend now has a mobile-first responsive layer:
- touch-friendly controls (minimum tap targets)
- no horizontal page overflow
- compact farmer cards
- two-column farmer details on phones
- phone/maps actions in two columns
- full-width Complete/Reopen action
- compact filters and completion-date controls
- responsive dashboard, trader progress and map
- responsive admin/data pages
- safe-area padding for modern phones
- mobile sidebar drawer and simplified top bar

## Master data
The supplied `Final_Field_Plan.csv` contains 1,999 rows and these important source headers:
- Bp Number
- Farmer Name
- Name in BPM
- Farm Name
- Core area - Plot rea (Area under rejuvenation
- Lat
- Long
- phone number
- Cluster
- Day
- Team

The app importer maps these fields to:
- `name_in_bpm`
- `farm_name`
- `area_under_rejuvenation`

The supplied CSV is included at `frontend/public/Final_Field_Plan.csv` and can be downloaded from Admin > Master Data.

If existing database records still show `—` for BPM/Farm/Area, import this supplied CSV once from Admin > Master Data. The import is an upsert by BP Number, so existing BP records are updated and new records are added; records are not deleted.

The current supplied CSV has 1,999 records, while an older database snapshot may contain 1,166 records. Importing the supplied CSV will reconcile the master records by BP number.

## Validation
Backend `server.js` passes `node --check`. A full Vite production build was not run in this environment because the package registry/dependencies are not available offline. On the development machine, run `npm install` in `frontend` and `backend`, then `npm run dev` / `npm start`.
