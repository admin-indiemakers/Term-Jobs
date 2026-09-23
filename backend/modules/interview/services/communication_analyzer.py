"""
Communication Skills & Spoken Language Analyzer.
Combines 0-token deterministic linguistic heuristics (WPM, filler detection, lexical diversity)
with a single-pass, token-minimized Groq LLM evaluation for interview rounds.
"""
import re
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Standard filler words and hesitation phrases
FILLER_WORDS = [
    r"\bum+\b",
    r"\buh+\b",
    r"\bah+\b",
    r"\blike\b",
    r"\byou know\b",
    r"\bbasically\b",
    r"\bliterally\b",
    r"\bsort of\b",
    r"\bkind of\b",
    r"\bactually\b",
    r"\bi mean\b",
    r"\bto be honest\b",
    r"\bright\b",
    r"\bso yeah\b",
]
FILLER_REGEX = re.compile(r"|".join(FILLER_WORDS), re.IGNORECASE)


class CommunicationAnalyzer:
    """Zero-token heuristic extraction and compact single-pass LLM communication analysis."""

    @staticmethod
    def extract_linguistic_metrics(
        candidate_text: str, duration_seconds: int = 0
    ) -> Dict[str, Any]:
        """Calculates deterministic speech and communication metrics without using any LLM tokens."""
        if not candidate_text or not candidate_text.strip():
            return {
                "total_words": 0,
                "duration_seconds": duration_seconds,
                "words_per_minute": 0,
                "pace_rating": "Insufficient Speech Data",
                "filler_count": 0,
                "filler_percentage": 0.0,
                "filler_rating": "N/A",
                "top_fillers": {},
                "unique_words": 0,
                "lexical_diversity": 0.0,
                "vocabulary_rating": "N/A",
                "sentence_count": 0,
                "avg_sentence_length": 0.0,
            }

        # Normalize text and extract words
        clean_text = candidate_text.strip()
        words = re.findall(r"\b[a-zA-Z']+\b", clean_text)
        total_words = len(words)
        lower_words = [w.lower() for w in words]

        # Duration & Words Per Minute (WPM)
        duration_minutes = max(duration_seconds / 60.0, 0.25) if duration_seconds > 0 else max(total_words / 130.0, 0.25)
        wpm = round(total_words / duration_minutes, 1)

        if wpm < 110:
            pace_rating = "Deliberate / Slow Pace"
        elif 110 <= wpm <= 165:
            pace_rating = "Optimal / Clear Pace"
        elif 166 <= wpm <= 195:
            pace_rating = "Brisk / Energetic Pace"
        else:
            pace_rating = "Rapid / Rushed Pace"

        # Filler Word Analysis
        filler_matches = FILLER_REGEX.findall(clean_text)
        filler_count = len(filler_matches)
        filler_percentage = round((filler_count / max(total_words, 1)) * 100, 1)

        # Count occurrences of top fillers
        top_fillers: Dict[str, int] = {}
        for match in filler_matches:
            cleaned = match.lower().strip()
            top_fillers[cleaned] = top_fillers.get(cleaned, 0) + 1
        sorted_top_fillers = dict(
            sorted(top_fillers.items(), key=lambda item: item[1], reverse=True)[:5]
        )

        if filler_percentage <= 2.5:
            filler_rating = "Minimal Fillers (Highly Articulate)"
        elif filler_percentage <= 5.0:
            filler_rating = "Moderate Fillers (Natural)"
        else:
            filler_rating = "Elevated Fillers (Needs Polish)"

        # Lexical Diversity (Type-Token Ratio TTR)
        unique_words = len(set(lower_words))
        ttr = round(unique_words / max(total_words, 1), 2)
        if ttr >= 0.55:
            vocabulary_rating = "Rich & Varied Lexicon"
        elif ttr >= 0.38:
            vocabulary_rating = "Balanced Professional Vocabulary"
        else:
            vocabulary_rating = "Repetitive Phrasing"

        # Sentence structure
        sentences = [s for s in re.split(r"[.!?]+", clean_text) if s.strip()]
        sentence_count = max(len(sentences), 1)
        avg_sentence_length = round(total_words / sentence_count, 1)

        return {
            "total_words": total_words,
            "duration_seconds": duration_seconds,
            "words_per_minute": wpm,
            "pace_rating": pace_rating,
            "filler_count": filler_count,
            "filler_percentage": filler_percentage,
            "filler_rating": filler_rating,
            "top_fillers": sorted_top_fillers,
            "unique_words": unique_words,
            "lexical_diversity": ttr,
            "vocabulary_rating": vocabulary_rating,
            "sentence_count": sentence_count,
            "avg_sentence_length": avg_sentence_length,
        }

    @staticmethod
    def sanitize_and_compress_transcript(transcript_turns: List[Dict[str, Any]]) -> str:
        """
        Compresses conversation turns into a sanitized candidate monologue/dialogue excerpt.
        Filters empty turns and clips long rambling while preserving core articulation.
        """
        candidate_snippets = []
        for turn in transcript_turns:
            speaker = str(turn.get("speaker", "candidate")).lower()
            text = str(turn.get("text", "")).strip()
            if not text:
                continue
            if "candidate" in speaker:
                candidate_snippets.append(text)
            elif "interviewer" in speaker:
                # Keep interviewer questions very brief for context
                candidate_snippets.append(f"[Interviewer]: {text[:120]}")

        combined = " ".join(candidate_snippets)
        # Limit to 1,500 words to ensure minimal LLM token consumption (~500 input tokens max)
        words = combined.split()
        if len(words) > 1500:
            words = words[:1500]
            combined = " ".join(words) + " ... [transcript clipped for evaluation]"
        return combined

    @classmethod
    async def evaluate_communication(
        cls,
        transcript_turns: List[Dict[str, Any]],
        call_duration_seconds: int = 0,
        candidate_name: str = "Candidate",
        role_title: str = "Software Professional",
    ) -> Dict[str, Any]:
        """
        Executes Tier 1 (heuristics) + Tier 3 (single-pass compact LLM call).
        Returns complete communication scorecard with radar scores and bullet feedback.
        """
        # Collect only candidate utterances for metric calculations
        candidate_only_text = " ".join(
            [
                str(t.get("text", ""))
                for t in transcript_turns
                if "candidate" in str(t.get("speaker", "candidate")).lower()
            ]
        ).strip()

        # If no speaker labels were specified, use all text
        if not candidate_only_text and transcript_turns:
            candidate_only_text = " ".join(
                [str(t.get("text", "")) for t in transcript_turns]
            ).strip()

        # Tier 1: Local Linguistic Metrics (0 Tokens)
        metrics = cls.extract_linguistic_metrics(
            candidate_only_text, call_duration_seconds
        )

        # Prepare default fallback evaluation if text is very short or LLM fails
        default_analysis = cls._generate_heuristic_assessment(
            metrics, candidate_name, role_title
        )

        if metrics["total_words"] < 25:
            # Not enough spoken content to justify an LLM call; return heuristic base
            return {
                "metrics": metrics,
                "analysis": default_analysis,
                "token_usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            }

        # Tier 2: Sanitize & Compress transcript for compact LLM prompt
        compressed_text = cls.sanitize_and_compress_transcript(transcript_turns)

        # Tier 3: Single-Pass Minimal JSON LLM Call via Groq
        token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        ai_scores = default_analysis

        try:
            from modules.shared.config import settings
            import os

            groq_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
            if groq_key:
                from openai import AsyncOpenAI

                client = AsyncOpenAI(
                    api_key=groq_key,
                    base_url=settings.groq_base_url or "https://api.groq.com/openai/v1",
                )

                system_prompt = (
                    "You are a strict, objective Communication Skills & Speech Assessor for technical/business interviews. "
                    "Analyze the candidate's spoken speech transcript. Evaluate communication only (clarity, structure, vocabulary, confidence), NOT factual code correctness. "
                    "Return ONLY valid JSON matching this schema:\n"
                    "{\n"
                    '  "clarity_score": <number 1-10>,\n'
                    '  "structure_score": <number 1-10>,\n'
                    '  "vocabulary_score": <number 1-10>,\n'
                    '  "confidence_score": <number 1-10>,\n'
                    '  "overall_score": <number 1-100>,\n'
                    '  "key_strengths": ["string", "string"],\n'
                    '  "areas_for_improvement": ["string", "string"],\n'
                    '  "summary": "1-2 sentence executive assessment"\n'
                    "}"
                )

                user_prompt = (
                    f"Candidate: {candidate_name} | Target Role: {role_title}\n"
                    f"Observed Pace: {metrics['words_per_minute']} WPM ({metrics['pace_rating']})\n"
                    f"Filler Words: {metrics['filler_count']} ({metrics['filler_percentage']}%) | Diversity: {metrics['lexical_diversity']}\n"
                    f"Spoken Transcript Excerpt:\n\"\"\"{compressed_text}\"\"\""
                )

                response = await client.chat.completions.create(
                    model=settings.groq_default_model or "openai/gpt-oss-20b",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    max_tokens=250,
                )

                content = response.choices[0].message.content
                parsed = json.loads(content)
                if isinstance(parsed, dict) and "overall_score" in parsed:
                    ai_scores = {
                        "clarity_score": float(parsed.get("clarity_score", 7.0)),
                        "structure_score": float(parsed.get("structure_score", 7.0)),
                        "vocabulary_score": float(parsed.get("vocabulary_score", 7.0)),
                        "confidence_score": float(parsed.get("confidence_score", 7.0)),
                        "overall_score": int(parsed.get("overall_score", 70)),
                        "key_strengths": parsed.get("key_strengths", default_analysis["key_strengths"])[:2],
                        "areas_for_improvement": parsed.get("areas_for_improvement", default_analysis["areas_for_improvement"])[:2],
                        "summary": parsed.get("summary", default_analysis["summary"]),
                    }

                if response.usage:
                    token_usage = {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens,
                    }
        except Exception as e:
            logger.warning(f"Groq single-pass communication evaluation failed or skipped: {e}. Utilizing linguistic heuristics.")

        return {
            "metrics": metrics,
            "analysis": ai_scores,
            "token_usage": token_usage,
            "analyzed_at": datetime.utcnow().isoformat(),
        }

    @staticmethod
    def _generate_heuristic_assessment(
        metrics: Dict[str, Any], candidate_name: str, role_title: str
    ) -> Dict[str, Any]:
        """Provides a robust, zero-token communication assessment based on heuristic metrics."""
        filler_pct = metrics.get("filler_percentage", 0.0)
        wpm = metrics.get("words_per_minute", 130)
        ttr = metrics.get("lexical_diversity", 0.5)

        # Baseline scores derived from speech signals
        clarity = 8.5 if filler_pct <= 2.5 else (7.0 if filler_pct <= 5.0 else 5.5)
        pace_score = 9.0 if 120 <= wpm <= 165 else (7.5 if 100 <= wpm <= 185 else 6.0)
        vocab_score = 8.5 if ttr >= 0.50 else (7.0 if ttr >= 0.35 else 5.5)
        confidence = round((clarity + pace_score) / 2.0, 1)

        overall = int(round((clarity * 0.3 + pace_score * 0.25 + vocab_score * 0.25 + confidence * 0.2) * 10))

        strengths = []
        improvements = []

        if 115 <= wpm <= 165:
            strengths.append(f"Maintained an optimal speech tempo ({wpm} WPM) ensuring clear comprehension.")
        else:
            improvements.append(f"Regulate speaking pace (currently {wpm} WPM) to stay in the ideal 130-160 WPM cadence.")

        if filler_pct <= 3.0:
            strengths.append(f"Articulate delivery with low filler word frequency ({filler_pct}%).")
        else:
            top_filler_str = ", ".join(list(metrics.get("top_fillers", {}).keys())[:3])
            improvements.append(f"Reduce reliance on filler crutches ({filler_pct}%), notably '{top_filler_str}'.")

        if ttr >= 0.45:
            strengths.append("Demonstrated rich lexical variety and professional domain vocabulary.")
        elif len(improvements) < 2:
            improvements.append("Incorporate more varied professional terminology to strengthen technical explanations.")

        if not strengths:
            strengths = ["Participated actively in the dialogue", "Demonstrated willingness to communicate ideas"]
        if not improvements:
            improvements = ["Continue practicing structured responses (Situation-Task-Action-Result format)"]

        return {
            "clarity_score": clarity,
            "structure_score": pace_score,
            "vocabulary_score": vocab_score,
            "confidence_score": confidence,
            "overall_score": overall,
            "key_strengths": strengths[:2],
            "areas_for_improvement": improvements[:2],
            "summary": f"{candidate_name} demonstrated {metrics['pace_rating'].lower()} with {metrics['filler_rating'].lower()}.",
        }
