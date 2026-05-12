"""Features router: permissions, notifications, blog.

Imports server.get_current_user lazily inside each endpoint via a Depends shim
to avoid an import cycle (features <-> server).
"""
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from models import (
    BlogPost, Notification, RolePermission, User, UserPermissionOverride,
)
from permissions import (
    PERMISSIONS, PERMISSION_KEYS, ROLE_DEFAULTS, ROLE_HIERARCHY, VALID_ROLES,
)

features_router = APIRouter(prefix="/api", tags=["features"])


def _strip_tz(dt):
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _as_utc(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ---------------------------------------------------------------------------
# Auth dependency that delegates to server.get_current_user but tolerates
# missing tokens for public endpoints (blog list).
# ---------------------------------------------------------------------------
async def _current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> User:
    from server import get_current_user
    return await get_current_user(request, session)


async def _maybe_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Optional[User]:
    """Returns the current user if a valid token is present, else None."""
    has_token = bool(request.cookies.get("access_token")) or request.headers.get("Authorization", "").startswith("Bearer ")
    if not has_token:
        return None
    try:
        from server import get_current_user
        return await get_current_user(request, session)
    except HTTPException:
        return None


# ============================================================================
# Permission resolver
# ============================================================================
async def _user_has_permission(session: AsyncSession, user: User, key: str) -> bool:
    if not user or not user.role:
        return False
    if user.role == "super_admin":
        return True
    ovr_q = await session.execute(
        select(UserPermissionOverride).where(
            UserPermissionOverride.user_id == user.id,
            UserPermissionOverride.permission_key == key,
        )
    )
    ovr = ovr_q.scalar_one_or_none()
    if ovr is not None:
        return bool(ovr.allowed)
    rp_q = await session.execute(
        select(RolePermission).where(
            RolePermission.role == user.role,
            RolePermission.permission_key == key,
        )
    )
    rp = rp_q.scalar_one_or_none()
    if rp is not None:
        return bool(rp.allowed)
    return key in ROLE_DEFAULTS.get(user.role, set())


async def _resolve_perms_for(session: AsyncSession, user: User) -> dict:
    out = {}
    for key in PERMISSION_KEYS:
        out[key] = await _user_has_permission(session, user, key)
    return out


# ============================================================================
# Permission API
# ============================================================================
@features_router.get("/permissions/catalog")
async def permission_catalog(user: User = Depends(_current_user)):
    return {
        "permissions": [{"key": k, "description": d} for k, d in PERMISSIONS],
        "roles": list(ROLE_HIERARCHY),
    }


@features_router.get("/me/permissions")
async def me_permissions(
    user: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await _resolve_perms_for(session, user)


@features_router.get("/users/{user_id}/permissions")
async def user_permissions(
    user_id: str,
    current: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    if current.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    target_q = await session.execute(select(User).where(User.id == user_id))
    target = target_q.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    overrides_q = await session.execute(
        select(UserPermissionOverride).where(UserPermissionOverride.user_id == user_id)
    )
    overrides = {o.permission_key: o.allowed for o in overrides_q.scalars().all()}
    effective = await _resolve_perms_for(session, target)
    return {"user_id": user_id, "role": target.role, "effective": effective, "overrides": overrides}


class UserPermissionUpdate(BaseModel):
    permission_key: str
    allowed: Optional[bool] = None  # None = clear override


@features_router.put("/users/{user_id}/permissions")
async def set_user_permission(
    user_id: str,
    payload: UserPermissionUpdate,
    current: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    if current.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    if payload.permission_key not in PERMISSION_KEYS:
        raise HTTPException(status_code=400, detail="Unknown permission key")
    target_q = await session.execute(select(User).where(User.id == user_id))
    if not target_q.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")
    ex_q = await session.execute(
        select(UserPermissionOverride).where(
            UserPermissionOverride.user_id == user_id,
            UserPermissionOverride.permission_key == payload.permission_key,
        )
    )
    existing = ex_q.scalar_one_or_none()
    if payload.allowed is None:
        if existing:
            await session.delete(existing)
            await session.commit()
        return {"ok": True, "cleared": True}
    if existing:
        existing.allowed = bool(payload.allowed)
        session.add(existing)
    else:
        session.add(UserPermissionOverride(
            id=str(uuid.uuid4()), user_id=user_id,
            permission_key=payload.permission_key, allowed=bool(payload.allowed),
        ))
    await session.commit()
    return {"ok": True}


@features_router.get("/roles/{role}/permissions")
async def role_permissions(
    role: str,
    current: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    if current.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    if role not in VALID_ROLES:
        raise HTTPException(status_code=404, detail="Unknown role")
    overrides_q = await session.execute(select(RolePermission).where(RolePermission.role == role))
    overrides = {o.permission_key: o.allowed for o in overrides_q.scalars().all()}
    defaults = ROLE_DEFAULTS.get(role, set())
    effective = {}
    for key in PERMISSION_KEYS:
        if key in overrides:
            effective[key] = overrides[key]
        else:
            effective[key] = key in defaults
    return {"role": role, "effective": effective, "overrides": overrides, "defaults": list(defaults)}


class RolePermissionUpdate(BaseModel):
    permission_key: str
    allowed: Optional[bool] = None


@features_router.put("/roles/{role}/permissions")
async def set_role_permission(
    role: str,
    payload: RolePermissionUpdate,
    current: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    if current.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    if role not in VALID_ROLES:
        raise HTTPException(status_code=404, detail="Unknown role")
    if role == "super_admin":
        raise HTTPException(status_code=400, detail="Super admin permissions cannot be edited")
    if payload.permission_key not in PERMISSION_KEYS:
        raise HTTPException(status_code=400, detail="Unknown permission key")
    ex_q = await session.execute(
        select(RolePermission).where(
            RolePermission.role == role,
            RolePermission.permission_key == payload.permission_key,
        )
    )
    existing = ex_q.scalar_one_or_none()
    if payload.allowed is None:
        if existing:
            await session.delete(existing)
            await session.commit()
        return {"ok": True, "cleared": True}
    if existing:
        existing.allowed = bool(payload.allowed)
        session.add(existing)
    else:
        session.add(RolePermission(
            id=str(uuid.uuid4()), role=role,
            permission_key=payload.permission_key, allowed=bool(payload.allowed),
        ))
    await session.commit()
    return {"ok": True}


# ============================================================================
# Notifications
# ============================================================================
class NotificationCreate(BaseModel):
    title: str
    body: str
    link: Optional[str] = None
    user_id: Optional[str] = None
    role: Optional[str] = None


class NotificationPublic(BaseModel):
    id: str
    title: str
    body: str
    link: Optional[str] = None
    sender_name: str
    read: bool
    created_at: datetime


def _notif_public(n: Notification) -> NotificationPublic:
    return NotificationPublic(
        id=n.id, title=n.title, body=n.body, link=n.link,
        sender_name=n.sender_name, read=n.read, created_at=_as_utc(n.created_at),
    )


@features_router.post("/notifications", response_model=List[NotificationPublic])
async def create_notification(
    payload: NotificationCreate,
    current: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not await _user_has_permission(session, current, "notifications.send"):
        raise HTTPException(status_code=403, detail="Missing permission: notifications.send")
    if payload.user_id:
        rs_q = await session.execute(select(User).where(User.id == payload.user_id, User.active == True))  # noqa: E712
    elif payload.role:
        if payload.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Unknown role")
        rs_q = await session.execute(select(User).where(User.role == payload.role, User.active == True))  # noqa: E712
    else:
        rs_q = await session.execute(select(User).where(User.id != current.id, User.active == True))  # noqa: E712
    recipients = rs_q.scalars().all()
    if not recipients:
        raise HTTPException(status_code=400, detail="No recipients matched")
    now = _strip_tz(datetime.now(timezone.utc))
    created = []
    for r in recipients:
        n = Notification(
            id=str(uuid.uuid4()), user_id=r.id, sender_id=current.id,
            sender_name=current.name, title=payload.title, body=payload.body,
            link=payload.link, read=False, created_at=now,
        )
        session.add(n)
        created.append(n)
    await session.commit()
    return [_notif_public(n) for n in created]


@features_router.get("/notifications", response_model=List[NotificationPublic])
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Notification).where(Notification.user_id == current.id).order_by(Notification.created_at.desc())
    if unread_only:
        stmt = stmt.where(Notification.read == False)  # noqa: E712
    stmt = stmt.limit(max(1, min(limit, 200)))
    res = await session.execute(stmt)
    return [_notif_public(n) for n in res.scalars().all()]


@features_router.get("/notifications/unread-count")
async def unread_count(
    current: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    res = await session.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == current.id,
            Notification.read == False,  # noqa: E712
        )
    )
    return {"count": res.scalar() or 0}


@features_router.post("/notifications/{nid}/read")
async def mark_read(
    nid: str,
    current: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    res = await session.execute(
        select(Notification).where(Notification.id == nid, Notification.user_id == current.id)
    )
    n = res.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.read = True
    session.add(n)
    await session.commit()
    return {"ok": True}


@features_router.post("/notifications/read-all")
async def mark_all_read(
    current: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    res = await session.execute(
        select(Notification).where(Notification.user_id == current.id, Notification.read == False)  # noqa: E712
    )
    for n in res.scalars().all():
        n.read = True
        session.add(n)
    await session.commit()
    return {"ok": True}


# ============================================================================
# Blog
# ============================================================================
class BlogCreate(BaseModel):
    title: str
    body: str
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    images: Optional[list] = None
    published: bool = True


class BlogUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    images: Optional[list] = None
    published: Optional[bool] = None


class BlogPublic(BaseModel):
    id: str
    slug: str
    title: str
    excerpt: Optional[str] = None
    body: str
    cover_image: Optional[str] = None
    images: list = []
    author_name: str
    published: bool
    created_at: datetime
    updated_at: datetime


def _slugify(s: str) -> str:
    s = re.sub(r"[^\w\s-]", "", (s or "").strip().lower())
    s = re.sub(r"[-\s]+", "-", s)
    return (s or "post")[:80]


def _blog_public(p: BlogPost) -> BlogPublic:
    return BlogPublic(
        id=p.id, slug=p.slug, title=p.title, excerpt=p.excerpt, body=p.body,
        cover_image=p.cover_image, images=p.images or [],
        author_name=p.author_name, published=p.published,
        created_at=_as_utc(p.created_at), updated_at=_as_utc(p.updated_at),
    )


@features_router.post("/blog", response_model=BlogPublic)
async def create_blog(
    payload: BlogCreate,
    current: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not await _user_has_permission(session, current, "blog.write"):
        raise HTTPException(status_code=403, detail="Missing permission: blog.write")
    base_slug = _slugify(payload.title) or "post"
    slug = base_slug
    i = 2
    while True:
        ex = await session.execute(select(BlogPost).where(BlogPost.slug == slug))
        if not ex.scalar_one_or_none():
            break
        slug = f"{base_slug}-{i}"
        i += 1
    now = _strip_tz(datetime.now(timezone.utc))
    p = BlogPost(
        id=str(uuid.uuid4()), slug=slug, title=payload.title, body=payload.body,
        excerpt=payload.excerpt or (payload.body[:160] if payload.body else None),
        cover_image=payload.cover_image, images=payload.images or [],
        author_id=current.id, author_name=current.name,
        published=payload.published, created_at=now, updated_at=now,
    )
    session.add(p)
    await session.commit()
    await session.refresh(p)
    return _blog_public(p)


@features_router.get("/blog", response_model=List[BlogPublic])
async def list_blog(
    include_unpublished: bool = False,
    current: Optional[User] = Depends(_maybe_current_user),
    session: AsyncSession = Depends(get_session),
):
    can_see_drafts = bool(current and await _user_has_permission(session, current, "blog.write"))
    stmt = select(BlogPost).order_by(BlogPost.created_at.desc())
    if not (include_unpublished and can_see_drafts):
        stmt = stmt.where(BlogPost.published == True)  # noqa: E712
    res = await session.execute(stmt)
    return [_blog_public(p) for p in res.scalars().all()]


@features_router.get("/blog/{slug}", response_model=BlogPublic)
async def get_blog(slug: str, session: AsyncSession = Depends(get_session)):
    res = await session.execute(
        select(BlogPost).where(BlogPost.slug == slug, BlogPost.published == True)  # noqa: E712
    )
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    return _blog_public(p)


@features_router.patch("/blog/{post_id}", response_model=BlogPublic)
async def update_blog(
    post_id: str,
    payload: BlogUpdate,
    current: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not await _user_has_permission(session, current, "blog.write"):
        raise HTTPException(status_code=403, detail="Missing permission: blog.write")
    res = await session.execute(select(BlogPost).where(BlogPost.id == post_id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    p.updated_at = _strip_tz(datetime.now(timezone.utc))
    session.add(p)
    await session.commit()
    await session.refresh(p)
    return _blog_public(p)


@features_router.delete("/blog/{post_id}")
async def delete_blog(
    post_id: str,
    current: User = Depends(_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not await _user_has_permission(session, current, "blog.write"):
        raise HTTPException(status_code=403, detail="Missing permission: blog.write")
    res = await session.execute(select(BlogPost).where(BlogPost.id == post_id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    await session.delete(p)
    await session.commit()
    return {"ok": True}
