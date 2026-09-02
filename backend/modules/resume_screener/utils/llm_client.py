"""
Unified LLM client – handles structured JSON calls via Groq Cloud API with multi-model fallback.
"""
import json
import re
import logging
from typing import Any, Dict
from groq import AsyncGroq
import httpx

from modules.resume_screener.config import get_settings

logger = logging.getLogger(__name__)

# Active high-throughput models on Groq with fallback order
GROQ_MODELS = [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "qwen/qwen3.6-27b",
]


async def call_groq(prompt: str, system_prompt: str = "", temperature: float = 0.1) -> str:
    """
    Call Groq Cloud API with automatic fallback across available models on rate-limit / errors.
    """
    settings = get_settings()
    api_key = settings.groq_api_key
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set in environment or config.")

    client = AsyncGroq(api_key=api_key)

    effective_system = system_prompt or "You are an AI assistant that extracts structured data and outputs strictly valid JSON."
    if "json" not in effective_system.lower():
        effective_system += " Output response strictly in JSON format."

    # Ensure JSON is mentioned in user prompt for Groq JSON mode compliance
    effective_prompt = prompt
    if "json" not in effective_prompt.lower():
        effective_prompt = f"{prompt}\n\nRespond with a valid JSON object only."

    messages = [
        {"role": "system", "content": effective_system},
        {"role": "user", "content": effective_prompt},
    ]

    # Try preferred model first, then fallback models
    models_to_try = []
    if settings.groq_model and settings.groq_model not in models_to_try:
        models_to_try.append(settings.groq_model)
    for m in GROQ_MODELS:
        if m not in models_to_try:
            models_to_try.append(m)

    last_error = None
    for model_name in models_to_try:
        # First attempt: strict JSON mode
        try:
            chat_completion = await client.chat.completions.create(
                messages=messages,
                model=model_name,
                temperature=temperature,
                response_format={"type": "json_object"},
            )
            content = chat_completion.choices[0].message.content
            if content and content.strip():
                return content
        except Exception as e:
            err_str = str(e).lower()
            # If JSON validation failed, try without strict response_format
            if "json_validate_failed" in err_str or "validate json" in err_str:
                try:
                    chat_completion = await client.chat.completions.create(
                        messages=messages,
                        model=model_name,
                        temperature=temperature,
                    )
                    content = chat_completion.choices[0].message.content
                    if content and content.strip():
                        return content
                except Exception as inner_e:
                    logger.warning(f"Groq model {model_name} non-strict retry failed: {inner_e}")
            logger.warning(f"Groq model {model_name} failed: {e}. Trying fallback model...")
            last_error = e
            continue

    if last_error:
        raise last_error
    raise RuntimeError("All Groq models failed to return a response.")


async def call_ollama(prompt: str, system_prompt: str = "", temperature: float = 0.1) -> str:
    """
    Call local Ollama instance with short timeout.
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
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
    except Exception as e:
        raise RuntimeError(f"Ollama unavailable: {e}")


async def call_llm(prompt: str, system_prompt: str = "", temperature: float = 0.1) -> str:
    """
    Primary entrypoint: calls Groq with multi-model fallback, then Ollama as last resort.
    """
    settings = get_settings()
    provider = (settings.llm_provider or "groq").lower()

    if provider == "groq" or settings.groq_api_key:
        try:
            return await call_groq(prompt, system_prompt, temperature)
        except Exception as e:
            logger.warning(f"Groq all models failed ({e}), attempting fast Ollama fallback...")
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
    """
    if not text:
        return {}

    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    fenced = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass

    brace_match = re.search(r"\{[\s\S]+\}", text)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    logger.warning(f"Could not parse JSON from LLM response: {text[:300]}")
    return {}
