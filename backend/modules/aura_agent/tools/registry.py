"""Tool registration and schema management engine."""
import inspect
from dataclasses import dataclass
from typing import Any, Callable, Coroutine, Dict, List, Optional, Type
from pydantic import BaseModel
from .context import ToolExecutionContext


def serialize_mongo(data: Any) -> Any:
    """Recursively serializes MongoDB objects, datetimes, ObjectIds, and UUIDs."""
    if isinstance(data, dict):
        res = {}
        for k, v in data.items():
            if k == "_id":
                if "id" not in data:
                    res["id"] = str(v)
            else:
                res[str(k)] = serialize_mongo(v)
        return res
    elif isinstance(data, (list, tuple, set)):
        return [serialize_mongo(item) for item in data]
    elif hasattr(data, "isoformat"):
        return data.isoformat()
    elif hasattr(data, "__str__") and type(data).__module__.startswith("bson"):
        return str(data)
    elif isinstance(data, (str, int, float, bool)) or data is None:
        return data
    return str(data)


@dataclass
class ToolResult:
    """Standardized output returned by every tool handler."""
    success: bool
    data: Dict[str, Any]
    message: str
    ui_card: Optional[str] = None
    error: Optional[str] = None
    proposal_required: bool = False
    proposal_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "data": serialize_mongo(self.data),
            "message": self.message,
            "ui_card": self.ui_card,
            "error": self.error,
            "proposal_required": self.proposal_required,
            "proposal_id": self.proposal_id
        }


@dataclass
class ToolDefinition:
    """Registered metadata for an executable tool."""
    name: str
    description: str
    domain: str
    input_model: Type[BaseModel]
    handler: Callable[[Any, ToolExecutionContext], Coroutine[Any, Any, ToolResult]]
    requires_confirmation: bool = False
    read_only: bool = False


class ToolRegistry:
    """Registry maintaining active tool definitions and generating LLM schemas."""
    def __init__(self):
        self._tools: Dict[str, ToolDefinition] = {}

    def register(
        self,
        name: str,
        description: str,
        domain: str,
        input_model: Type[BaseModel],
        requires_confirmation: bool = False,
        read_only: bool = False
    ) -> Callable:
        """Decorator to register a tool handler function."""
        def decorator(func: Callable[[Any, ToolExecutionContext], Coroutine[Any, Any, ToolResult]]):
            if name in self._tools:
                raise ValueError(f"Tool '{name}' is already registered.")
            self._tools[name] = ToolDefinition(
                name=name,
                description=description.strip(),
                domain=domain,
                input_model=input_model,
                handler=func,
                requires_confirmation=requires_confirmation,
                read_only=read_only
            )
            return func
        return decorator

    def get(self, name: str) -> Optional[ToolDefinition]:
        if name in self._tools:
            return self._tools[name]

        # Fuzzy and alias normalizer for LLM free model variations
        normalized = name.lower().replace("_", "")
        aliases = {
            "getopenrequisitions": "list_requisitions",
            "getrequisitions": "list_requisitions",
            "listopenrequisitions": "list_requisitions",
            "getrequisitionstatus": "list_requisitions",
            "getpendingtimesheets": "list_pending_timesheets",
            "gettimesheets": "list_pending_timesheets",
            "getcandidates": "search_candidates",
            "findcandidates": "search_candidates",
            "getkpis": "get_hiring_manager_kpis",
            "getdashboardkpis": "get_hiring_manager_kpis",
            "getupcominginterviews": "list_upcoming_interviews"
        }
        if normalized in aliases and aliases[normalized] in self._tools:
            return self._tools[aliases[normalized]]

        for k, tool in self._tools.items():
            if k.lower().replace("_", "") == normalized:
                return tool
        return None

    def list_tools(self) -> List[ToolDefinition]:
        return list(self._tools.values())

    def get_openai_tools_schema(self) -> List[Dict[str, Any]]:
        """Generate OpenAI/Anthropic compatible function calling schemas."""
        schemas = []
        for tool in self._tools.values():
            schema = tool.input_model.model_json_schema()
            # Clean schema for LLM compatibility
            schema.pop("title", None)
            schemas.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": schema
                }
            })
        return schemas

    async def execute(
        self,
        name: str,
        raw_arguments: Dict[str, Any],
        ctx: ToolExecutionContext
    ) -> ToolResult:
        """Validate input arguments, check permissions, and invoke tool handler."""
        tool = self._tools.get(name)
        if not tool:
            return ToolResult(
                success=False,
                data={},
                message=f"Tool '{name}' does not exist in the registry.",
                error="UNKNOWN_TOOL"
            )

        # 1. Validate arguments using Pydantic
        try:
            # Filter to only valid fields defined on tool model
            field_names = set(tool.input_model.model_fields.keys())
            filtered_args = {k: v for k, v in raw_arguments.items() if k in field_names}
            parsed_args = tool.input_model(**filtered_args)
        except Exception as exc:
            return ToolResult(
                success=False,
                data={},
                message=f"Invalid arguments for tool '{name}': {str(exc)}",
                error="VALIDATION_ERROR"
            )

        # 2. Check Human-in-the-Loop Confirmation requirement
        if tool.requires_confirmation:
            # Generate proposal instead of executing immediately
            impact_desc = f"Execute action '{tool.name}' with provided parameters."
            proposal = await ctx.proposal_service.create_proposal(
                tenant_id=ctx.tenant_id,
                user=ctx.user,
                action=tool.name,
                parameters=parsed_args.model_dump(),
                impact_summary=impact_desc
            )
            await ctx.log_action(
                action=tool.name,
                target_resource=tool.domain,
                parameters=parsed_args.model_dump(),
                status="CONFIRMATION_REQUIRED",
                proposal_id=proposal.id
            )
            return ToolResult(
                success=True,
                data={"proposal_id": proposal.id, "parameters": parsed_args.model_dump()},
                message=f"Action '{tool.name}' requires confirmation. Proposal created.",
                ui_card="proposal_confirmation_card",
                proposal_required=True,
                proposal_id=proposal.id
            )

        # 3. Execute handler
        try:
            result = await tool.handler(parsed_args, ctx)
            await ctx.log_action(
                action=tool.name,
                target_resource=tool.domain,
                parameters=parsed_args.model_dump(),
                result_summary=result.data,
                status="SUCCESS" if result.success else "FAILED",
                error_message=result.error
            )
            return result
        except Exception as exc:
            await ctx.log_action(
                action=tool.name,
                target_resource=tool.domain,
                parameters=parsed_args.model_dump(),
                status="FAILED",
                error_message=str(exc)
            )
            return ToolResult(
                success=False,
                data={},
                message=f"Execution of tool '{name}' failed: {str(exc)}",
                error="EXECUTION_ERROR"
            )


# Global Tool Registry Singleton
registry = ToolRegistry()
hiring_tool = registry.register
