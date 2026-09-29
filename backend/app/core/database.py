import logging
import os
import sys
import uuid
from sqlalchemy import create_engine, TypeDecorator, CHAR
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool
import sqlalchemy.dialects.postgresql as pg_types

from app.core.config import settings

logger = logging.getLogger("auramed.database")

class SqliteUUID(TypeDecorator):
    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else value

    def process_result_value(self, value, dialect):
        return uuid.UUID(value) if value is not None else value


db_url = settings.database_url
is_sqlite = False

if db_url.startswith("postgresql"):
    # Test if PostgreSQL is actually running and accepting connections
    try:
        test_engine = create_engine(db_url, pool_pre_ping=True)
        with test_engine.connect() as conn:
            pass
        engine = test_engine
        logger.info(f"Connected to PostgreSQL database at {db_url}")
    except Exception as e:
        connected = False
        try:
            import subprocess
            wsl_ip = subprocess.check_output(['wsl', '-u', 'root', '-d', 'Ubuntu', 'hostname', '-I'], timeout=3).decode().strip().split()[0]
            if wsl_ip:
                alt_url = db_url.replace("localhost", wsl_ip).replace("127.0.0.1", wsl_ip)
                alt_engine = create_engine(alt_url, pool_pre_ping=True)
                with alt_engine.connect() as conn:
                    pass
                engine = alt_engine
                logger.info(f"Connected to PostgreSQL database in WSL at {alt_url}")
                connected = True
        except Exception:
            pass

        if not connected:
            logger.warning(
                f"PostgreSQL at localhost:5432 is not running ({e}). "
                f"Automatically switching to local SQLite database."
            )
            is_sqlite = True
else:
    is_sqlite = True

if is_sqlite:
    pg_types.UUID = lambda as_uuid=True: SqliteUUID()
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sqlite_path = os.path.join(base_dir, "auramed_dev.db")
    from sqlalchemy import event

    engine = create_engine(
        f"sqlite:///{sqlite_path}",
        connect_args={"check_same_thread": False, "timeout": 30},
        pool_pre_ping=True,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()

SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, expire_on_commit=False, bind=engine
)
Base = declarative_base()


def ensure_sqlite_columns():
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE appointments ADD COLUMN reminder_sent BOOLEAN DEFAULT 0"))
                conn.commit()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE notifications ADD COLUMN retry_count INTEGER DEFAULT 0"))
                conn.commit()
            except Exception:
                pass
            # Rotterdam 2003 criteria columns on scans table
            scan_cols = [
                ("criterion_oligo_anovulation", "BOOLEAN DEFAULT NULL"),
                ("criterion_hyperandrogenism", "BOOLEAN DEFAULT NULL"),
                ("criterion_polycystic_ovaries", "BOOLEAN DEFAULT NULL"),
                ("rotterdam_criteria_met", "INTEGER DEFAULT NULL"),
                ("rotterdam_positive", "BOOLEAN DEFAULT NULL"),
            ]
            for col_name, col_def in scan_cols:
                try:
                    conn.execute(text(f"ALTER TABLE scans ADD COLUMN {col_name} {col_def}"))
                    conn.commit()
                except Exception:
                    pass
    except Exception:
        pass


ensure_sqlite_columns()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
