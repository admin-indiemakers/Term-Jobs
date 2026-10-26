"""Query Understanding Layer Domain Models and Schemas for TermJobs.

Defines Pydantic models for execution modes, query strategies, strategy execution trace,
conversation slot state, and the structured strategy plan.
"""
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ExecutionMode(str, Enum):
    """Supported execution modes for user queries."""
    DIRECT_ANSWER = "direct_answer"
    STRUCTURED_TOOL = "structured_tool"
    KNOWLEDGE_RETRIEVAL = "knowledge_retrieval"
    HYBRID = "hybrid"
    CLARIFICATION = "clarification"
    UNSUPPORTED = "unsupported"


class StrategyType(str, Enum):
    """Applicable query understanding strategies."""
    CONTEXTUAL_REWRITE = "contextual_rewrite"
    QUERY_DECOMPOSITION = "query_decomposition"
    QUERY_EXPANSION = "query_expansion"
    MULTI_QUERY = "multi_query"
    HYDE_RETRIEVAL = "hyde_retrieval"
    STEP_BACK = "step_back"
    STRUCTURED_FILTER = "structured_filter"


class StrategyExecutionRecord(BaseModel):
    """Audit and trace record for an individual strategy execution."""
    strategy: StrategyType
    status: str = "executed"  # "executed", "skipped", "failed"
    reason: str = ""
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None
    duration_ms: float = 0.0


class ConversationSlotState(BaseModel):
    """Explicit conversation memory and slot tracking across turns."""
    last_intent: Optional[str] = None
    active_requisition_id: Optional[str] = None
    active_requisition_title: Optional[str] = None
    active_candidate_id: Optional[str] = None
    active_candidate_name: Optional[str] = None
    active_draft: Optional[Dict[str, Any]] = None
    active_filters: Optional[Dict[str, Any]] = None
    pending_clarification: Optional[str] = None
    pending_action: Optional[Dict[str, Any]] = None
    recent_roles: List[str] = Field(default_factory=list)
    recent_candidates: List[str] = Field(default_factory=list)
    updated_at: Optional[str] = None


class StrategyPlan(BaseModel):
    """Structured strategy plan produced and validated by the Query Orchestrator."""
    domain: str = "hiring"
    intent: str = "unknown"
    execution_mode: ExecutionMode = ExecutionMode.DIRECT_ANSWER
    strategies: List[StrategyType] = Field(default_factory=list)
    contextual_rewrite: Optional[str] = None
    entities: Dict[str, Any] = Field(default_factory=dict)
    sub_queries: List[Dict[str, Any]] = Field(default_factory=list)
    filters: Dict[str, Any] = Field(default_factory=dict)
    missing_required_fields: List[str] = Field(default_factory=list)
    ambiguities: List[str] = Field(default_factory=list)
    requires_clarification: bool = False
    clarification_question: Optional[str] = None
    target_tool: Optional[str] = None
    tool_arguments: Dict[str, Any] = Field(default_factory=dict)
    strategy_trace: List[StrategyExecutionRecord] = Field(default_factory=list)
