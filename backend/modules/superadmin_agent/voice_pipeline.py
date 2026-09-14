"""Super Admin Real-Time Voice Pipeline powered by Pipecat AI, Sarvam STT/TTS, and Groq.

Provides full-duplex WebRTC streaming, Silero VAD barge-in interruptions, dynamic Groq key
rotation, spoken audio latency fillers, and real-time RTVI widget action dispatching.
Preserves all 25 SuperAdmin platform tools with zero breaking changes.
"""
import json
import os
import re
import asyncio
import uuid
from typing import AsyncGenerator

from loguru import logger
from openai import RateLimitError, AuthenticationError, NotFoundError

from pipecat.frames.frames import Frame, TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.services.groq.llm import GroqLLMService
from pipecat.services.sarvam.stt import SarvamSTTService, SarvamSTTSettings
from pipecat.services.sarvam.tts import SarvamTTSService, SarvamTTSSettings
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.request_handler import SmallWebRTCRequestHandler
from pipecat.transports.base_transport import TransportParams
from pipecat.processors.aggregators.llm_context import LLMContext, ToolsSchema
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.processors.frameworks.rtvi import RTVIProcessor
from pipecat.adapters.schemas.function_schema import FunctionSchema

from .groq_manager import get_next_groq_key
from .agent import TOOLS, TOOL_MAP

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

# Shared WebRTC handler with Google STUN server
small_webrtc_handler = SmallWebRTCRequestHandler(ice_servers=["stun:stun.l.google.com:19302"])

# Active session tracking and executed actions memory for web client sync
active_voice_sessions: dict[str, dict] = {}
session_executed_actions: dict[str, list] = {}


# ==============================================================================
# Groq LLM Service with Dynamic Key Rotation & Model Failover
# ==============================================================================
class RotatableGroqLLMService(GroqLLMService):
    """Groq LLM Service that automatically rotates API keys on 429 / Auth errors."""

    async def get_chat_completions(self, context) -> any:
        for attempt in range(5):
            try:
                return await super().get_chat_completions(context)
            except (RateLimitError, AuthenticationError) as e:
                next_key = get_next_groq_key()
                logger.warning(f"Groq API error ({e}). Rotating to next key (attempt {attempt + 1})...")
                self._client = self.create_client(api_key=next_key, base_url=str(self._client.base_url))
                if attempt == 4:
                    raise e
            except NotFoundError as e:
                logger.error(f"Groq Model not found ({e}). Falling back to 'openai/gpt-oss-120b'...")
                self._settings.model = "openai/gpt-oss-120b"
                return await super().get_chat_completions(context)


# ==============================================================================
# TTS Text Sanitization
# ==============================================================================
def clean_tts_text(text: str) -> str:
    """Strip markdown formatting, lone punctuation, emojis, and non-spoken symbols for clean speech synthesis."""
    if not text:
        return ""
    # Strip markdown symbols: asterisks, underscores, backticks, hashtags, tildes
    cleaned = re.sub(r"[*_`#~>]", "", text).strip()
    # Strip markdown URL patterns [text](url) -> text
    cleaned = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", cleaned)
    # Strip emojis that disrupt speech synthesis or cause weird pronunciations
    cleaned = re.sub(r"[\U00010000-\U0010ffff]", "", cleaned)
    # Strip solitary punctuation
    if re.fullmatch(r"[.,!?;:\-—–\"\'\(\)\[\]\s]+", cleaned):
        return ""
    return cleaned.strip()


class CleanedSarvamTTSService(SarvamTTSService):
    """Sarvam TTS with text pre-cleaning to prevent synthesizer stutter or syntax crashes."""

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame | None, None]:
        cleaned = clean_tts_text(text)
        if cleaned:
            async for frame in super().run_tts(cleaned, context_id):
                yield frame


# ==============================================================================
# Conversational Spoken Latency Fillers
# ==============================================================================
SPOKEN_FILLERS = {
    "get_platform_stats": "Right away! Gathering your live platform metrics now.",
    "list_tenants": "Certainly! Fetching the directory of registered companies and vendors for you.",
    "get_tenant_details": "Of course! Pulling up the organization details.",
    "draft_onboarding_preview": "I would be glad to! Preparing the onboarding preview card now.",
    "onboard_client_company": "Registering the client company on the platform.",
    "onboard_vendor_consultancy": "Registering the vendor partner on the platform.",
    "list_admin_accounts": "Fetching administrator accounts for you right away.",
    "create_user_account": "Setting up the new user account now.",
    "list_archives": "Loading archived platform records for you.",
    "draft_tenant_deletion": "Preparing the deletion confirmation card for your review.",
    "delete_tenant": "Processing tenant removal.",
    "list_vendor_engagements": "Checking active vendor partnerships right away.",
    "engage_vendor": "Linking the vendor consultancy partner.",
    "list_hiring_requisitions": "Right on it! Loading all active job requisitions.",
    "list_requisitions_by_vendor": "Certainly! Fetching job requisitions for this vendor partner.",
    "draft_hiring_requisition": "Drafting the job requisition preview card for your review.",
    "create_hiring_requisition": "Publishing the job requisition now.",
    "list_shortlisted_candidates": "Certainly! Fetching shortlisted candidates for you.",
    "list_candidates_by_vendor": "Loading candidate submissions under this vendor.",
    "get_candidate_resume": "Sure! Loading the resume and candidate evaluation directly into your viewer.",
    "query_database_all_entities": "Right away! Performing a full platform database inspection.",
    "schedule_candidate_interview": "Preparing the interview proposal schedule card.",
    "list_onboarding_issues": "Checking onboarding status and reported issues right now.",
    "draft_password_change": "Preparing the password change preview card for your review.",
    "update_user_password": "Updating the user password now.",
}


async def play_spoken_filler(params, tool_name: str):
    """Queue immediate spoken filler audio while database/tool execution runs."""
    task = params.app_resources.get("task")
    if not task:
        return
    filler_text = SPOKEN_FILLERS.get(tool_name, "One moment please, checking that for you.")
    try:
        await task.queue_frame(TTSSpeakFrame(filler_text))
    except Exception as e:
        logger.debug(f"Spoken filler notice could not be queued: {e}")


# ==============================================================================
# System Prompt & Tools Schema Builders
# ==============================================================================
def create_superadmin_voice_system_prompt(user_name: str = "Super Admin") -> str:
    return (
        f"You are the TermJobs Super Admin Executive AI Voice Partner, speaking directly with {user_name}.\n"
        "You possess complete administrative authority and full database access across all TermJobs entities (tenants, buyer companies, vendor consultancies, user accounts, requisitions, candidates, engagements, and system archives).\n\n"
        "HUMAN-LIKE VOICE & EMOTIONAL EXPRESSION GUIDELINES:\n"
        "- Personality: Warm, polite, empathetic, articulate, and formally professional—like an elite executive Chief of Staff.\n"
        "- Tone & Cadence: Speak with genuine vocal warmth, enthusiasm, and helpfulness. Convey personality and natural emotion instead of speaking robotically.\n"
        "- Greetings: When the user says 'Hi', 'Hello', or greets you, respond warmly and courteously! For example: 'Hello! It is a pleasure to connect with you. How can I assist you with the platform today?'\n"
        "- Conversational Phrasing: Use courteous, natural conversational openers ('Certainly!', 'I would be glad to help with that', 'Right away!', 'Here is what we have'), and graceful transitions.\n"
        "- Positive Reassurance: When executing queries or managing tenants, speak encouragingly ('I have gathered that for you', 'Everything looks in great shape').\n"
        "- Brevity & Flow: Keep spoken answers natural, friendly, and concise (1 to 2 articulate sentences). Never read aloud raw JSON blobs, markdown tables, asterisks, bullet points, or code blocks.\n"
        "- Visual Collaboration: When data is retrieved, politely guide the user's attention to their right Output Display panel.\n\n"
        "SUPER ADMIN KING PRIVILEGES:\n"
        "1. If asked for job requisitions created by/under a vendor, call `list_requisitions_by_vendor` (or `list_hiring_requisitions`).\n"
        "2. If asked for candidates submitted by/under a vendor, call `list_candidates_by_vendor` (or `list_shortlisted_candidates`).\n"
        "3. If asked for full DB access or system controller overview, call `query_database_all_entities`.\n\n"
        "SAFETY & CONFIRMATION PROTOCOLS:\n"
        "- Password Change: Call `draft_password_change` first. Only call `update_user_password` after user confirms.\n"
        "- Tenant Onboarding: Call `draft_onboarding_preview` first. Only execute onboarding after user confirms.\n"
        "- Tenant Deletion: Call `draft_tenant_deletion` first. Only execute deletion after user confirms."
    )


def build_superadmin_tools_schema() -> ToolsSchema:
    """Convert all 25 SuperAdmin TOOLS definitions into Pipecat FunctionSchema format."""
    schemas = []
    for t in TOOLS:
        fn = t.get("function", {})
        params = fn.get("parameters", {})
        schemas.append(
            FunctionSchema(
                name=fn["name"],
                description=fn.get("description", ""),
                properties=params.get("properties", {}),
                required=params.get("required", [])
            )
        )
    return ToolsSchema(standard_tools=schemas)


# ==============================================================================
# SuperAdmin Tool Handler Registration
# ==============================================================================
def register_superadmin_tools(
    llm: RotatableGroqLLMService,
    session_id: str,
    rtvi: RTVIProcessor = None,
    webrtc_connection: SmallWebRTCConnection = None
):
    """Register all 25 SuperAdmin tools onto the Pipecat LLM service."""

    def make_handler(tool_name: str, tool_fn):
        async def tool_handler(params):
            logger.info(f"⚙️ [VOICE TOOL CALLED] {tool_name} with args: {params.arguments}")
            # 1. Play spoken filler audio immediately
            await play_spoken_filler(params, tool_name)

            # 2. Execute underlying database tool function
            try:
                args = params.arguments or {}
                # Run synchronous DB tool in executor to prevent blocking the async audio loop
                loop = asyncio.get_running_loop()
                result = await loop.run_in_executor(None, lambda: tool_fn(**args))
            except Exception as e:
                logger.error(f"Error executing tool {tool_name}: {e}")
                result = {"status": "error", "error": str(e)}

            action_data = {
                "tool": tool_name,
                "args": params.arguments,
                "result": result
            }

            # Pre-serialize to pure JSON primitive types (strings, ints, dicts, lists)
            # This completely eliminates 'Object of type datetime is not JSON serializable' errors
            clean_action_data = json.loads(json.dumps(action_data, default=str))

            # 3. Store action for session and dispatch down data channels to web UI
            if session_id in session_executed_actions:
                session_executed_actions[session_id].append(clean_action_data)

            if webrtc_connection:
                try:
                    webrtc_connection.send_app_message({
                        "type": "widget_action",
                        "session_id": session_id,
                        "action": clean_action_data
                    })
                    logger.info(f"📤 Dispatched direct WebRTC widget_action for {tool_name}")
                except Exception as direct_ex:
                    logger.debug(f"Direct data channel message send note: {direct_ex}")

            if rtvi:
                try:
                    await rtvi.send_server_message({
                        "type": "widget_action",
                        "session_id": session_id,
                        "action": clean_action_data
                    })
                    logger.info(f"📤 Dispatched RTVI widget_action for {tool_name} to web client")
                except Exception as ex:
                    logger.debug(f"Could not send RTVI server message: {ex}")

            # 4. Formulate spoken summary response for the LLM
            spoken_summary = _generate_spoken_summary(tool_name, args, result)
            await params.result_callback(spoken_summary)

        return tool_handler

    for name, fn in TOOL_MAP.items():
        llm.register_function(name, make_handler(name, fn))


def _generate_spoken_summary(tool_name: str, args: dict, result: dict) -> str:
    """Generate a clean, spoken-friendly summary for the LLM to synthesize."""
    status = result.get("status") if isinstance(result, dict) else ""
    if status == "error":
        err_msg = result.get("error") or result.get("message") or "Unknown error"
        return f"There was an issue processing {tool_name.replace('_', ' ')}: {err_msg}."

    if tool_name == "get_platform_stats":
        return (
            f"Platform metrics retrieved: {result.get('client_companies', 0)} buyer companies, "
            f"{result.get('vendor_consultancies', 0)} vendor partners, and {result.get('total_users', 0)} users. "
            "System is fully operational, and details are on your display panel."
        )
    elif tool_name in ("list_tenants", "get_tenant_details"):
        return "I've pulled up the company profiles and loaded them into your display panel."
    elif tool_name == "draft_onboarding_preview":
        c_name = result.get("company_name", "the organization")
        return f"I've generated the onboarding draft form for {c_name}. Please review the details on your display panel and confirm."
    elif tool_name in ("onboard_client_company", "onboard_vendor_consultancy"):
        c_name = result.get("company_name") or result.get("vendor_name") or "organization"
        return f"Successfully onboarded {c_name}. The credentials and confirmation are on your display panel."
    elif tool_name in ("list_hiring_requisitions", "list_requisitions_by_vendor"):
        count = result.get("total_requisitions", len(result.get("requisitions", [])))
        return f"I found {count} active job requisitions and loaded the breakdown onto your analytics panel."
    elif tool_name in ("list_shortlisted_candidates", "list_candidates_by_vendor"):
        count = result.get("total_candidates", len(result.get("candidates", [])))
        return f"Found {count} candidate submissions. The full candidate roster is now displayed on your analytics panel."
    elif tool_name == "get_candidate_resume":
        c_name = result.get("candidate_name", "the candidate")
        return f"Here is the evaluation profile and resume document for {c_name}, loaded directly into your document viewer."
    elif tool_name == "draft_password_change":
        u_name = result.get("user_name", "the user")
        return f"I have prepared the password change confirmation card for {u_name} on your right panel. Please confirm to execute."
    elif tool_name == "update_user_password":
        return "The account password has been updated successfully."
    elif tool_name == "draft_tenant_deletion":
        t_name = result.get("tenant_name", "the organization")
        return f"I've prepared the tenant deletion profile card for {t_name} on your right panel. Please review and confirm."
    elif tool_name == "delete_tenant":
        return "Tenant and associated records have been removed."
    elif tool_name == "query_database_all_entities":
        return "Direct database inspection complete. The system records are now loaded on your display panel."
    elif tool_name == "schedule_candidate_interview":
        return "Interview proposal card has been generated on your right display panel."
    elif tool_name == "list_onboarding_issues":
        return "Candidate onboarding pipeline loaded onto your display panel."

    return "Action completed successfully, and I've updated your right Output Display panel."


# ==============================================================================
# WebRTC Bot Runner
# ==============================================================================
async def run_superadmin_webrtc_bot(webrtc_connection: SmallWebRTCConnection, session_id: str, user_name: str = "Super Admin"):
    """Run real-time Pipecat voice pipeline over SmallWebRTC connection for web browser."""
    logger.info(f"🚀 [WEBRTC BOT STARTING] Session {session_id} for {user_name} (pc_id={webrtc_connection.pc_id})")

    session_executed_actions[session_id] = []
    active_voice_sessions[session_id] = {
        "user_name": user_name,
        "connection": webrtc_connection,
        "created_at": asyncio.get_running_loop().time()
    }

    # AIC (ai-coustics) Speech Enhancement & Noise Reduction Filter
    aic_license_key = os.getenv("AIC_LICENSE_KEY") or os.getenv("AIC_SDK_KEY")
    audio_in_filter = None
    if aic_license_key:
        try:
            from pipecat.audio.filters.aic_filter import AICFilter
            audio_in_filter = AICFilter(license_key=aic_license_key)
            logger.info("🛡️ [AIC FILTER ACTIVE] AI-Coustics neural noise filter engaged.")
        except Exception as e:
            logger.warning(f"Could not initialize AICFilter: {e}")
    else:
        logger.info("ℹ️ AIC Filter available. Browser hardware AEC & noise suppression active (set AIC_LICENSE_KEY in .env to engage neural filter).")

    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            audio_in_sample_rate=16000,
            audio_out_sample_rate=22050,
            audio_in_filter=audio_in_filter,
        )
    )

    rtvi = RTVIProcessor(transport=transport)

    sarvam_stt_key = get_sarvam_stt_key()
    sarvam_tts_key = get_sarvam_tts_key()

    # 1. Speech-to-Text: Sarvam saaras:v3 (Dedicated STT key)
    stt = SarvamSTTService(
        api_key=sarvam_stt_key,
        settings=SarvamSTTSettings(
            model="saaras:v3",
            language="en-IN"
        )
    )

    # 2. LLM: Groq with automatic key rotation and model resilience (using ultra-fast llama-3.3-70b-versatile for voice)
    active_key = get_next_groq_key()
    voice_model = os.getenv("GROQ_VOICE_MODEL") or "llama-3.3-70b-versatile"
    llm = RotatableGroqLLMService(
        api_key=active_key,
        settings=GroqLLMService.Settings(
            model=voice_model
        )
    )

    # Register all 25 platform tools onto the LLM
    register_superadmin_tools(llm, session_id=session_id, rtvi=rtvi, webrtc_connection=webrtc_connection)

    # 3. Text-to-Speech: Cleaned Sarvam bulbul:v3 with warm, human pace and pitch (Dedicated TTS key)
    tts = CleanedSarvamTTSService(
        api_key=sarvam_tts_key,
        settings=SarvamTTSSettings(
            model="bulbul:v3",
            voice="priya",
            pace=1.05,
            language="en-IN",
            loudness=1.3
        ),
        push_silence_after_stop=True,
        silence_time_s=0.2
    )

    # 4. Context & Tools Schema
    messages = [
        {
            "role": "system",
            "content": create_superadmin_voice_system_prompt(user_name)
        }
    ]
    context = LLMContext(messages)
    context.set_tools(build_superadmin_tools_schema())
    context.set_tool_choice("auto")

    # 5. Silero VAD configured with robust thresholds to prevent false ambient-noise interruptions
    vad_analyzer = SileroVADAnalyzer(
        params=VADParams(
            confidence=0.7,
            start_secs=0.2,
            stop_secs=0.35,
            min_volume=0.5
        )
    )

    context_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=vad_analyzer
        )
    )

    # 6. Construct Pipeline
    pipeline = Pipeline([
        transport.input(),
        rtvi,
        stt,
        context_aggregator.user(),
        llm,
        tts,
        transport.output(),
        context_aggregator.assistant()
    ])

    resources = {"session_id": session_id}
    task = PipelineTask(
        pipeline,
        app_resources=resources,
        enable_rtvi=True,
        rtvi_processor=rtvi,
        observers=[rtvi.create_rtvi_observer()],
        enable_turn_tracking=True
    )
    resources["task"] = task

    @rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi_proc):
        logger.info(f"✅ RTVI client ready for session {session_id}! Greeting Super Admin.")
        await task.queue_frames([
            TTSSpeakFrame(f"Hello {user_name}! I am your TermJobs Super Admin Voice Assistant. How can I assist you with the platform today?")
        ])

    runner = PipelineRunner()
    try:
        await runner.run(task)
    except Exception as e:
        logger.error(f"Error in WebRTC voice runner session {session_id}: {e}")
    finally:
        active_voice_sessions.pop(session_id, None)
        logger.info(f"🛑 [WEBRTC BOT ENDED] Session {session_id}")
