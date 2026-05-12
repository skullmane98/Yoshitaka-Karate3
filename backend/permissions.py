"""Permission system for Yoshitaka Karate-Do CMS.

Six-tier hierarchy (highest privilege first):
  super_admin > admin > renshi > sensei > team_member > student

Permissions are STRINGS. Each role has a default set of permissions, but Super
Admin can override the role's permission set (stored in `role_permissions`
table) and override individual users via `user_permission_overrides`.

Resolution order in `has_permission`:
  1. user-specific override (if present)
  2. role-level config from DB (if customized)
  3. ROLE_DEFAULTS fallback (this file)
"""
from typing import Set

# -----------------------------------------------------------------------------
# Role hierarchy (top-down). Index = privilege depth.
# -----------------------------------------------------------------------------
ROLE_HIERARCHY = [
    "super_admin",
    "admin",
    "renshi",
    "sensei",
    "team_member",
    "student",
]
VALID_ROLES = set(ROLE_HIERARCHY)
STAFF_ROLES = {"super_admin", "admin", "renshi", "sensei", "team_member"}
ADMIN_LEVEL_ROLES = {"super_admin", "admin"}


def role_rank(role: str) -> int:
    """Lower number = higher privilege. Unknown roles get max int."""
    try:
        return ROLE_HIERARCHY.index(role)
    except ValueError:
        return 99


def role_is_at_least(role: str, minimum: str) -> bool:
    return role_rank(role) <= role_rank(minimum)


# -----------------------------------------------------------------------------
# Permission catalog (canonical list — the only keys allowed)
# -----------------------------------------------------------------------------
PERMISSIONS = [
    # users
    ("users.view_all",        "View all users (not just students)"),
    ("users.create",          "Create users (via access codes)"),
    ("users.edit_students",   "Edit student profiles"),
    ("users.edit_staff",      "Edit staff profiles (instructors, admin)"),
    ("users.change_role",     "Change user roles"),
    ("users.delete",          "Delete users"),
    ("users.reset_password",  "Reset another user's password"),
    # access codes
    ("codes.create_student",  "Mint student access codes"),
    ("codes.create_staff",    "Mint staff access codes (sensei/renshi/team)"),
    ("codes.create_admin",    "Mint admin/super_admin access codes"),
    ("codes.view",            "View access codes"),
    ("codes.deactivate",      "Deactivate access codes"),
    # payments
    ("payments.view_all",     "View all payments"),
    ("payments.create",       "Create payments / invoices"),
    ("payments.edit",         "Edit / mark paid / delete payments"),
    ("payments.send_reminder","Send payment reminder emails"),
    # attendance
    ("attendance.scan",       "Scan attendance via QR/barcode"),
    ("attendance.view_all",   "View attendance records (everyone)"),
    ("attendance.delete",     "Delete attendance records"),
    # CMS
    ("cms.edit_public",       "Edit public pages (home, about, programs, etc.)"),
    ("cms.edit_idcard",       "Edit ID card design"),
    # notifications & blog
    ("notifications.send",    "Send notifications to users"),
    ("blog.write",            "Create / edit / delete blog posts"),
    # system
    ("permissions.manage",    "Manage roles and permissions"),
]
PERMISSION_KEYS: Set[str] = {p for p, _ in PERMISSIONS}


# -----------------------------------------------------------------------------
# Default permissions per role
# -----------------------------------------------------------------------------
ROLE_DEFAULTS = {
    "super_admin": PERMISSION_KEYS,  # everything
    "admin": {
        "users.view_all", "users.create", "users.edit_students", "users.reset_password",
        "codes.create_student", "codes.create_staff", "codes.view", "codes.deactivate",
        "payments.view_all", "payments.create", "payments.edit", "payments.send_reminder",
        "attendance.scan", "attendance.view_all", "attendance.delete",
        "cms.edit_public", "cms.edit_idcard",
        "notifications.send", "blog.write",
    },
    "renshi": {
        "users.edit_students",
        "codes.create_student",
        "attendance.scan", "attendance.view_all",
        "payments.send_reminder",
        "blog.write",
    },
    "sensei": {
        "attendance.scan", "attendance.view_all",
        "codes.create_student",
    },
    "team_member": {
        "attendance.scan",
    },
    "student": set(),
}
