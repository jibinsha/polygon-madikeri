# Polygon Project : Madikeri — Admin + Enumerator

This build uses one persistent Supabase database with two role-based interfaces.

## Roles

### Admin
- Admin Portal
- Master farmer data import/update
- Cluster_Map.html import/update
- User management
- Enumerator monitoring
- Login/activity audit log
- Trader / cluster / team progress
- All existing field pages

### Enumerator
- Dashboard
- Cluster Map
- Farmers
- Traders
- Field Planner
- Reports
- Complete visits and add remarks
- No Data Manager
- No user management
- No audit log
- Import endpoints are server-side admin protected

## Admin email

The backend allowlist defaults to `jibinsha45@gmail.com` and can also be configured with `ADMIN_EMAILS` (comma-separated). The first login from this configured email is automatically assigned the `admin` role.

You still need to create the actual Auth account/password in Supabase Authentication, or have an existing account for this email. Never hard-code the password in the project.

## Supabase setup

1. Open Supabase SQL Editor.
2. Run `supabase/schema.sql`.
3. Keep the backend service-role key only in `backend/.env`; never expose it in Vite/frontend variables.
4. In Supabase Authentication → Users, create the administrator account for `jibinsha45@gmail.com` with a password.
5. Admin can then create enumerator accounts from **Admin Portal → Users**.

### Backend `.env`

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
FRONTEND_ORIGIN=http://localhost:5173
PORT=8787
ADMIN_EMAILS=jibinsha45@gmail.com
```

### Frontend `.env`

```env
VITE_API_BASE_URL=http://localhost:8787
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

The anon key is used only for Supabase Auth in the browser. The service-role key stays on the backend.

## Run locally

### Backend

```powershell
cd backend
npm install
npm start
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Data persistence

Farmer data is stored in `public.farmers`. Completion status is stored in `public.completed_farmers`. Cluster map points are stored in `public.cluster_points`. Data remains available until an administrator changes it. Re-importing a CSV upserts by BP number, so updated records can be loaded without re-importing for every enumerator.

## Audit

The backend records login, logout, visit completion/reopening, farmer dataset imports, cluster map imports/clears, and admin user changes in `public.audit_logs`. The Admin Portal displays the latest activity.

## 1167+ farmers

Supabase/PostgREST can cap individual responses at 1000 rows. The backend therefore fetches farmers, completed records and cluster points in batches, so 1167 or more farmer records are supported.

## Security

- All application API routes require a valid Supabase Auth bearer token.
- Admin endpoints require the `admin` role.
- Import/delete operations are admin-only.
- Disabled profiles are rejected by the backend.
- Service-role credentials are never sent to the browser.
