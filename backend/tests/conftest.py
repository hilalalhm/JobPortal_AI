import os
import sys
from pathlib import Path

# Pastikan 'main' & 'services' bisa diimpor dari tests/
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Isolasi storage test: pakai direktori sementara agar tidak
# menyentuh data pengguna asli.
import tempfile

TEST_STORAGE = Path(
    tempfile.gettempdir(),
    "jobpilot_test_storage",
).resolve()

TEST_STORAGE.mkdir(parents=True, exist_ok=True)

# Biarkan import main memakai path storage aslinya; test yang
# butuh isolasi akan memakai monkeypatch secara eksplisit.