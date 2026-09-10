"""Test-wide setup.

The suite must never reach the deployed Supabase project: it would write civic records
to production and, because the schema keys complaints by uuid, fail on the readable
fixture ids these tests use. Clearing the credentials before ``app`` is imported makes
every repository factory hand back the in-memory implementation, which is what the
tests are actually asserting about.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402

settings.supabase_url = ""
settings.supabase_service_role_key = ""
settings.supabase_anon_key = ""
settings.storage_mode = "memory"

from app.core.security import create_access_token  # noqa: E402


@pytest.fixture
def staff_headers() -> dict[str, str]:
    """Authorization header for an administrator."""
    token = create_access_token("00000000-0000-0000-0000-000000000001", "test-admin", "admin")
    return {"Authorization": f"Bearer {token['access_token']}"}
