"""
Unified LLM client — handles structured JSON calls via Groq Cloud API (Default) or local Ollama.
"""
import json
import re
import logging
from typing import Any, Dict
from groq import AsyncGroq
import httpx

from modules.resume_screener.config import get_settings

logger = logging.getLogger(__name__)


async def call_groq(prompt: str, system_prompt: str = "", temperature: float = 0.1) -> str:
    """
    Call Groq Cloud API using the official AsyncGroq SDK.
    Fast, cloud-based inference using Llama 3.3 70B / Llama 3.1 8B.
    """
    settings = get_settings()
    api_key = settings.groq_api_key
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set in environment or config.")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    client = AsyncGroq(api_key=api_key)
    
    # In JSON mode, prompt or system must mention json
    effective_system = system_prompt or "You are an AI assistant that extracts structured data and outputs strictly valid JSON."
    if "json" not in effective_system.lower() and "json" not in prompt.lower():
        effective_system += " Output response strictly in JSON format."

    messages = []
    if effective_system:
        messages.append({"role": "system", "content": effective_system})
    messages.append({"role": "user", "content": prompt})

    chat_completion = await client.chat.completions.create(
        messages=messages,
        model=settings.groq_model or "llama-3.3-70b-versatile",
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    return chat_completion.choices[0].message.content


async def call_ollama(prompt: str, system_prompt: str = "", temperature: float = 0.1) -> str:
    """
    Call local Ollama instance (/api/generate). Fallback option.
    """
    settings = get_settings()
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "num_ctx": 4096,
        },
    }
    if system_prompt:
        payload["system"] = system_prompt

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
    except httpx.TimeoutException:
        raise RuntimeError("Ollama request timed out after 120s")
    except httpx.ConnectError:
        raise RuntimeError(
            f"Cannot connect to Ollama at {settings.ollama_base_url}. "
            "Make sure Ollama is running: `ollama serve`"
        )
    except Exception as e:
        raise RuntimeError(f"Ollama error: {e}")


async def call_llm(prompt: str, system_prompt: str = "", temperature: float = 0.1) -> str:
    """
    Primary entrypoint: calls Groq if configured, otherwise falls back to Ollama.
    """
    settings = get_settings()
    provider = (settings.llm_provider or "groq").lower()

    if provider == "groq" or settings.groq_api_key:
        try:
            return await call_groq(prompt, system_prompt, temperature)
        except Exception as e:
            logger.warning(f"Groq API call failed ({e}), attempting Ollama fallback...")
            try:
                return await call_ollama(prompt, system_prompt, temperature)
            except Exception:
                raise e
    else:
        return await call_ollama(prompt, system_prompt, temperature)


# Backward compatibility aliases
call_ollama_raw = call_ollama
call_ollama = call_llm


def extract_json_from_response(text: str) -> Dict[str, Any]:
    """
    Robustly extract JSON from LLM output.
    Handles markdown code fences, trailing text, etc.
    """
    if not text:
        return {}

    # Try direct parse first
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Strip markdown code fences
    fenced = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass

    # Find first { ... } block
    brace_match = re.search(r"\{[\s\S]+\}", text)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    logger.warning(f"Could not parse JSON from LLM response: {text[:500]}")
    return {}
