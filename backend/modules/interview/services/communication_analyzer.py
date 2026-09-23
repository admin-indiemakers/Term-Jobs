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
    def extract_qa_pairs(transcript_turns: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """Extracts structured (question, answer) pairs from transcript turns."""
        pairs = []
        current_q = ""
        current_a_parts = []

        for turn in transcript_turns:
            speaker = str(turn.get("speaker", "")).lower()
            text = str(turn.get("text", "")).strip()
            if not text:
                continue

            if "interviewer" in speaker:
                if current_q and current_a_parts:
                    pairs.append({
                        "question": current_q,
                        "answer": " ".join(current_a_parts).strip(),
                    })
                    current_a_parts = []
                current_q = text
            elif "candidate" in speaker:
                current_a_parts.append(text)

        if current_q and current_a_parts:
            pairs.append({
                "question": current_q,
                "answer": " ".join(current_a_parts).strip(),
            })
        elif current_a_parts and not pairs:
            pairs.append({
                "question": "General Interview Prompt",
                "answer": " ".join(current_a_parts).strip(),
            })

        return pairs

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
                candidate_snippets.append(f"[Interviewer]: {text[:140]}")

        combined = " ".join(candidate_snippets)
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
        Executes Tier 1 (heuristics) + Tier 3 (calibrated LLM call via HTTPX).
        Returns an objective, uninflated communication scorecard (0-100 dynamic range).
        """
        # Collect candidate-only utterances
        candidate_only_snippets = []
        for t in transcript_turns:
            sp = str(t.get("speaker", "candidate")).lower()
            tx = str(t.get("text", "")).strip()
            if tx and "candidate" in sp:
                candidate_only_snippets.append(tx)

        candidate_only_text = " ".join(candidate_only_snippets).strip()
        if not candidate_only_text and transcript_turns:
            candidate_only_text = " ".join(
                [str(t.get("text", "")).strip() for t in transcript_turns if str(t.get("text", "")).strip()]
            ).strip()

        # Tier 1: Local Linguistic Metrics (0 Tokens)
        metrics = cls.extract_linguistic_metrics(candidate_only_text, call_duration_seconds)
        total_words = metrics["total_words"]

        # -------------------------------------------------------------
        # STRICT LENGTH & GIBBERISH PRE-GATING
        # -------------------------------------------------------------
        if total_words < 25:
            # Under 25 words: Candidate said virtually nothing or 1 fragmented sentence
            return {
                "metrics": metrics,
                "analysis": {
                    "relevance_score": 1.0,
                    "substance_score": 1.0,
                    "clarity_score": 2.0,
                    "structure_score": 1.5,
                    "vocabulary_score": 2.0,
                    "confidence_score": 2.0,
                    "overall_score": max(5, min(18, total_words)),
                    "assessment_grade": "Incomplete / Non-Responsive",
                    "key_strengths": ["Candidate initiated the interview session"],
                    "areas_for_improvement": [
                        "Provide full verbal responses; answering in fewer than 25 words is insufficient for evaluation",
                        "Address each question directly with specific technical and career examples",
                    ],
                    "summary": f"{candidate_name} provided minimal or incomplete responses ({total_words} words recorded). This does not meet the minimum substance threshold for evaluation.",
                },
                "token_usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "analyzed_at": datetime.utcnow().isoformat(),
            }

        qa_pairs = cls.extract_qa_pairs(transcript_turns)
        default_analysis = cls._generate_heuristic_assessment(metrics, candidate_name, role_title)
        ai_scores = default_analysis
        token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        # Tier 2: Groq LLM Evaluation via Direct HTTPX (0 external client dependencies)
        try:
            from modules.shared.config import settings
            import os
            import httpx

            groq_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
            if groq_key:
                formatted_qa = ""
                for idx, pair in enumerate(qa_pairs, 1):
                    formatted_qa += f"--- QUESTION {idx} ---\nPrompt: {pair['question']}\nCandidate Answer: {pair['answer']}\n\n"

                if not formatted_qa.strip():
                    formatted_qa = f"Candidate Answer: {candidate_only_text}"

                system_prompt = (
                    "You are a rigorous, calibrated Communication & Spoken Assessment Evaluator for engineering and corporate interviews.\n"
                    "Your evaluation must be STRICT and OBJECTIVE based on the candidate's actual answers to the questions asked.\n\n"
                    "SCORING ANCHORS (Overall Score 0-100):\n"
                    "- 0-25: Gibberish, deflection, non-answers, 'I don't know', off-topic chatter, or fewer than 2 sentences per question.\n"
                    "- 26-45: Superficial, excessively vague answers, evasive replies without technical substance, or major hesitation.\n"
                    "- 46-65: Basic answer with partial relevance, but lacks technical depth, metrics, or clear STAR structure.\n"
                    "- 66-84: Competent, articulate, relevant response with good vocabulary and clear examples.\n"
                    "- 85-98: Exceptional, structured (STAR method), technical depth, fluent delivery with proactive trade-off articulation.\n\n"
                    "MANDATORY EVALUATION RULES:\n"
                    "1. If the candidate says something unrelated to the questions (e.g. casual chatter, test phrases, nonsense), RELEVANCE and SUBSTANCE MUST be 1-2, and OVERALL SCORE MUST BE UNDER 25.\n"
                    "2. Do NOT give polite default scores of 60-75 for poor, brief, or evasive answers.\n"
                    "3. Evaluate both Delivery (cadence, fluency) AND Substance (relevance to prompt, technical depth).\n\n"
                    "Return ONLY valid JSON matching this schema:\n"
                    "{\n"
                    '  "relevance_score": <float 1.0 - 10.0>,\n'
                    '  "substance_score": <float 1.0 - 10.0>,\n'
                    '  "clarity_score": <float 1.0 - 10.0>,\n'
                    '  "structure_score": <float 1.0 - 10.0>,\n'
                    '  "vocabulary_score": <float 1.0 - 10.0>,\n'
                    '  "confidence_score": <float 1.0 - 10.0>,\n'
                    '  "overall_score": <integer 0 - 100>,\n'
                    '  "assessment_grade": <"Exceptional" | "Competent" | "Needs Improvement" | "Unsatisfactory / Irrelevant">,\n'
                    '  "key_strengths": ["string", "string"],\n'
                    '  "areas_for_improvement": ["string", "string"],\n'
                    '  "summary": "2-sentence executive assessment detailing candidate substance and communication quality."\n'
                    "}"
                )

                user_prompt = (
                    f"Candidate Name: {candidate_name}\n"
                    f"Target Position: {role_title}\n"
                    f"Speech Metrics: {metrics['total_words']} total words | {metrics['words_per_minute']} WPM | {metrics['filler_percentage']}% fillers | {metrics['lexical_diversity']} TTR\n\n"
                    f"Interview Transcript Turns:\n{formatted_qa}"
                )

                candidate_models = [
                    settings.groq_default_model or "openai/gpt-oss-120b",
                    "openai/gpt-oss-120b",
                    "openai/gpt-oss-20b",
                    "qwen/qwen3.8-27b",
                ]
                models_to_try = []
                for m in candidate_models:
                    if m and m not in models_to_try:
                        models_to_try.append(m)

                async with httpx.AsyncClient(timeout=15.0) as client:
                    for model_name in models_to_try:
                        try:
                            resp = await client.post(
                                "https://api.groq.com/openai/v1/chat/completions",
                                headers={
                                    "Authorization": f"Bearer {groq_key}",
                                    "Content-Type": "application/json",
                                },
                                json={
                                    "model": model_name,
                                    "messages": [
                                        {"role": "system", "content": system_prompt},
                                        {"role": "user", "content": user_prompt},
                                    ],
                                    "response_format": {"type": "json_object"},
                                    "temperature": 0.1,
                                    "max_tokens": 350,
                                },
                            )
                            if resp.status_code == 200:
                                data = resp.json()
                                content = data["choices"][0]["message"]["content"]
                                parsed = json.loads(content)
                                if isinstance(parsed, dict) and "overall_score" in parsed:
                                    llm_score = int(parsed.get("overall_score", 50))
                                    # Enforce strict length caps as a safety guardrail
                                    if total_words < 50:
                                        llm_score = min(llm_score, 30)
                                    elif total_words < 90:
                                        llm_score = min(llm_score, 55)

                                    ai_scores = {
                                        "relevance_score": float(parsed.get("relevance_score", 5.0)),
                                        "substance_score": float(parsed.get("substance_score", 5.0)),
                                        "clarity_score": float(parsed.get("clarity_score", 5.0)),
                                        "structure_score": float(parsed.get("structure_score", 5.0)),
                                        "vocabulary_score": float(parsed.get("vocabulary_score", 5.0)),
                                        "confidence_score": float(parsed.get("confidence_score", 5.0)),
                                        "overall_score": llm_score,
                                        "assessment_grade": parsed.get("assessment_grade", "Needs Improvement"),
                                        "key_strengths": (parsed.get("key_strengths") or default_analysis["key_strengths"])[:2],
                                        "areas_for_improvement": (parsed.get("areas_for_improvement") or default_analysis["areas_for_improvement"])[:2],
                                        "summary": parsed.get("summary") or default_analysis["summary"],
                                    }
                                    usage = data.get("usage", {})
                                    token_usage = {
                                        "prompt_tokens": usage.get("prompt_tokens", 0),
                                        "completion_tokens": usage.get("completion_tokens", 0),
                                        "total_tokens": usage.get("total_tokens", 0),
                                    }
                                    break
                        except Exception as req_err:
                            logger.warning(f"Groq model {model_name} attempt failed: {req_err}")
                            continue

        except Exception as e:
            logger.warning(f"Groq communication evaluation fallback: {e}")

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
        """
        Calibrated, realistic heuristic assessment without artificial floors.
        Scores strictly reflect substance, length, pace, and clarity (0-100 dynamic range).
        """
        total_words = metrics.get("total_words", 0)
        filler_pct = metrics.get("filler_percentage", 0.0)
        wpm = metrics.get("words_per_minute", 130)
        ttr = metrics.get("lexical_diversity", 0.5)

        # Dynamic length scaling (0.1 to 1.0)
        # Expected interview length for 4 questions: ~180-250 words
        length_factor = min(1.0, max(0.12, total_words / 180.0))

        # Delivery metrics
        clarity = 8.5 if filler_pct <= 2.5 else (6.5 if filler_pct <= 5.0 else 4.0)
        pace_score = 8.5 if 120 <= wpm <= 165 else (6.5 if 100 <= wpm <= 185 else 4.0)
        vocab_score = 8.0 if ttr >= 0.50 else (6.0 if ttr >= 0.35 else 3.5)
        confidence = round((clarity + pace_score) / 2.0, 1)

        # Substance & relevance are bounded by length
        substance = round(min(9.0, max(1.0, (total_words / 22.0))), 1)
        relevance = round(min(9.0, max(1.0, substance * 0.9)), 1)

        # Raw points out of 100
        raw_delivery = (clarity * 0.2 + pace_score * 0.15 + vocab_score * 0.15 + confidence * 0.15 + substance * 0.2 + relevance * 0.15) * 10
        overall = int(round(raw_delivery * length_factor))
        overall = max(5, min(95, overall))

        if overall >= 80:
            grade = "Competent / Strong"
        elif overall >= 55:
            grade = "Adequate"
        elif overall >= 35:
            grade = "Needs Improvement"
        else:
            grade = "Unsatisfactory / Lacks Substance"

        strengths = []
        improvements = []

        if total_words >= 120:
            strengths.append(f"Delivered a substantive verbal response ({total_words} words recorded).")
        if 115 <= wpm <= 165:
            strengths.append(f"Maintained an optimal conversational speech tempo ({wpm} WPM).")
        if filler_pct <= 3.0 and total_words >= 50:
            strengths.append(f"Low filler word usage ({filler_pct}%), demonstrating deliberate delivery.")

        if total_words < 80:
            improvements.append(f"Significantly expand verbal detail (only {total_words} words provided across questions).")
        if filler_pct > 4.0:
            improvements.append(f"Reduce reliance on filler phrases ({filler_pct}% of spoken words).")
        if total_words < 120:
            improvements.append("Use the STAR framework (Situation, Task, Action, Result) to structure answers.")

        if not strengths:
            strengths = ["Participated in the interview dialogue", "Attempted the spoken assessment"]
        if not improvements:
            improvements = ["Continue expanding technical depth and detailing measurable impact"]

        summary = (
            f"{candidate_name} scored {overall}/100 ({grade}) with {total_words} total words spoken. "
            f"Cadence was {metrics.get('pace_rating', 'measured').lower()} with {metrics.get('filler_rating', 'natural delivery').lower()}."
        )

        return {
            "relevance_score": relevance,
            "substance_score": substance,
            "clarity_score": clarity,
            "structure_score": pace_score,
            "vocabulary_score": vocab_score,
            "confidence_score": confidence,
            "overall_score": overall,
            "assessment_grade": grade,
            "key_strengths": strengths[:2],
            "areas_for_improvement": improvements[:2],
            "summary": summary,
        }
