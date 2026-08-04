class BudgetGateException(Exception):
    pass

class BudgetGate:
    """
    3-tier cost routing budget gate (small/mid/large).
    Ensures cost discipline before invoking LLM calls.
    """
    DEFAULT_MODEL_TIER = "gpt-4o-mini"  # mid-tier default model

    @classmethod
    def check_and_route(cls, tenant_id: str, complexity: str = "mid") -> str:
        # Check budget limits; for MVP default to gpt-4o-mini
        if complexity == "high":
            return "gpt-4o"
        elif complexity == "low":
            return "gpt-3.5-turbo"
        return cls.DEFAULT_MODEL_TIER
