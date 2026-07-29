import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import config


def test_find_env_file_looks_up_from_workspace_root(tmp_path):
    workspace_root = tmp_path / "workspace"
    backend_dir = workspace_root / "backend"
    app_dir = backend_dir / "app"
    core_dir = app_dir / "core"
    core_dir.mkdir(parents=True)

    env_file = workspace_root / ".env"
    env_file.write_text("TELEGRAM_BOT_TOKEN=test-token\nTELEGRAM_WEBHOOK_URL=https://example.com/webhook\n", encoding="utf-8")

    found = config.find_env_file(core_dir / "config.py")

    assert found == env_file


def test_find_env_file_ignores_env_new_and_examples(tmp_path):
    workspace_root = tmp_path / "workspace"
    backend_dir = workspace_root / "backend"
    app_dir = backend_dir / "app"
    core_dir = app_dir / "core"
    core_dir.mkdir(parents=True)

    (workspace_root / ".env.new").write_text("TELEGRAM_BOT_TOKEN=wrong-source\n", encoding="utf-8")
    (workspace_root / ".env.example").write_text("TELEGRAM_BOT_TOKEN=wrong-example\n", encoding="utf-8")

    found = config.find_env_file(core_dir / "config.py")

    assert found == workspace_root / ".env"
