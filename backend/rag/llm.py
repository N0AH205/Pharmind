"""
LLM client — provider-agnostic.

Switch providers via the LLM_PROVIDER environment variable:
  - ollama      → local Qwen/Llama via Ollama (default; no API key needed)
  - openai      → OpenAI GPT-4o
  - anthropic   → Anthropic Claude

Phase 2.5: Ollama branch is now fully implemented using the 0.6.x async API.
Phase 3:   pipeline.py calls generate_structured_output().
"""

import json
import os
from typing import Any

import ollama as ollama_sdk
from pydantic import BaseModel

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")


async def generate_structured_output(
    system_prompt: str,
    user_message: str,
    output_schema: type[BaseModel],
) -> dict[str, Any]:
    """
    Send a prompt to the configured LLM and return a dict matching output_schema.

    All providers receive:
      - system_prompt: instructions + JSON schema with SOURCE_N citation format
      - user_message:  labelled context chunks + drug query

    The LLM is instructed to cite using SOURCE_N identifiers only.
    Missing fields must be { "content": null, "missing": true }.
    Fabricating information is explicitly forbidden.
    """
    if LLM_PROVIDER == "ollama":
        return await _call_ollama(system_prompt, user_message, output_schema)
    elif LLM_PROVIDER == "openai":
        return await _call_openai(system_prompt, user_message, output_schema)
    elif LLM_PROVIDER == "anthropic":
        return await _call_anthropic(system_prompt, user_message, output_schema)
    elif LLM_PROVIDER == "gemini":
        return await _call_gemini(system_prompt, user_message, output_schema)
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {LLM_PROVIDER!r}")


async def generate_structured_output_stream(
    system_prompt: str,
    user_message: str,
    output_schema: type[BaseModel],
):
    """
    Stream tokens from local Ollama instance while generating structured output.
    Yields chunks of generated text tokens.
    """
    if LLM_PROVIDER == "ollama":
        client = ollama_sdk.AsyncClient(host=OLLAMA_BASE_URL)
        format_option: Any = "json"
        if output_schema and hasattr(output_schema, "model_json_schema"):
            format_option = output_schema.model_json_schema()

        async for chunk in await client.chat(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            format=format_option,
            stream=True,
            options={
                "temperature": 0.1,
                "num_predict": 8192,
                "num_ctx": 16384,
            },
        ):
            if chunk and chunk.message and chunk.message.content:
                yield chunk.message.content
    else:
        full_res = await generate_structured_output(system_prompt, user_message, output_schema)
        yield json.dumps(full_res)


# ── Ollama (Phase 2.5 / Phase 3) ─────────────────────────────────────────────

async def _call_ollama(
    system_prompt: str,
    user_message: str,
    schema: type[BaseModel],
) -> dict:
    """
    Call local Ollama instance (Qwen, Llama, etc.) using the 0.6.x AsyncClient.

    Passes schema.model_json_schema() to strictly constrain Ollama to the Pydantic schema.
    Temperature 0.1 = factual and deterministic.
    """
    client = ollama_sdk.AsyncClient(host=OLLAMA_BASE_URL)

    format_option: Any = "json"
    if schema and hasattr(schema, "model_json_schema"):
        format_option = schema.model_json_schema()

    response = await client.chat(
        model=OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
        format=format_option,
        options={
            "temperature": 0.1,
            "num_predict": 8192,  # Expanded schema needs ~6-8k tokens
            "num_ctx": 16384,     # Ensure context window fits prompt + output
        },
    )

    raw: str = response.message.content
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Ollama returned invalid JSON: {exc}\nRaw output (first 500 chars):\n{raw[:500]}"
        ) from exc


# ── OpenAI (optional) ─────────────────────────────────────────────────────────

async def _call_openai(
    system_prompt: str,
    user_message: str,
    schema: type[BaseModel],
) -> dict:
    """
    Call OpenAI API with JSON mode.
    Requires: pip install openai  and  OPENAI_API_KEY env var.
    """
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise ImportError("Run: pip install openai") from None

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    resp = await client.chat.completions.create(
        model=OPENAI_MODEL,
        response_format={"type": "json_object"},
        temperature=0.1,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
    )
    raw = resp.choices[0].message.content
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"OpenAI returned invalid JSON: {exc}") from exc


# ── Anthropic (optional) ──────────────────────────────────────────────────────

async def _call_anthropic(
    system_prompt: str,
    user_message: str,
    schema: type[BaseModel],
) -> dict:
    """
    Call Anthropic Claude API.
    Requires: pip install anthropic  and  ANTHROPIC_API_KEY env var.
    """
    try:
        import anthropic
    except ImportError:
        raise ImportError("Run: pip install anthropic") from None

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    msg = await client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    raw = msg.content[0].text
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Anthropic returned invalid JSON: {exc}") from exc


# ── Google Gemini (optional) ──────────────────────────────────────────────────

async def _call_gemini(
    system_prompt: str,
    user_message: str,
    schema: type[BaseModel],
) -> dict:
    """
    Call Google Gemini API with JSON mode.
    Requires: httpx  and  GEMINI_API_KEY env var.
    """
    import httpx

    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": user_message}
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {"text": system_prompt}
            ]
        },
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
        }
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    try:
        raw = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise ValueError(f"Gemini API returned unexpected response format: {data}") from exc

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Gemini returned invalid JSON: {exc}\nRaw output (first 500 chars):\n{raw[:500]}"
        ) from exc
