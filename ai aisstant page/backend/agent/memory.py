"""Sliding-window conversation memory with token awareness and atomic tool-pair preservation."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Normalized message representation."""
    role: str  # "system" | "user" | "assistant" | "tool"
    content: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None

    def to_llm_dict(self) -> Dict[str, Any]:
        doc: Dict[str, Any] = {"role": self.role}
        if self.content is not None:
            doc["content"] = self.content
        if self.tool_calls is not None:
            doc["tool_calls"] = self.tool_calls
        if self.tool_call_id is not None:
            doc["tool_call_id"] = self.tool_call_id
        if self.name is not None:
            doc["name"] = self.name
        return doc


class ConversationMemory:
    """Manages sliding window of messages while preserving system prompt and tool-call pairs."""
    def __init__(self, max_messages: int = 30):
        self.max_messages = max_messages
        self.system_message: Optional[ChatMessage] = None
        self.messages: List[ChatMessage] = []

    def set_system_prompt(self, prompt: str) -> None:
        self.system_message = ChatMessage(role="system", content=prompt)

    def add_message(self, message: ChatMessage) -> None:
        self.messages.append(message)
        self._prune_if_needed()

    def add_user_message(self, content: str) -> None:
        self.add_message(ChatMessage(role="user", content=content))

    def add_assistant_message(
        self,
        content: Optional[str] = None,
        tool_calls: Optional[List[Dict[str, Any]]] = None
    ) -> None:
        self.add_message(ChatMessage(role="assistant", content=content, tool_calls=tool_calls))

    def add_tool_result(self, tool_call_id: str, tool_name: str, result_content: str) -> None:
        self.add_message(ChatMessage(role="tool", tool_call_id=tool_call_id, name=tool_name, content=result_content))

    def get_messages_for_llm(self) -> List[Dict[str, Any]]:
        result = []
        if self.system_message:
            result.append(self.system_message.to_llm_dict())
        for msg in self.messages:
            result.append(msg.to_llm_dict())
        return result

    def _prune_if_needed(self) -> None:
        """Prune oldest turns while never breaking orphaned tool_call/tool_result pairs."""
        if len(self.messages) <= self.max_messages:
            return

        # Prune from front
        excess = len(self.messages) - self.max_messages
        # Ensure we do not start truncation in the middle of a tool-call pair
        idx = excess
        while idx < len(self.messages) and self.messages[idx].role == "tool":
            idx += 1
        self.messages = self.messages[idx:]
