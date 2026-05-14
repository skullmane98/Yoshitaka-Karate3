# Yoshitaka Karate Dojo — Custom CMS

## Original Problem Statement
Build a custom CMS for a Shotokan karate dojo with role-based dashboards, an 18-level belt
ranking path, payments ledger, attendance tracking, blog, notifications, and per-user
digital ID cards. Backend deployed to Render; database on Hostinger MySQL; frontend
static build served by Hostinger.

## Architecture
- **Frontend**: React 19 + Tailwind + shadcn (build → Hostinger)
- **Backend**: FastAPI + SQLAlchemy/SQLModel + aiomysql (Render)
- **DB**: MySQL on Hostinger (uses `NullPool` to avoid idle-drop crashes — DO NOT pool)
- **Auth**: JWT custom auth. Login accepts **email, username, OR member_number**.

## Roles (hierarchy, highest → lowest)
super_admin → admin → renshi → sensei → team_member → student

## Implemented (✅)
- MongoDB → MySQL migration + Render deploy
- 18-level belt system & path UI
- 6 hierarchical roles + granular permission table
- CMS page editor (Home, About, Programs, Schedule, Contact, ID Card)
- Horizontal certificate-style ID card with QR + Logo + PDF export
- Blog (rich text, images)
- Notifications (in-app bell + admin compose)
- Payment Calendar + invoice ledger + email reminders
- Removed Enroll page; Google OAuth disabled on Login (username/email + password only)
- Manual User Management UI: `AddUserModal` + `UserDrawer` wired into Admin/Super Admin "Users" tab
- Hostinger CI build green (`react-hooks/exhaustive-deps` exempted in IDCard.jsx)
- **[2026-02-14] Username login + per-user QR + ID card polish**
  - `users.username` (unique) and `users.qr_code` (unique, opaque `YK-QR-…`) columns added
    (idempotent ALTER TABLE migration in `db.py`)
  - Login resolver accepts email, username, or member_number
  - `AddUserModal` collects optional username
  - `UserDrawer` exposes username field + QR section with **Regenerate QR** button
  - QR code rendered in **red** (`#D7263D`) by server using `qrcode.QRCode` with `fill_color`
  - Barcode removed from ID card display + API response
  - Per-user **background image** override (admin/super_admin only) in `UserDrawer`
    → stacks as faded watermark on the certificate (`background_url` in `idcard_overrides`)
  - Attendance scan now accepts both new `YK-QR-…` and legacy `YOSHITAKA|…` formats
- **[2026-02-14] Blog tab for all users**
  - `BlogReader` component (read-only) embedded in `StudentDashboard` via tabs
  - Lists published posts + inline post viewer; no public-page navigation required

## Backlog
### P1
- 📸 OCR auto-fill in Add User (pick: Gemini 3 / GPT-4o / Claude Sonnet 4.5)
- 📱 QR scan attendance UX polish (mobile camera flow)

### P2
- Stripe online tuition payments
- Bulk monthly invoice generation
- Microsoft OAuth (scaffolded, inactive)

## Key Files
- `/app/backend/server.py` — auth (multi-identity login), user CRUD, QR (red) + regenerate, payments, CMS
- `/app/backend/features.py` — blog, notifications, permissions
- `/app/backend/db.py` — NullPool config + per-column ALTER TABLE migration
- `/app/backend/models.py` — User model with `username`, `qr_code`, PII, `idcard_overrides`
- `/app/frontend/src/pages/dashboard/AdminDashboard.jsx` — Admin/SuperAdmin shell
- `/app/frontend/src/pages/dashboard/StudentDashboard.jsx` — tabs: Overview + Blog
- `/app/frontend/src/components/UserDrawer.jsx` — username + QR regen + background override
- `/app/frontend/src/components/AddUserModal.jsx` — manual create w/ username
- `/app/frontend/src/components/IDCard.jsx` — certificate component (no barcode)
- `/app/frontend/src/components/BlogReader.jsx` — embedded read-only blog viewer
- `/app/frontend/src/lib/idcardTemplates.js` — Student / Team Class / Sensei templates

## Critical Operational Notes
- MySQL connections drop after idle; **NullPool is required** in `db.py`
- Hostinger auto-build runs `CI=true` — keep ESLint warnings at zero
- All backend routes prefixed `/api`
- Use `REACT_APP_BACKEND_URL` from `frontend/.env`
- Test credentials in `/app/memory/test_credentials.md`
