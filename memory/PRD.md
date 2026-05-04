# Yoshitaka Karate-Do CMS — PRD

## Original Problem Statement
Custom CMS for a Shotokan karate dojo (`yoshitakakaratedo.com`). Three role-based
dashboards (super admin / admin / student), access-code gated registration,
payments ledger, attendance via USB barcode/QR scanner, and an authorable CMS for
the public marketing pages.

## User Personas
- **Super Admin (Sensei/Owner)** — full control: users, admins, access codes,
  payments, attendance, CMS content, role management.
- **Admin (Senior Instructor)** — manages students only: create student access
  codes, bill students, scan attendance.
- **Student** — views own member certificate (QR + barcode), payments, attendance.

## Core Tech Stack (current)
- **Frontend**: React 19 + Tailwind + Context API. Hosted as static build on
  Hostinger Business.
- **Backend**: FastAPI + SQLModel (SQLAlchemy 2 async) + aiomysql. JWT Bearer
  auth, httpOnly cookie fallback. Intended prod host: **Render** (free tier).
- **Database**: **MySQL / MariaDB** (migrated from MongoDB on 2026-05-04).
  Dev uses local MariaDB 10.11. Prod target: Hostinger Business MySQL via
  `DATABASE_URL` env var.

## Implemented So Far
- Full auth: register w/ access code, login, logout, forgot/reset password.
- Role-scoped user CRUD; super admin can promote/demote; last-super-admin guard.
- Access code issuance, listing, deactivation (role-scoped).
- Payments ledger: create, list, mark paid/due/overdue, delete, email reminder
  (console fallback when SMTP env vars are unset).
- Attendance: scan via QR payload `YOSHITAKA|MEMBER|UUID` or bare barcode
  `YKxxxxxxxx`; list with `days`/`limit`/`user_id` filters.
- CMS pages: public read, super-admin upsert for home/about/programs/schedule/
  news/contact.
- Member Certificate: QR + Code128 barcode PNG generation per user.
- Dashboard stats endpoint (`/api/stats`).
- Dark-mode visibility fixes on Navbar and Home hero (prior session).

## Implemented on 2026-05-04 (this session)
- **MongoDB → MySQL migration (P0, complete)**. Rewrote server.py against
  SQLModel async. Added `db.py` (engine + session) and `models.py`
  (User, AccessCode, Payment, PaymentReminder, Attendance, CMSPage,
  PasswordResetToken). Removed `motor` + `pymongo` from requirements.txt,
  added `sqlmodel`, `SQLAlchemy`, `aiomysql`, `pymysql`, `greenlet`.
- **Dev DB**: MariaDB 10.11 installed locally in the container; `yoshitaka`
  user + `yoshitaka_karatedo` database created. Seed on startup.
- **Cleanup**: removed obsolete `railway.json`, `DEPLOY_HYBRID.md`.
- **Testing**: backend testing agent reports 57/57 pass on the new MySQL API
  (see `/app/test_reports/iteration_5.json`). No critical issues.

## Roadmap / Backlog
### P0
- Deploy FastAPI backend to **Render** + point `DATABASE_URL` to Hostinger MySQL
  (user to enable remote MySQL access in Hostinger panel + whitelist Render's IP).
- Build frontend `yarn build` → upload `/build/` to Hostinger Business static
  hosting; set `REACT_APP_BACKEND_URL` to the Render URL at build time.

### P1
- **Stripe** online payments so students can self-pay outstanding invoices.
- **Rich-text WYSIWYG** CMS editor (replace the current JSON editor).
- **Emergent Google OAuth** as alternate login.
- **Alembic migrations** (current `init_db` uses `create_all` which does not
  update existing columns).
- Split `server.py` (currently ~1020 lines) into routers
  (`auth.py`, `users.py`, `access_codes.py`, `payments.py`, `attendance.py`,
  `cms.py`) + modules for email helper, default pages, seed logic.

### P2
- Bulk invoice creation (monthly tuition run across all active students).
- Event RSVP + check-in (QR scan per event).
- ON DELETE CASCADE FKs on Payment / PaymentReminder / Attendance /
  PasswordResetToken so delete_user no longer needs manual cleanup.
- Replace `_strip_tz` / `_as_utc` pair with a SQLAlchemy TypeDecorator.
- N+1 fix: `_payment_to_public` currently does one SELECT per payment for
  `user_name`; replace with a single LEFT JOIN or id→name in-memory map.
- Env flag `COOKIE_SECURE` so non-HTTPS environments can test auth.

## Key API Endpoints
```
POST   /api/auth/register          payload: {email, password, name, access_code}
POST   /api/auth/login             payload: {email, password}
POST   /api/auth/logout
POST   /api/auth/forgot-password   payload: {email}
POST   /api/auth/reset-password    payload: {token, new_password}
GET    /api/auth/me
GET    /api/users
GET    /api/users/{id}
PATCH  /api/users/{id}             payload: {name?, phone?, belt_rank?, active?, email?, role?}
POST   /api/users/{id}/password    payload: {new_password}
DELETE /api/users/{id}
GET    /api/users/{id}/qrcode
POST   /api/access-codes           payload: {role, max_uses, note}
GET    /api/access-codes
DELETE /api/access-codes/{id}
POST   /api/payments               payload: {user_id, amount, description, due_date?, status}
GET    /api/payments               query:   ?user_id=...
PATCH  /api/payments/{id}          payload: {status?, amount?, description?, due_date?}
DELETE /api/payments/{id}
POST   /api/payments/{id}/remind
POST   /api/attendance/scan        payload: {code, note?}
GET    /api/attendance             query:   ?user_id=&days=&limit=
DELETE /api/attendance/{id}
GET    /api/cms/pages
GET    /api/cms/pages/{slug}
PUT    /api/cms/pages/{slug}       payload: {title, content}
GET    /api/stats
```

## Data Model (MySQL tables)
- `users` — id (UUID PK, varchar 36), email (unique), password_hash, name,
  role, phone, belt_rank, member_number (unique), active, registered_with_code,
  created_at
- `access_codes` — id PK, code (unique), role, max_uses, used_count, note,
  created_by, active, created_at
- `payments` — id PK, user_id, amount, description, due_date, paid_date, status,
  created_by, last_reminder_at, created_at
- `payment_reminders` — id PK, payment_id, sent_at, sent_by, to_email, mode, ok
- `attendance` — id PK, user_id (idx), user_name, member_number, role, belt_rank,
  scanned_at (idx), method, note, scanned_by
- `cms_pages` — slug PK, title, content (JSON), updated_at
- `password_reset_tokens` — token PK, user_id (idx), email, expires_at, used,
  used_at, created_at

## Credentials (dev)
- Super Admin: `superadmin@yoshitaka.com` / `SuperAdmin2026!`
- Seed-time access codes are printed to backend logs at first startup.
  Current session (see `/app/memory/test_credentials.md`):
  admin `FEPA-JCKU`, student `3C5N-Y68A`.

## Deployment Plan (ratified with user, 2026-05-04)
1. **Frontend** — static React build on Hostinger Business.
2. **Backend** — FastAPI on **Render** (free tier). Build command:
   `pip install -r backend/requirements.txt`. Start command:
   `uvicorn server:app --host 0.0.0.0 --port $PORT` (from `/app/backend`).
3. **Database** — Hostinger Business MySQL, remote access enabled for
   Render IPs. Set `DATABASE_URL=mysql+aiomysql://USER:PASS@HOST:3306/DBNAME`
   in Render.
4. **Railway** — permanently off the table.
