from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.db.base import Base
from app.db.session import engine
from app.models.user import User, Role, UserRole
from app.models.tenant import District
from app.core.security import hash_password
from app.config import get_settings

settings = get_settings()

ROLES = ["superadmin", "admin", "teacher", "student"]


async def init_db():
    # Create tables (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Seed roles
        for role_name in ROLES:
            existing = await db.execute(select(Role).where(Role.name == role_name))
            if not existing.scalar_one_or_none():
                db.add(Role(name=role_name))
        await db.flush()

        # Seed superadmin district
        district_result = await db.execute(select(District).where(District.slug == "system"))
        district = district_result.scalar_one_or_none()
        if not district:
            district = District(name="System", slug="system", is_active=True)
            db.add(district)
            await db.flush()

        # Seed superadmin user
        admin_result = await db.execute(
            select(User).where(User.email == settings.SUPERADMIN_EMAIL)
        )
        if not admin_result.scalar_one_or_none():
            admin = User(
                tenant_id=district.id,
                email=settings.SUPERADMIN_EMAIL,
                first_name="Super",
                last_name="Admin",
                password_hash=hash_password(settings.SUPERADMIN_PASSWORD),
                is_active=True,
            )
            db.add(admin)
            await db.flush()

            role_result = await db.execute(select(Role).where(Role.name == "superadmin"))
            superadmin_role = role_result.scalar_one_or_none()
            if superadmin_role:
                db.add(UserRole(user_id=admin.id, role_id=superadmin_role.id))

        await db.commit()
