# Yoshitaka Karate-Do CMS — PRD

## Original Problem Statement
> recreate a cms website from this website: https://www.yoshitakakaratedo.com.
> Create 3 types of accounts: 1 login for admins, 2 login for students, 3 super admin.
> Each time a user is created there should be a QR code and barcode created.
> Users are able to create their account with an access code provided by the admin or super admin.
> The admin should be able to change the students basic settings.
> Super admins will have access to change accounts of admins and students.
> Create a dashboard for each type of account.
> For each account user should be able to see payments due and accounts.

## User Personas
- **Student** — martial arts practitioner; self-service profile, QR/barcode ID card, payment history, class schedule.
- **Admin** (sensei / staff) — manages student roster, generates student access codes, records payments.
- **Super Admin** — owns the dojo platform; manages admins + students, issues admin codes, edits CMS pages, views global stats.

## Core Requirements (Static)
1. 3 roles: `super_admin`, `admin`, `student`
2. Registration gated by single-use (or multi-use) access codes
3. QR code + Code128 barcode per user, tied to a member number
4. Role-based dashboards
5. Payments due + payment ledger per account
6. Admin edits student basic settings; super admin edits any account
7. Editable CMS pages for public-facing marketing content
8. Japanese dojo aesthetic (Shotokan heritage) — rice-paper warmth, hinomaru red accent, traditional serif typography

## Architecture
- **Backend**: FastAPI + Motor (MongoDB). JWT httpOnly cookie auth. bcrypt password hashing. qrcode + python-barcode libraries for asset generation. UUID string IDs.
- **Frontend**: React 19 + React Router v7. Custom Tailwind theme (Cormorant Garamond / Outfit / Space Mono / Shippori Mincho). Framer Motion for page intros. Sonner for toasts. Sharp-cornered component style.
- **Storage**: `users`, `access_codes`, `payments`, `cms_pages` collections with UUID `id` keys and excluded `_id` in all reads.

## Implemented — 2026-05-01
- Backend: complete auth (register/login/logout/me), full role-aware CRUD for users, access codes (create/list/deactivate), payments (create/list/update/delete/status transitions), CMS pages (get/list/put), QR+barcode generation endpoint, dashboard stats, super-admin + starter access codes seeding on startup.
- Frontend: public marketing site (Home with hero+pillars+CTA, About/Sensei, Programs, Schedule, News, Contact), Login + Register (access-code gated), Student Dashboard (ID Card + Payments + Schedule), Admin Dashboard (tabs: overview/students/codes/payments), Super Admin Dashboard (tabs: overview/users/codes/payments/CMS with JSON editor), reusable Navbar/Footer, role-gated ProtectedRoute.
- Testing: 34/34 backend pytest passing; key frontend flows (login, register, dashboard routing, CMS edit, ID card QR+barcode) verified via testing subagent.

## P0 / P1 / P2 Backlog
### P0 (future)
- Email-based password reset flow (forgot/reset endpoints scaffolded in playbook but not wired)
- Print-friendly ID card (PDF export) for physical membership cards

### P1
- Stripe online payment option on each due invoice (playbook available)
- Emergent Google OAuth as alternative login method
- Rich text WYSIWYG CMS editor (currently raw JSON)
- Event RSVP / attendance tracking with QR scan
- Bulk invoice creation (monthly tuition run for all active students)

### P2
- Belt test scheduling + result recording
- Photo galleries per news post
- SMS reminders (Twilio) for payment due dates
- Multi-dojo support (franchise mode)

## Test Credentials
See `/app/memory/test_credentials.md`.
