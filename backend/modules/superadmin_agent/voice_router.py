"""Voice Agent Router powered by Sarvam AI (STT & TTS) and Pipecat Real-Time WebRTC Streaming.

Provides:
1. Real-time SmallWebRTC full-duplex audio streaming with Silero VAD barge-in for web browser.
2. Synchronous REST endpoints (/stt, /tts) with connection pooling and TTS text sanitization for backward compatibility.
"""
import os
import json
import uuid
import asyncio
import logging
import httpx
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Request, Response, BackgroundTasks
from pydantic import BaseModel, Field

from pipecat.transports.smallwebrtc.request_handler import (
    IceCandidate,
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
)

from .voice_pipeline import (
    small_webrtc_handler,
    run_superadmin_webrtc_bot,
    clean_tts_text,
    active_voice_sessions,
    session_executed_actions,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

def get_sarvam_stt_key() -> str:
    """Retrieve dedicated Sarvam AI key for Speech-to-Text with fresh environment reload."""
    from dotenv import load_dotenv
    load_dotenv(override=True)
    return (
        os.getenv("SARVAM_STT_API_KEY")
        or "sk_kdzj78ak_qF2BIjavt8NrWhAraVv5Mzdd"
    )

def get_sarvam_tts_key() -> str:
    """Retrieve dedicated Sarvam AI key for Text-to-Speech with fresh environment reload."""
    from dotenv import load_dotenv
    load_dotenv(override=True)
    return (
        os.getenv("SARVAM_TTS_API_KEY")
        or os.getenv("SARVAM_API_KEY")
        or "sk_04xikhhl_jzepBtYmbqMhcTIHNC2SF5M5"
    )

def get_sarvam_api_key() -> str:
    return get_sarvam_tts_key()

SARVAM_API_KEY = get_sarvam_api_key()
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


# ==============================================================================
# REST STT / TTS Endpoints (Backward-Compatible)
# ==============================================================================
@router.post("/stt")
async def speech_to_text(
    file: UploadFile = File(...),
    model: str = Form("saaras:v3"),
    language_code: str = Form("en-IN")
):
    """Convert spoken voice recording (audio file) into text transcript via Sarvam AI STT."""
    api_key = get_sarvam_stt_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="SARVAM STT API key not configured")

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

    try:
        resp = await post_sarvam_with_retry(url, headers=headers, files=files, data=data)
    except HTTPException as ex:
        if ex.status_code in (402, 403):
            logger.info("STT key quota reached on REST endpoint, falling back to secondary key...")
            backup_key = get_sarvam_tts_key()
            headers["api-subscription-key"] = backup_key
            files["file"] = (file.filename or "recording.wav", audio_bytes, file.content_type or "audio/wav")
            resp = await post_sarvam_with_retry(url, headers=headers, files=files, data=data)
        else:
            raise ex

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
    """Synthesize response text into spoken audio WAV base64 string via Sarvam AI TTS (bulbul:v3) with text cleaning."""
    api_key = get_sarvam_tts_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="SARVAM TTS API key not configured")

    # Clean text using Pipecat sanitizer (strips asterisks, backticks, lone punctuation)
    cleaned = clean_tts_text(payload.text)
    if not cleaned:
        raise HTTPException(status_code=400, detail="Text payload is empty after sanitization")

    input_text = cleaned[:payload.max_chars]
    url = "https://api.sarvam.ai/text-to-speech"
    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json"
    }

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


# ==============================================================================
# Real-Time Pipecat SmallWebRTC Endpoints (Web-Only)
# ==============================================================================
@router.post("/start")
async def webrtc_start(request: Request):
    """Initialize a real-time Pipecat WebRTC session with STUN server configuration."""
    try:
        data = await request.json()
    except Exception:
        data = {}

    session_id = f"superadmin-voice-{uuid.uuid4().hex[:10]}"
    active_voice_sessions[session_id] = {
        "user_name": data.get("user_name", "Super Admin"),
        "created_at": asyncio.get_running_loop().time()
    }
    session_executed_actions[session_id] = []

    return {
        "sessionId": session_id,
        "session_id": session_id,
        "iceConfig": {
            "iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]
        },
        "status": "ready"
    }


@router.post("/offer")
@router.post("/connect")
async def webrtc_offer(
    request: Request,
    background_tasks: BackgroundTasks,
    session_id: str | None = None
):
    """Process incoming WebRTC SDP offer and launch the SuperAdmin Pipecat voice pipeline."""
    request_data = await request.json()
    resolved_session_id = session_id or request_data.get("session_id") or request_data.get("sessionId") or f"voice-{uuid.uuid4().hex[:8]}"

    webrtc_request = SmallWebRTCRequest(
        sdp=request_data["sdp"],
        type=request_data["type"],
        pc_id=request_data.get("pc_id"),
        restart_pc=request_data.get("restart_pc"),
        request_data=request_data.get("request_data") or request_data.get("requestData"),
    )

    user_name = request_data.get("user_name") or active_voice_sessions.get(resolved_session_id, {}).get("user_name", "Super Admin")

    async def webrtc_connection_callback(connection):
        logger.info(f"🎙️ [WEBRTC CONNECTION ESTABLISHED] pc_id={connection.pc_id}, session_id={resolved_session_id}")
        background_tasks.add_task(run_superadmin_webrtc_bot, connection, resolved_session_id, user_name)

    answer = await small_webrtc_handler.handle_web_request(
        request=webrtc_request,
        webrtc_connection_callback=webrtc_connection_callback,
    )
    return answer


@router.patch("/offer")
@router.patch("/connect")
async def webrtc_ice_candidate(request: Request):
    """Handle incoming ICE candidates from the web browser."""
    request_data = await request.json()
    candidates = [
        IceCandidate(
            candidate=c.get("candidate", ""),
            sdp_mid=c.get("sdpMid") or c.get("sdp_mid") or "",
            sdp_mline_index=c.get("sdpMLineIndex") if c.get("sdpMLineIndex") is not None else c.get("sdp_mline_index", 0),
        )
        for c in request_data.get("candidates", [])
    ]
    patch_request = SmallWebRTCPatchRequest(
        pc_id=request_data["pc_id"],
        candidates=candidates,
    )
    await small_webrtc_handler.handle_patch_request(patch_request)
    return {"status": "success"}


@router.get("/session/{session_id}/actions")
def get_session_actions(session_id: str):
    """Fetch any tool actions executed by the voice agent during this session for UI widget rendering."""
    actions = session_executed_actions.get(session_id, [])
    return {
        "status": "success",
        "session_id": session_id,
        "executed_actions": actions
    }


@router.delete("/session/{session_id}")
def end_voice_session(session_id: str):
    """Clean up voice session state."""
    active_voice_sessions.pop(session_id, None)
    session_executed_actions.pop(session_id, None)
    return {"status": "success", "message": f"Session {session_id} ended"}
