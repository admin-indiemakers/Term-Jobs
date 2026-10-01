import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
backend_root = root / "backend"
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from backend.api.index import app
