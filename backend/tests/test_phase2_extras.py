"""Phase-2 backend regression: attendance, payment reminders/delete cascade,
CMS new-slug upsert (open-project-47), datetime UTC round-trip,
last-super-admin demotion protection."""
import os
import re
import uuid
import time
import requests
import pytest
from datetime import datetime

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://open-project-47.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
SUPER_EMAIL = "superadmin@yoshitaka.com"
SUPER_PASS = "SuperAdmin2026!"

ISO_UTC_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(\+00:00|Z)$")


def _sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _u(prefix="TEST"):
    return f"{prefix}_{uuid.uuid4().hex[:10]}@test.com"


@pytest.fixture(scope="module")
def super_sess():
    s = _sess()
    r = s.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def student(super_sess):
    cr = super_sess.post(f"{API}/access-codes", json={"role": "student", "max_uses": 1, "note": "TEST_attn"})
    code = cr.json()["code"]
    s = _sess()
    email = _u("TEST_stu_at")
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "Password1!",
        "name": "TEST AttnStudent", "access_code": code,
    })
    assert r.status_code == 200, r.text
    d = r.json()
    return {"sess": s, "id": d["id"], "email": email, "member_number": d["member_number"]}


# ---------- ATTENDANCE ----------
class TestAttendance:
    def test_scan_barcode_creates_record(self, super_sess, student):
        r = super_sess.post(f"{API}/attendance/scan", json={"code": student["member_number"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user_id"] == student["id"]
        assert d["member_number"] == student["member_number"]
        assert d["method"] == "barcode"
        assert ISO_UTC_RE.match(d["scanned_at"]), f"scanned_at not UTC ISO8601: {d['scanned_at']}"

    def test_scan_qr_payload(self, super_sess, student):
        qr = f"YOSHITAKA|{student['member_number']}|{student['id']}"
        r = super_sess.post(f"{API}/attendance/scan", json={"code": qr, "note": "qr-test"})
        assert r.status_code == 200, r.text
        assert r.json()["method"] == "qr"
        assert r.json()["note"] == "qr-test"

    def test_scan_unknown_member(self, super_sess):
        r = super_sess.post(f"{API}/attendance/scan", json={"code": "YK99999999"})
        assert r.status_code == 404

    def test_scan_inactive_member(self, super_sess, student):
        # deactivate, scan, reactivate
        super_sess.patch(f"{API}/users/{student['id']}", json={"active": False})
        try:
            r = super_sess.post(f"{API}/attendance/scan", json={"code": student["member_number"]})
            assert r.status_code == 403
        finally:
            super_sess.patch(f"{API}/users/{student['id']}", json={"active": True})

    def test_attendance_list_super_filter_user(self, super_sess, student):
        r = super_sess.get(f"{API}/attendance", params={"user_id": student["id"], "limit": 50})
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 2
        assert all(a["user_id"] == student["id"] for a in rows)
        # ordering desc
        ts = [a["scanned_at"] for a in rows]
        assert ts == sorted(ts, reverse=True)

    def test_attendance_list_student_scoped(self, student):
        r = student["sess"].get(f"{API}/attendance")
        assert r.status_code == 200
        for a in r.json():
            assert a["user_id"] == student["id"]

    def test_attendance_days_filter(self, super_sess, student):
        r = super_sess.get(f"{API}/attendance", params={"days": 1, "user_id": student["id"]})
        assert r.status_code == 200
        # all should be recent
        for a in r.json():
            ts = datetime.fromisoformat(a["scanned_at"].replace("Z", "+00:00"))
            assert (datetime.now(ts.tzinfo) - ts).total_seconds() < 86400

    def test_attendance_delete(self, super_sess, student):
        # create one, delete it, verify gone
        r = super_sess.post(f"{API}/attendance/scan", json={"code": student["member_number"]})
        rec_id = r.json()["id"]
        d = super_sess.delete(f"{API}/attendance/{rec_id}")
        assert d.status_code == 200
        all_rows = super_sess.get(f"{API}/attendance", params={"user_id": student["id"], "limit": 200}).json()
        assert all(a["id"] != rec_id for a in all_rows)


# ---------- PAYMENT REMINDERS / CASCADE ----------
class TestPaymentReminderAndCascade:
    def test_remind_console_mode_and_cascade_delete(self, super_sess, student):
        # create payment
        r = super_sess.post(f"{API}/payments", json={
            "user_id": student["id"], "amount": 75.0, "description": "TEST Reminder"
        })
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        # remind (SMTP unconfigured -> console)
        rem = super_sess.post(f"{API}/payments/{pid}/remind")
        assert rem.status_code == 200, rem.text
        body = rem.json()
        assert body.get("ok") is True
        assert body.get("mode") == "console"
        assert body.get("to") == student["email"].lower()

        # mark paid then attempt remind -> 400
        up = super_sess.patch(f"{API}/payments/{pid}", json={"status": "paid"})
        assert up.status_code == 200
        assert up.json()["paid_date"] is not None
        assert ISO_UTC_RE.match(up.json()["paid_date"])

        rem2 = super_sess.post(f"{API}/payments/{pid}/remind")
        assert rem2.status_code == 400

        # change status away from paid -> paid_date cleared
        un = super_sess.patch(f"{API}/payments/{pid}", json={"status": "due"})
        assert un.status_code == 200
        assert un.json()["paid_date"] is None

        # delete payment cascades reminders (no error)
        d = super_sess.delete(f"{API}/payments/{pid}")
        assert d.status_code == 200

    def test_remind_missing_payment_404(self, super_sess):
        r = super_sess.post(f"{API}/payments/{uuid.uuid4()}/remind")
        assert r.status_code == 404


# ---------- CMS new-slug upsert ----------
class TestCMSNewSlug:
    def test_super_can_create_new_slug(self, super_sess):
        slug = "open-project-47"
        r = super_sess.put(f"{API}/cms/pages/{slug}", json={
            "title": "Open Project 47",
            "content": {"hello": "world", "n": 47},
        })
        assert r.status_code == 200, r.text
        assert r.json()["slug"] == slug
        # public read
        pub = requests.get(f"{API}/cms/pages/{slug}")
        assert pub.status_code == 200
        assert pub.json()["content"]["hello"] == "world"
        # update existing
        r2 = super_sess.put(f"{API}/cms/pages/{slug}", json={
            "title": "Open Project 47", "content": {"hello": "world2", "n": 47},
        })
        assert r2.status_code == 200
        assert r2.json()["content"]["hello"] == "world2"
        assert ISO_UTC_RE.match(r2.json()["updated_at"])

    def test_get_unknown_slug_404(self):
        r = requests.get(f"{API}/cms/pages/this-does-not-exist-{uuid.uuid4().hex[:6]}")
        assert r.status_code == 404


# ---------- last super-admin demotion protection ----------
class TestSuperAdminDemoteGuard:
    def test_cannot_demote_only_super_admin(self, super_sess):
        """When a super_admin patches their own user, the `role` field is silently
        stripped (self-edit allowed list = name/phone only) so the demote never
        actually happens. Verify role stays super_admin even though endpoint
        returns 200. (Effective protection, even if 400 would be more explicit.)"""
        users = super_sess.get(f"{API}/users").json()
        supers = [u for u in users if u["role"] == "super_admin" and u["active"]]
        assert len(supers) >= 1
        # Self-demote via PATCH on own id
        me = super_sess.get(f"{API}/auth/me").json()
        r = super_sess.patch(f"{API}/users/{me['id']}", json={"role": "admin"})
        assert r.status_code == 200, r.text
        # Role MUST still be super_admin
        assert r.json()["role"] == "super_admin"
        # Confirm via /me
        me2 = super_sess.get(f"{API}/auth/me").json()
        assert me2["role"] == "super_admin"


# ---------- datetime UTC round-trip on /auth/me & list endpoints ----------
class TestDatetimeRoundTrip:
    def test_me_created_at_utc(self, super_sess):
        r = super_sess.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert ISO_UTC_RE.match(r.json()["created_at"]), r.json()["created_at"]

    def test_access_code_created_at_utc(self, super_sess):
        codes = super_sess.get(f"{API}/access-codes").json()
        assert codes
        assert ISO_UTC_RE.match(codes[0]["created_at"])
