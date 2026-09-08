# FIRST-TIME ADMIN SETUP

## 1. Supabase SQL
Run `supabase/schema.sql` in the Supabase SQL Editor. This adds `profiles`, `audit_logs` and the completion actor fields.

## 2. Supabase Auth
In Supabase Dashboard → Authentication → Users, create/confirm the administrator account:

`jibinsha45@gmail.com`

Set a password that only the administrator knows. The application does not contain or store this password.

The backend allowlist defaults to this email. You can add more admin emails with `ADMIN_EMAILS` in `backend/.env`.

For production, disable public sign-ups in Supabase Auth so only accounts created/invited by administrators can enter the system. Supabase supports password-based email authentication and server-side admin user creation.

## 3. Frontend environment
Copy `frontend/.env.example` to `frontend/.env` and add your Supabase project URL and publishable/anon key.

## 4. Backend environment
Copy `backend/.env.example` to `backend/.env` and add the Supabase service-role/secret key. Never put that key in frontend variables.

## 5. Install and run

### Terminal 1
```powershell
cd backend
npm install
npm start
```

### Terminal 2
```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## 6. Admin workflow
1. Sign in as `jibinsha45@gmail.com`.
2. Open **Admin Portal → Users**.
3. Create enumerator accounts.
4. Enumerators sign in with their own accounts.
5. Import the 1167+ farmer CSV only from **Admin Portal → Master Data**.
6. Import `Cluster_Map.html` only from the same admin page.
7. Use **Activity Log** to monitor logins, visit completions, imports, and user changes.

## 7. Persistence
The master dataset stays in Supabase until an administrator changes it. Enumerators never need to import the data.
