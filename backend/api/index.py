import os
import sys
from pathlib import Path

# Add backend directory and project root to sys.path
backend_dir = Path(__file__).resolve().parent.parent
root_dir = backend_dir.parent

for path_str in (str(backend_dir), str(root_dir)):
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

os.environ["VERCEL"] = "1"

# Export the raw FastAPI instance directly for Vercel's Python runtime
from main import app
