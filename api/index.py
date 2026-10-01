import os
import sys
from pathlib import Path

# Add project root and backend directory to sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

for path_str in (str(backend_dir), str(root_dir)):
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

# Ensure serverless flag is active so background long-polling does not hang Lambda
os.environ["VERCEL"] = "1"

# Export the raw FastAPI instance directly for Vercel's Python runtime
from main import app
