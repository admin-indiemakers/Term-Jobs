"""Provider-independent LLM client interface with OpenRouter free model switching."""
import abc
import json
import logging
from typing import Any, AsyncIterator, Dict, List, Optional
import httpx

logger = logging.getLogger("aura.llm")

# Curated pool of active, verified free models on OpenRouter
DEFAULT_FREE_MODELS_POOL: List[str] = [
    "openrouter/free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3.5-lightning:free",
    "dots-studio/dots-3-note-preview:free",
    "liquid/lfm-2.5-2.6b:free"
]


class LLMResponseChunk(abc.ABC):
    """A streaming chunk from the LLM."""
    pass


class TextDeltaChunk(LLMResponseChunk):
    def __init__(self, text: str):
        self.text = text


class ToolCallDeltaChunk(LLMResponseChunk):
    def __init__(self, index: int, tool_id: Optional[str], name: Optional[str], arguments_delta: str):
        self.index = index
        self.tool_id = tool_id
        self.name = name
        self.arguments_delta = arguments_delta


class BaseLLMClient(abc.ABC):
    """Abstract interface for LLM provider adapters."""
    @abc.abstractmethod
    async def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> AsyncIterator[LLMResponseChunk]:
        """Stream chunks from the LLM provider."""
        yield


class OpenRouterLLMClient(BaseLLMClient):
    """OpenRouter streaming client with automatic Free Models Switching and fallback."""
    def __init__(
        self,
        api_key: str,
        preferred_model: str = "openrouter/free",
        model_pool: Optional[List[str]] = None,
        api_base: str = "https://openrouter.ai/api/v1",
        timeout_seconds: float = 60.0
    ):
        self.api_key = api_key
        self.api_base = api_base.rstrip("/")
        self.timeout = timeout_seconds

        # Model pool with preferred model first
        pool = list(model_pool or DEFAULT_FREE_MODELS_POOL)
        if preferred_model in pool:
            pool.remove(preferred_model)
        self.model_pool = [preferred_model] + pool

    async def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> AsyncIterator[LLMResponseChunk]:
        url = f"{self.api_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://termjobs.com",
            "X-Title": "TermJobs Aura AI Assistant",
            "Content-Type": "application/json"
        }

        last_error = None
        for model_name in self.model_pool:
            payload: Dict[str, Any] = {
                "model": model_name,
                "messages": messages,
                "stream": True
            }
            if tools:
                payload["tools"] = tools
                payload["tool_choice"] = "auto"

            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    async with client.stream("POST", url, headers=headers, json=payload) as response:
                        if response.status_code != 200:
                            err_body = await response.aread()
                            err_msg = err_body.decode("utf-8", errors="ignore")
                            logger.warning(
                                f"[OpenRouter Switcher] Model '{model_name}' returned {response.status_code}. "
                                f"Switching to next free model in pool... Error: {err_msg[:120]}"
                            )
                            last_error = f"Model {model_name} error: {err_msg[:100]}"
                            continue  # Try next free model in pool

                        # Stream response successfully from this model
                        has_yielded = False
                        async for line in response.aiter_lines():
                            line = line.strip()
                            if not line or line.startswith(":"):
                                continue
                            if line == "data: [DONE]":
                                break
                            if line.startswith("data: "):
                                data_str = line[6:]
                                try:
                                    chunk_json = json.loads(data_str)
                                    choices = chunk_json.get("choices", [])
                                    if not choices:
                                        continue
                                    delta = choices[0].get("delta", {})

                                    # Content text
                                    if "content" in delta and delta["content"]:
                                        has_yielded = True
                                        yield TextDeltaChunk(delta["content"])

                                    # Tool calls
                                    if "tool_calls" in delta and delta["tool_calls"]:
                                        has_yielded = True
                                        for tc in delta["tool_calls"]:
                                            yield ToolCallDeltaChunk(
                                                index=tc.get("index", 0),
                                                tool_id=tc.get("id"),
                                                name=tc.get("function", {}).get("name"),
                                                arguments_delta=tc.get("function", {}).get("arguments", "")
                                            )
                                except json.JSONDecodeError:
                                    continue

                        if has_yielded:
                            return  # Success, complete!

            except Exception as exc:
                logger.warning(f"[OpenRouter Switcher] Exception on '{model_name}': {exc}. Switching to next model...")
                last_error = str(exc)
                continue

        # If all models in the pool failed, raise descriptive error
        raise RuntimeError(f"All free OpenRouter models failed. Last error: {last_error}")


class OpenAILLMClient(OpenRouterLLMClient):
    """Backward-compatible alias for OpenAILLMClient pointing to OpenRouter/OpenAI."""
    pass


class MockLLMClient(BaseLLMClient):
    """Mock client for testing and verification without external network calls."""
    def __init__(self, canned_responses: Optional[List[Dict[str, Any]]] = None):
        self.canned_responses = canned_responses or []
        self._call_count = 0

    def add_canned_text(self, text: str) -> None:
        self.canned_responses.append({"type": "text", "content": text})

    def add_canned_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> None:
        self.canned_responses.append({
            "type": "tool_call",
            "name": tool_name,
            "arguments": json.dumps(arguments)
        })

    async def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> AsyncIterator[LLMResponseChunk]:
        if self._call_count < len(self.canned_responses):
            resp = self.canned_responses[self._call_count]
            self._call_count += 1
            if resp["type"] == "text":
                yield TextDeltaChunk(resp["content"])
            elif resp["type"] == "tool_call":
                yield ToolCallDeltaChunk(
                    index=0,
                    tool_id="mock_call_001",
                    name=resp["name"],
                    arguments_delta=resp["arguments"]
                )
        else:
            yield TextDeltaChunk("I have processed your request.")
