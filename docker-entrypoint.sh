#!/bin/bash
set -e

export PGDATA=/var/lib/postgresql/data

# ── Locate PostgreSQL binaries (not on default PATH in slim images) ──
PG_INITDB=$(find /usr/lib/postgresql -name initdb -type f 2>/dev/null | head -1)
PG_CTL=$(find /usr/lib/postgresql -name pg_ctl -type f 2>/dev/null | head -1)
PG_PSQL=$(find /usr/lib/postgresql -name psql -type f 2>/dev/null | head -1)
export PATH="$(dirname "$PG_CTL"):$PATH"

# ── Defaults (so the image works with zero env vars) ──
export SECRET_KEY="${SECRET_KEY:-$(openssl rand -hex 32)}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-lms_password}"
export SUPERADMIN_EMAIL="${SUPERADMIN_EMAIL:-superadmin@lms.example.com}"
export SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-SuperAdmin123!}"
export DATABASE_URL="postgresql+asyncpg://lms_user:${POSTGRES_PASSWORD}@127.0.0.1:5432/lms_db"

# ── Initialize PostgreSQL data directory if empty ──
if [ ! -s "$PGDATA/PG_VERSION" ]; then
    mkdir -p "$PGDATA"
    chown postgres:postgres "$PGDATA"
    su postgres -c "$PG_INITDB --locale=C.UTF-8 --encoding=UTF8"
    # Allow password auth from localhost (for asyncpg TCP connection)
    su postgres -c "echo 'host all all 127.0.0.1/32 md5' >> $PGDATA/pg_hba.conf"
    su postgres -c "echo 'listen_addresses=localhost' >> $PGDATA/postgresql.conf"
fi

# ── Start PostgreSQL ──
su postgres -c "$PG_CTL start -w"

# ── Create database and user (idempotent) ──
su postgres -c "$PG_PSQL -tc \"SELECT 1 FROM pg_roles WHERE rolname='lms_user'\" | grep -q 1 || \
    $PG_PSQL -c \"CREATE USER lms_user WITH PASSWORD '${POSTGRES_PASSWORD}'\""
su postgres -c "$PG_PSQL -tc \"SELECT 1 FROM pg_database WHERE datname='lms_db'\" | grep -q 1 || \
    $PG_PSQL -c \"CREATE DATABASE lms_db OWNER lms_user\""

# ── Run migrations ──
# Create tables first so alembic has a foundation (fresh DB), then stamp head
python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"
alembic stamp head

# ── Run seeder (idempotent) ──
python -m app.db.seed

# ── Start uvicorn (foreground — this keeps the container alive) ──
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
