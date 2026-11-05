"""Import all handler modules to register tools with the ToolRegistry."""
from . import requisitions
from . import job_descriptions
from . import candidates
from . import interviews
from . import decisions_and_portal
from . import workforce_operations

__all__ = [
    "requisitions",
    "job_descriptions",
    "candidates",
    "interviews",
    "decisions_and_portal",
    "workforce_operations"
]
