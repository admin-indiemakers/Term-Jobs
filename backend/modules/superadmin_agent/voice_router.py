"""Voice Agent Router powered by Sarvam AI (STT & TTS)."""
import os
import json
import httpx
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/voice", tags=["voice"])

SARVAM_API_KEY = os.getenv("SARVAM_AI") or "sk_7wx0x9pf_WncT2BnK0kPQNO0J3TOsp7Ga"


class TTSRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize to speech")
    speaker: str = Field("priya", description="Sarvam AI voice speaker name (e.g. priya, rahul, simran, aditya)")
    language_code: str = Field("en-IN", description="Target language code (e.g. en-IN, hi-IN)")
    pace: float = Field(1.25, description="Speech speed / pace multiplier (default 1.25 for fast conversational speech)")


@router.post("/stt")
async def speech_to_text(
    file: UploadFile = File(...),
    model: str = Form("saaras:v3"),
    language_code: str = Form("en-IN")
):
    """Convert spoken voice recording (audio file) into text transcript via Sarvam AI STT (saaras:v3)."""
    api_key = os.getenv("SARVAM_AI") or SARVAM_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="SARVAM_AI API key not configured")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file payload is empty")

    stt_model = "saaras:v3" if model in ["saarika:v2", "saarika:v1", "saaras:v3"] else model
    print(f"🎙️ [SARVAM STT INCOMING] Filename: {file.filename}, Size: {len(audio_bytes)} bytes, Model: {stt_model}")

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
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, files=files, data=data)
            if resp.status_code != 200:
                print(f"❌ [SARVAM STT ERROR] Status {resp.status_code}: {resp.text}")
                raise HTTPException(status_code=resp.status_code, detail=f"Sarvam STT Error: {resp.text}")

            result = resp.json()
            transcript = result.get("transcript", "")
            print(f"✅ [SARVAM STT SUCCESS] Transcript: \"{transcript}\"")
            return {
                "status": "success",
                "transcript": transcript,
                "language_code": result.get("language_code", language_code)
            }
    except Exception as e:
        print("❌ [SARVAM STT EXCEPTION]:", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tts")
async def text_to_speech(payload: TTSRequest):
    """Synthesize response text into spoken audio WAV base64 string via Sarvam AI TTS (bulbul:v3)."""
    api_key = os.getenv("SARVAM_AI") or SARVAM_API_KEY
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
    print(f"🔊 [SARVAM TTS INCOMING] Text: \"{cleaned_text[:70]}...\", Speaker: {payload.speaker}, Pace: {payload.pace}")

    sarvam_payload = {
        "inputs": [cleaned_text[:500]], # Synthesize up to 500 chars for prompt feedback
        "target_language_code": payload.language_code,
        "speaker": payload.speaker,
        "pitch": 0,
        "pace": max(0.7, min(1.65, payload.pace)), # Fast, natural conversational pace
        "loudness": 1.5,
        "speech_sample_rate": 22050, # High fidelity 22.05kHz audio sample rate
        "enable_preprocessing": True,
        "model": "bulbul:v3"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=sarvam_payload)
            if resp.status_code != 200:
                print(f"❌ [SARVAM TTS ERROR] Status {resp.status_code}: {resp.text}")
                raise HTTPException(status_code=resp.status_code, detail=f"Sarvam TTS Error: {resp.text}")

            result = resp.json()
            audios = result.get("audios", [])
            audio_base64 = audios[0] if audios else None
            print(f"✅ [SARVAM TTS SUCCESS] Base64 Audio length: {len(audio_base64 or '')} bytes")

            return {
                "status": "success",
                "audio_base64": audio_base64
            }
    except Exception as e:
        print("❌ [SARVAM TTS EXCEPTION]:", e)
        raise HTTPException(status_code=500, detail=str(e))
