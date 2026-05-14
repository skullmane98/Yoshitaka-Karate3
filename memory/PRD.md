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
- **Auth**: JWT custom auth + (optional) Google OAuth (currently disabled on Login UI)

## Roles (hierarchy, highest → lowest)
super_admin → admin → renshi → sensei → team_member → student

## Implemented (✅)
- MongoDB → MySQL migration + Render deploy
- 18-level belt system & path UI
- 6 hierarchical roles + granular permission table
- CMS page editor (Home, About, Programs, Schedule, Contact, ID Card)
- Horizontal certificate-style ID card with QR + Barcode + PDF export
- Blog (rich text, images)
- Notifications (in-app bell + admin compose)
- Payment Calendar + invoice ledger + email reminders
- Removed Enroll page; Google OAuth disabled on Login (username/email + password only)
- **[2026-02-14] Manual User Management UI**: `AddUserModal` + `UserDrawer`
  wired into Admin/Super Admin "Users" tab
    - Admin can add users manually with full PII (DOB, address, emergency contact, medical notes, photo)
    - Per-user ID Card customization: pick template (Student / Team Class / Sensei) + override
      labels, kanji, accent color, etc. Live preview in drawer.
    - Reset user password via Security tab
    - Tested end-to-end (curl POST/PATCH/DELETE confirmed all new fields persist)

## Backlog
### P1
- 📸 **OCR auto-fill**: Admin uploads image of ID/registration form → AI extracts fields →
  pre-fills `AddUserModal` (allow manual edit before save). User opted to defer integration
  selection — revisit choice of Gemini 3 / GPT-4o / Claude Sonnet 4.5.
- 📱 **QR scan attendance flow** UI polish (backend `/api/scan` already works)

### P2
- Stripe online tuition payments
- Bulk monthly invoice generation
- Microsoft OAuth (currently scaffolded, not active)

## Key Files
- `/app/backend/server.py` — auth, user CRUD (manual create), QR, payments, CMS
- `/app/backend/features.py` — blog, notifications, permissions
- `/app/backend/db.py` — SQLAlchemy NullPool config (DO NOT change)
- `/app/backend/models.py` — User model with PII + `idcard_template` + `idcard_overrides`
- `/app/frontend/src/pages/dashboard/AdminDashboard.jsx` — Admin/SuperAdmin shell
- `/app/frontend/src/components/UserDrawer.jsx` — 4-tab user editor
- `/app/frontend/src/components/AddUserModal.jsx` — manual create
- `/app/frontend/src/components/IDCard.jsx` — certificate component (uses overrides)
- `/app/frontend/src/lib/idcardTemplates.js` — Student / Team Class / Sensei templates

## Critical Operational Notes
- MySQL connections drop after idle; **NullPool is required** in `db.py`
- All backend routes prefixed `/api`
- Use `REACT_APP_BACKEND_URL` from `frontend/.env`
- Test credentials in `/app/memory/test_credentials.md`
