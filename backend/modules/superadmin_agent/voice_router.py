"""Voice Agent Router powered by Sarvam AI (STT & TTS) with connection pooling, retries, and high-quality voice synthesis."""
import os
import json
import asyncio
import logging
import httpx
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

SARVAM_API_KEY = os.getenv("SARVAM_AI") or os.getenv("SARVAM_API_KEY") or "sk_7wx0x9pf_WncT2BnK0kPQNO0J3TOsp7Ga"
SARVAM_TIMEOUT = float(os.getenv("SARVAM_TIMEOUT", "10.0"))
MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB payload limit

# Shared persistent HTTP client with connection pooling
_http_client: httpx.AsyncClient = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(SARVAM_TIMEOUT, connect=5.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
            follow_redirects=True
        )
    return _http_client


async def post_sarvam_with_retry(url: str, headers: dict, files=None, data=None, json_data=None, retries: int = 3):
    """Execute HTTP POST to Sarvam AI with connection pooling and exponential backoff retries."""
    client = get_http_client()
    last_err = None
    for attempt in range(retries):
        try:
            if files:
                resp = await client.post(url, headers=headers, files=files, data=data)
            else:
                resp = await client.post(url, headers=headers, json=json_data)

            if resp.status_code == 200:
                return resp

            if resp.status_code in [500, 502, 503, 504]:
                logger.warning(f"Sarvam API status {resp.status_code} on attempt {attempt + 1}/{retries}: {resp.text}")
                last_err = HTTPException(status_code=resp.status_code, detail=f"Sarvam API Error: {resp.text}")
                await asyncio.sleep(0.3 * (2 ** attempt))
                continue

            raise HTTPException(status_code=resp.status_code, detail=f"Sarvam API Error: {resp.text}")
        except (httpx.TimeoutException, httpx.NetworkError, httpx.TransportError) as e:
            logger.warning(f"Sarvam network error on attempt {attempt + 1}/{retries}: {e}")
            last_err = HTTPException(status_code=504, detail=f"Sarvam API network timeout/error: {str(e)}")
            await asyncio.sleep(0.3 * (2 ** attempt))
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected Sarvam request exception: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    if last_err:
        raise last_err
    raise HTTPException(status_code=500, detail="Sarvam API request failed after retries")


class TTSRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize to speech")
    speaker: str = Field("priya", description="Sarvam AI voice speaker name (e.g. priya, rahul, simran, aditya)")
    language_code: str = Field("en-IN", description="Target language code (e.g. en-IN, hi-IN)")
    pace: float = Field(1.25, description="Speech speed / pace multiplier (default 1.25 for fast conversational speech)")
    max_chars: int = Field(2000, description="Max character length limit for synthesis input (default 2000)")


@router.post("/stt")
async def speech_to_text(
    file: UploadFile = File(...),
    model: str = Form("saaras:v3"),
    language_code: str = Form("en-IN")
):
    """Convert spoken voice recording (audio file) into text transcript via Sarvam AI STT."""
    api_key = os.getenv("SARVAM_AI") or os.getenv("SARVAM_API_KEY") or SARVAM_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="SARVAM_AI API key not configured")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file payload is empty")

    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Audio payload exceeds maximum 10MB size limit")

    stt_model = model if model in ["saaras:v3", "saarika:v2", "saarika:v1"] else "saaras:v3"
    logger.info(f"🎙️ [SARVAM STT INCOMING] Filename: {file.filename}, Size: {len(audio_bytes)} bytes, Model: {stt_model}")

    url = "https://api.sarvam.ai/speech-to-text"
    headers = {
        "api-subscription-key": api_key
    }

    files = {
        "file": (file.filename or "recording.wav", audio_bytes, file.content_type or "audio/wav")
    }
    data = {
        "model": stt_model,
        "language_code": language_code
    }

    resp = await post_sarvam_with_retry(url, headers=headers, files=files, data=data)
    result = resp.json()
    transcript = result.get("transcript", "")
    logger.info(f"✅ [SARVAM STT SUCCESS] Transcript: \"{transcript}\"")
    return {
        "status": "success",
        "transcript": transcript,
        "language_code": result.get("language_code", language_code)
    }


@router.post("/tts")
async def text_to_speech(payload: TTSRequest):
    """Synthesize response text into spoken audio WAV base64 string via Sarvam AI TTS (bulbul:v3)."""
    api_key = os.getenv("SARVAM_AI") or os.getenv("SARVAM_API_KEY") or SARVAM_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="SARVAM_AI API key not configured")

    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text payload is empty")

    url = "https://api.sarvam.ai/text-to-speech"
    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json"
    }

    # Clean markdown formatting tags before synthesizing
    cleaned_text = payload.text.replace("**", "").replace("*", "").replace("`", "").strip()
    input_text = cleaned_text[:payload.max_chars]

    logger.info(f"🔊 [SARVAM TTS INCOMING] Text: \"{input_text[:70]}...\", Speaker: {payload.speaker}, Pace: {payload.pace}")

    sarvam_payload = {
        "inputs": [input_text],
        "target_language_code": payload.language_code,
        "speaker": payload.speaker,
        "pitch": 0,
        "pace": max(0.7, min(1.65, payload.pace)),
        "loudness": 1.5,
        "speech_sample_rate": 22050,
        "enable_preprocessing": True,
        "model": "bulbul:v3"
    }

    resp = await post_sarvam_with_retry(url, headers=headers, json_data=sarvam_payload)
    result = resp.json()
    audios = result.get("audios", [])
    audio_base64 = audios[0] if audios else None
    logger.info(f"✅ [SARVAM TTS SUCCESS] Base64 Audio length: {len(audio_base64 or '')} bytes")

    return {
        "status": "success",
        "audio_base64": audio_base64
    }
