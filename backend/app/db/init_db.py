import asyncio
from sqlalchemy import select, text, inspect as sa_inspect
from app.db.session import AsyncSessionLocal
from app.db.base import Base
from app.db.session import engine
from app.models.user import User, Role, UserRole
from app.models.tenant import District
from app.core.security import hash_password
from app.config import get_settings

settings = get_settings()

ROLES = ["superadmin", "admin", "teacher", "parent", "student"]


def _apply_schema_migrations(connection):
    """Apply pending schema changes that create_all cannot handle on existing tables."""
    inspector = sa_inspect(connection)
    if "grade_entries" not in inspector.get_table_names():
        return  # table will be created fresh by create_all

    columns = {c["name"] for c in inspector.get_columns("grade_entries")}

    # Migration: old raw_score/max_score/numeric_grade system → new grade (1-5) system
    needs_migration = "raw_score" in columns or "numeric_grade" in columns

    if needs_migration and "grade" not in columns:
        # Add the new grade column
        connection.execute(text("ALTER TABLE grade_entries ADD COLUMN grade INTEGER"))

        # Migrate data: if numeric_grade exists, copy it directly
        if "numeric_grade" in columns:
            connection.execute(text(
                "UPDATE grade_entries SET grade = COALESCE(numeric_grade, "
                "CASE WHEN max_score > 0 THEN "
                "  CASE "
                "    WHEN (raw_score / max_score * 100) >= 90 THEN 5 "
                "    WHEN (raw_score / max_score * 100) >= 75 THEN 4 "
                "    WHEN (raw_score / max_score * 100) >= 60 THEN 3 "
                "    WHEN (raw_score / max_score * 100) >= 45 THEN 2 "
                "    ELSE 1 "
                "  END "
                "ELSE 3 END)"
            ))
        elif "raw_score" in columns and "max_score" in columns:
            connection.execute(text(
                "UPDATE grade_entries SET grade = "
                "CASE WHEN max_score > 0 THEN "
                "  CASE "
                "    WHEN (raw_score / max_score * 100) >= 90 THEN 5 "
                "    WHEN (raw_score / max_score * 100) >= 75 THEN 4 "
                "    WHEN (raw_score / max_score * 100) >= 60 THEN 3 "
                "    WHEN (raw_score / max_score * 100) >= 45 THEN 2 "
                "    ELSE 1 "
                "  END "
                "ELSE 3 END"
            ))
        else:
            connection.execute(text("UPDATE grade_entries SET grade = 3 WHERE grade IS NULL"))

        # Set NOT NULL after population
        connection.execute(text("ALTER TABLE grade_entries ALTER COLUMN grade SET NOT NULL"))

    # Add label column if missing
    if "label" not in columns:
        connection.execute(text("ALTER TABLE grade_entries ADD COLUMN label VARCHAR(120)"))

    # Drop old columns
    for old_col in ["raw_score", "max_score", "numeric_grade", "letter_grade"]:
        if old_col in columns:
            connection.execute(text(f"ALTER TABLE grade_entries DROP COLUMN {old_col}"))


async def init_db():
    # Retry DB connection to handle startup race conditions
    for attempt in range(1, 11):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(lambda _: None)  # test connection
            break
        except Exception:
            if attempt == 10:
                raise
            await asyncio.sleep(2)

    # Apply schema migrations before create_all
    async with engine.begin() as conn:
        await conn.run_sync(_apply_schema_migrations)

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
