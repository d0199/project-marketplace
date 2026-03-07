#!/usr/bin/env python3
"""
Gym amenities enrichment script.

Reads data/gyms_dynamo.csv, fetches each gym's website via Claude + web tools,
extracts amenities / pricing / member offers, and writes to data/gyms_enriched.csv.

Usage:
    pip install anthropic
    export ANTHROPIC_API_KEY=sk-ant-...
    python scripts/enrich_gyms.py

Resume:  re-running automatically skips already-processed gym IDs.
Filter:  python scripts/enrich_gyms.py --state VIC   (process one state only)
Limit:   python scripts/enrich_gyms.py --limit 50    (process first N gyms)
"""

import argparse
import csv
import json
import os
import sys
import time
from pathlib import Path

# ── Load .env.local ───────────────────────────────────────────────────────────
_env_file = Path(__file__).parent.parent / ".env.local"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

import anthropic

# ── Config ────────────────────────────────────────────────────────────────────
INPUT_CSV  = Path("data/gyms_dynamo.csv")
OUTPUT_CSV = Path("data/gyms_enriched.csv")

MODEL          = "claude-opus-4-6"
MAX_RETRIES    = 3
RATE_LIMIT_S   = 2.0   # seconds between calls (adjust for your API tier)
MAX_CONTINUATIONS = 6  # max pause_turn resume loops per gym

OUTPUT_FIELDS = [
    "id", "name", "addressState", "website",
    "status",                # success | failed | no_website | parse_error
    "min_weekly_price_aud",
    "amenities",             # JSON string
    "member_offers",         # JSON string
    "confidence",            # high | medium | low | no_data
    "error",
]

SYSTEM_PROMPT = """\
You are a gym data enrichment assistant. Your job is to research gym websites \
and extract structured membership information.

Use web_fetch on the provided URL (and follow links to pricing/membership pages if needed). \
Use web_search only if web_fetch fails or yields no useful content.

Your FINAL response must be ONLY valid JSON — no preamble, no explanation, no markdown fences.
Use exactly this schema (all fields required, use null if unknown):

{
  "min_weekly_price_aud": <number or null>,
  "confidence": "high" | "medium" | "low" | "no_data",
  "amenities": {
    "pool": bool,
    "spa": bool,
    "sauna": bool,
    "free_weights": bool,
    "cardio": bool,
    "group_classes": bool,
    "boxing_mma": bool,
    "yoga_pilates": bool,
    "parking": bool,
    "showers": bool,
    "lockers": bool,
    "childcare": bool,
    "cafe": bool,
    "access_247": bool,
    "personal_training": bool
  },
  "member_offers": {
    "no_contract": bool,
    "contract": bool,
    "new_member_trial": bool,
    "referral_scheme": bool,
    "multi_location_access": bool,
    "app": bool
  }
}

confidence levels:
- "high"    = price and most amenities found clearly on the website
- "medium"  = some data found but pricing missing or ambiguous
- "low"     = very little data found, mostly guessing from gym type
- "no_data" = website unreachable or no relevant content found
"""

TOOLS = [
    {"type": "web_search_20260209", "name": "web_search"},
    {"type": "web_fetch_20260209",  "name": "web_fetch"},
]

DEFAULT_RESULT = {
    "min_weekly_price_aud": None,
    "confidence": "no_data",
    "amenities": {
        "pool": False, "spa": False, "sauna": False, "free_weights": False,
        "cardio": False, "group_classes": False, "boxing_mma": False,
        "yoga_pilates": False, "parking": False, "showers": False,
        "lockers": False, "childcare": False, "cafe": False,
        "access_247": False, "personal_training": False,
    },
    "member_offers": {
        "no_contract": False, "contract": False, "new_member_trial": False,
        "referral_scheme": False, "multi_location_access": False, "app": False,
    },
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_processed_ids(path: Path) -> set:
    if not path.exists():
        return set()
    with path.open(newline="", encoding="utf-8") as f:
        return {row["id"] for row in csv.DictReader(f)}


def append_row(path: Path, row: dict):
    is_new = not path.exists()
    with path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_FIELDS, extrasaction="ignore")
        if is_new:
            writer.writeheader()
        writer.writerow(row)


def extract_json(text: str) -> dict | None:
    """Extract JSON object from Claude's response text."""
    text = text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find a JSON object within the text
        start = text.find("{")
        end   = text.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
    return None


def build_prompt(gym: dict) -> str:
    parts = [f"Gym name: {gym['name']}"]
    if gym.get("website"):
        parts.append(f"Website: {gym['website']}")
    if gym.get("addressSuburb"):
        parts.append(f"Location: {gym['addressSuburb']}, {gym.get('addressState', '')}")
    if gym.get("description"):
        parts.append(f"Description: {gym['description'][:400]}")
    return "\n".join(parts)


def call_claude(client: anthropic.Anthropic, gym: dict) -> tuple[str, dict, str | None]:
    """
    Returns (status, result_dict, error_message).
    status: "success" | "parse_error" | "api_error"
    """
    messages = [{"role": "user", "content": build_prompt(gym)}]
    last_content = None

    for _ in range(MAX_CONTINUATIONS):
        response = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        # Collect text from response
        for block in response.content:
            if hasattr(block, "text"):
                last_content = block.text

        if response.stop_reason == "end_turn":
            break

        if response.stop_reason == "pause_turn":
            # Server-side tools hit iteration limit — re-send to continue
            messages = [
                {"role": "user",      "content": build_prompt(gym)},
                {"role": "assistant", "content": response.content},
            ]
            continue

        # Unexpected stop
        break

    if not last_content:
        return "parse_error", DEFAULT_RESULT, "No text in response"

    parsed = extract_json(last_content)
    if not parsed:
        return "parse_error", DEFAULT_RESULT, f"Could not parse JSON: {last_content[:200]}"

    # Merge with defaults so missing keys don't cause KeyErrors downstream
    result = json.loads(json.dumps(DEFAULT_RESULT))  # deep copy
    result.update({k: v for k, v in parsed.items() if k in result})
    if "amenities" in parsed:
        result["amenities"].update(parsed["amenities"])
    if "member_offers" in parsed:
        result["member_offers"].update(parsed["member_offers"])

    return "success", result, None


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Enrich gym data via Claude web tools")
    parser.add_argument("--state",  help="Filter to a single state (e.g. VIC, QLD)")
    parser.add_argument("--limit",  type=int, help="Max gyms to process this run")
    parser.add_argument("--delay",  type=float, default=RATE_LIMIT_S,
                        help=f"Seconds between API calls (default {RATE_LIMIT_S})")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    # Load input CSV
    with INPUT_CSV.open(newline="", encoding="utf-8") as f:
        all_gyms = list(csv.DictReader(f))

    print(f"Loaded {len(all_gyms):,} gyms from {INPUT_CSV}")

    # Apply state filter
    if args.state:
        all_gyms = [g for g in all_gyms if g.get("addressState", "").upper() == args.state.upper()]
        print(f"Filtered to {len(all_gyms):,} gyms in {args.state.upper()}")

    # Skip already-processed
    processed = load_processed_ids(OUTPUT_CSV)
    remaining = [g for g in all_gyms if g["id"] not in processed]
    print(f"Already processed: {len(processed):,}  |  Remaining: {len(remaining):,}")

    # Apply limit
    if args.limit:
        remaining = remaining[:args.limit]
        print(f"Processing first {len(remaining):,} (--limit {args.limit})")

    if not remaining:
        print("Nothing to do.")
        return

    counts = {"success": 0, "failed": 0, "no_website": 0, "parse_error": 0}

    for i, gym in enumerate(remaining, 1):
        name    = gym.get("name", "?")
        website = gym.get("website", "").strip()
        state   = gym.get("addressState", "")

        label = f"[{i:>{len(str(len(remaining)))}}/{len(remaining)}] {name[:55]:<55} ({state})"
        print(label, end=" ... ", flush=True)

        # No website
        if not website:
            append_row(OUTPUT_CSV, {
                "id": gym["id"], "name": name, "addressState": state,
                "website": "", "status": "no_website",
                "min_weekly_price_aud": "", "amenities": "", "member_offers": "",
                "confidence": "", "error": "",
            })
            counts["no_website"] += 1
            print("SKIP (no website)")
            continue

        # Retry loop
        status = "failed"
        result = DEFAULT_RESULT
        error  = None

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                status, result, error = call_claude(client, gym)
                break
            except anthropic.RateLimitError:
                wait = 30 * attempt
                print(f"rate-limited, waiting {wait}s ...", end=" ", flush=True)
                time.sleep(wait)
                error = "rate_limit"
            except anthropic.APIStatusError as e:
                error = f"{e.status_code}: {str(e)[:100]}"
                if attempt < MAX_RETRIES:
                    time.sleep(5 * attempt)
            except Exception as e:
                error = str(e)[:120]
                break

        if status in ("success", "parse_error"):
            counts[status] += 1
        else:
            counts["failed"] += 1

        price = result.get("min_weekly_price_aud")
        price_str = f"${price}/wk" if price else "price=?"
        conf  = result.get("confidence", "?")

        append_row(OUTPUT_CSV, {
            "id":                  gym["id"],
            "name":                name,
            "addressState":        state,
            "website":             website,
            "status":              status,
            "min_weekly_price_aud": price if price is not None else "",
            "amenities":           json.dumps(result["amenities"]),
            "member_offers":       json.dumps(result["member_offers"]),
            "confidence":          conf,
            "error":               error or "",
        })

        tag = "OK" if status == "success" else status.upper()
        print(f"{tag}  {price_str}  conf={conf}")

        if i < len(remaining):
            time.sleep(args.delay)

    # Final summary
    total = sum(counts.values())
    print(f"\n── Done ({'all' if not args.limit else args.limit} gyms processed) ──")
    print(f"  success    : {counts['success']:>5}")
    print(f"  parse_error: {counts['parse_error']:>5}")
    print(f"  no_website : {counts['no_website']:>5}")
    print(f"  failed     : {counts['failed']:>5}")
    print(f"  total      : {total:>5}")
    print(f"\nOutput: {OUTPUT_CSV.resolve()}")


if __name__ == "__main__":
    main()
