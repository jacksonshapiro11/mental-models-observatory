#!/usr/bin/env python3
"""
Extract insights from published briefs for novelty comparison.

Parses a Daily Brief markdown file and extracts:
- Section-level lead bullets (the thesis/insight, not the data)
- Take topic and framework
- Crypto bullets classified as Dashboard-grade vs Six-grade
- Topic mention counts

Usage:
    python extract_insights.py <brief_path>
    python extract_insights.py --compare <draft_path> <brief1> <brief2> <brief3>
    python extract_insights.py --map <brief1> <brief2> <brief3> [brief4] [brief5]
"""

import re
import sys
import json
import os
from datetime import datetime
from pathlib import Path


def extract_date(content: str) -> str:
    """Extract the brief date from the header."""
    match = re.search(r'## \w+, (\w+ \d+, \d{4})', content)
    return match.group(1) if match else "Unknown"


def extract_section(content: str, section_name: str) -> str:
    """Extract content between section headers."""
    # Match the section header pattern used in briefs
    pattern = rf'(?:^|\n)(?:#+\s*▸?\s*{re.escape(section_name)}|##\s+{re.escape(section_name)})\s*\n(.*?)(?=\n(?:#+\s*▸|---\s*$)|\Z)'
    match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
    return match.group(1).strip() if match else ""


def extract_six_subsections(content: str) -> dict:
    """Extract each Six subsection."""
    six_content = extract_section(content, "THE SIX")
    if not six_content:
        return {}

    subsections = {}
    # Split on ## headers within The Six
    parts = re.split(r'\n##\s+', six_content)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        # First line is the subsection name
        lines = part.split('\n', 1)
        name = lines[0].strip()
        body = lines[1].strip() if len(lines) > 1 else ""
        if name in ('Markets & Macro', 'Crypto', 'AI & Tech', 'Geopolitics', 'The Wild Card'):
            subsections[name] = body
    return subsections


def extract_bullets(section_text: str) -> list:
    """Extract individual bullet points from a section."""
    bullets = []
    current = []

    for line in section_text.split('\n'):
        if line.strip().startswith('- **') or line.strip().startswith('### '):
            if current:
                bullets.append('\n'.join(current).strip())
            current = [line]
        elif current:
            current.append(line)

    if current:
        bullets.append('\n'.join(current).strip())

    return [b for b in bullets if b]


def strip_prices(text: str) -> str:
    """Strip price data, percentages, and numerical metrics from text.
    What remains is the insight/thesis."""
    # Remove dollar amounts
    stripped = re.sub(r'\$[\d,.]+[BMK]?', '', text)
    # Remove percentages
    stripped = re.sub(r'[+-]?[\d.]+%', '', stripped)
    # Remove basis points
    stripped = re.sub(r'[+-]?\d+\s*bp', '', stripped)
    # Remove Fear & Greed scores
    stripped = re.sub(r'Fear & Greed:?\s*~?\d+', '', stripped)
    # Remove specific price levels
    stripped = re.sub(r'~?\$[\d,.]+', '', stripped)
    # Remove yield levels
    stripped = re.sub(r'~?[\d.]+%', '', stripped)
    # Remove day counts
    stripped = re.sub(r'\d+(?:st|nd|rd|th)\s+consecutive\s+day', '', stripped)
    # Remove pure numbers with units
    stripped = re.sub(r'[\d.]+[BMK]\b', '', stripped)
    # Clean up whitespace
    stripped = re.sub(r'\s+', ' ', stripped).strip()
    return stripped


def classify_crypto_bullet(bullet: str) -> str:
    """Classify a crypto bullet as Dashboard-grade or Six-grade."""
    stripped = strip_prices(bullet)

    dashboard_signals = [
        'fear & greed', 'consecutive day', 'extreme fear',
        'etf outflow', 'etf inflow', 'mining difficulty',
        'hashrate', 'leverage ratio', 'dominance',
        'liquidation', 'options expire'
    ]

    # If after stripping prices, the remaining text is mostly dashboard metrics
    lower = stripped.lower()
    dashboard_count = sum(1 for s in dashboard_signals if s in lower)

    # Check if there's a substantive thesis beyond the metrics
    six_signals = [
        'predict', 'expect', 'framework', 'legislation', 'act ',
        'regulatory', 'institutional', 'structural', 'thesis',
        'divergence between', 'the first', 'unprecedented',
        'implication', 'signal', 'paradigm'
    ]
    six_count = sum(1 for s in six_signals if s in lower)

    if dashboard_count >= 2 and six_count == 0:
        return "DASHBOARD"
    elif len(stripped) < 50:
        return "DASHBOARD"  # Almost nothing left after stripping prices
    else:
        return "SIX"


def extract_take_topic(content: str) -> str:
    """Extract the Take's topic/framework in one sentence."""
    take_section = extract_section(content, "THE TAKE")
    if not take_section:
        return ""
    # Get the first substantive line (skip headers)
    for line in take_section.split('\n'):
        line = line.strip()
        if line and not line.startswith('#') and not line.startswith('---'):
            # Truncate to first sentence
            sentences = re.split(r'(?<=[.!?])\s+', line)
            return sentences[0] if sentences else line
    return ""


def summarize_thesis(bullet: str) -> str:
    """Reduce a bullet to its core thesis in one sentence."""
    # Strip markdown formatting
    clean = re.sub(r'\*\*([^*]+)\*\*', r'\1', bullet)
    clean = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', clean)

    # Get first two sentences (usually contains the thesis)
    sentences = re.split(r'(?<=[.!?])\s+', clean)
    if len(sentences) >= 2:
        return ' '.join(sentences[:2])
    return clean[:200]


def extract_brief_insights(filepath: str) -> dict:
    """Extract all insights from a brief for comparison."""
    with open(filepath, 'r') as f:
        content = f.read()

    date = extract_date(content)
    subsections = extract_six_subsections(content)

    result = {
        'file': filepath,
        'date': date,
        'take_topic': extract_take_topic(content),
        'sections': {}
    }

    for name, body in subsections.items():
        bullets = extract_bullets(body)
        section_data = {
            'bullets': [],
            'lead_thesis': ''
        }

        for i, bullet in enumerate(bullets):
            bullet_data = {
                'text': bullet[:200],  # First 200 chars for reference
                'thesis': summarize_thesis(bullet),
                'stripped': strip_prices(bullet),
                'is_lead': i == 0
            }

            if name == 'Crypto':
                bullet_data['classification'] = classify_crypto_bullet(bullet)

            section_data['bullets'].append(bullet_data)

        if bullets:
            section_data['lead_thesis'] = summarize_thesis(bullets[0])

        result['sections'][name] = section_data

    # Extract Dashboard crypto commentary
    dashboard = extract_section(content, "THE DASHBOARD")
    crypto_dash = ""
    if dashboard:
        # Find the crypto commentary (italic text after the crypto table)
        crypto_match = re.search(r'### Crypto.*?\n\|.*?\n\n(.*?)(?=\n###|\n---|\n#\s)', dashboard, re.DOTALL)
        if crypto_match:
            crypto_dash = crypto_match.group(1).strip()
    result['dashboard_crypto'] = crypto_dash

    return result


def compare_draft_to_briefs(draft_path: str, brief_paths: list) -> dict:
    """Compare a draft against recent published briefs."""
    draft = extract_brief_insights(draft_path)
    briefs = [extract_brief_insights(p) for p in brief_paths]

    audit = {
        'draft_date': draft['date'],
        'compared_against': [b['date'] for b in briefs],
        'sections': {},
        'overall_novel': 0,
        'overall_recycled': 0,
        'crypto_dashboard_leakage': [],
        'within_brief_repetition': []
    }

    # Check each section
    for section_name, section_data in draft['sections'].items():
        section_audit = {
            'bullets': [],
            'novel_count': 0,
            'recycled_count': 0
        }

        for bullet in section_data['bullets']:
            bullet_audit = {
                'text': bullet['text'],
                'stripped': bullet['stripped'],
                'is_novel': True,
                'reason': '',
                'matched_in': []
            }

            # Check against each recent brief
            for brief in briefs:
                if section_name in brief['sections']:
                    for old_bullet in brief['sections'][section_name]['bullets']:
                        # Compare stripped versions (thesis without data)
                        similarity = _simple_similarity(bullet['stripped'], old_bullet['stripped'])
                        if similarity > 0.4:
                            bullet_audit['is_novel'] = False
                            bullet_audit['reason'] = f"Similar to {brief['date']} bullet"
                            bullet_audit['matched_in'].append({
                                'date': brief['date'],
                                'similarity': round(similarity, 2),
                                'matched_text': old_bullet['text'][:100]
                            })

            # Crypto-specific: check if it's Dashboard-grade
            if section_name == 'Crypto' and bullet.get('classification') == 'DASHBOARD':
                bullet_audit['is_novel'] = False
                bullet_audit['reason'] = 'Dashboard-grade content in Six (price data without new insight)'
                audit['crypto_dashboard_leakage'].append(bullet['text'][:100])

            if bullet_audit['is_novel']:
                section_audit['novel_count'] += 1
                audit['overall_novel'] += 1
            else:
                section_audit['recycled_count'] += 1
                audit['overall_recycled'] += 1

            section_audit['bullets'].append(bullet_audit)

        audit['sections'][section_name] = section_audit

    # Check Take novelty
    take_novel = True
    take_reason = ''
    for brief in briefs:
        if _simple_similarity(draft['take_topic'], brief['take_topic']) > 0.35:
            take_novel = False
            take_reason = f"Similar Take topic to {brief['date']}"

    audit['take'] = {
        'topic': draft['take_topic'],
        'is_novel': take_novel,
        'reason': take_reason
    }

    if take_novel:
        audit['overall_novel'] += 1
    else:
        audit['overall_recycled'] += 1

    # Calculate overall score
    total = audit['overall_novel'] + audit['overall_recycled']
    audit['novelty_score'] = round(audit['overall_novel'] / total * 100, 1) if total > 0 else 0
    audit['verdict'] = 'PASS' if audit['novelty_score'] >= 75 else 'FAIL'

    return audit


def _simple_similarity(text1: str, text2: str) -> float:
    """Simple word-overlap similarity between two texts."""
    if not text1 or not text2:
        return 0.0
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    # Remove very common words
    stopwords = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
                 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
                 'would', 'could', 'should', 'may', 'might', 'must', 'shall',
                 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
                 'from', 'as', 'into', 'through', 'during', 'before', 'after',
                 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
                 'that', 'this', 'these', 'those', 'it', 'its', 'than', '—',
                 '--', 'if', 'when', 'which', 'who', 'what', 'how', 'all'}
    words1 -= stopwords
    words2 -= stopwords

    if not words1 or not words2:
        return 0.0

    intersection = words1 & words2
    union = words1 | words2
    return len(intersection) / len(union)


def generate_novelty_map(brief_paths: list) -> str:
    """Generate a novelty map from recent published briefs."""
    briefs = [extract_brief_insights(p) for p in brief_paths]

    # Count thesis appearances
    thesis_counts = {}  # thesis_summary -> [(date, section)]
    topic_counts = {}   # topic keyword -> count

    for brief in briefs:
        # Take
        if brief['take_topic']:
            key = brief['take_topic'][:80]
            thesis_counts.setdefault(f"Take: {key}", []).append(brief['date'])

        # Sections
        for section_name, section_data in brief['sections'].items():
            for i, bullet in enumerate(section_data['bullets']):
                thesis = bullet['thesis'][:80]
                position = "lead" if bullet['is_lead'] else "supporting"
                thesis_counts.setdefault(f"{section_name} ({position}): {thesis}", []).append(brief['date'])

                # Extract key topics (entities, proper nouns)
                for word in bullet['stripped'].split():
                    if len(word) > 3 and word[0].isupper():
                        topic_counts[word] = topic_counts.get(word, 0) + 1

    # Classify by exhaustion level
    exhausted = []
    cooling = []
    fresh_candidates = []

    for thesis, dates in thesis_counts.items():
        if len(dates) >= 3:
            exhausted.append((thesis, len(dates), dates))
        elif len(dates) == 2:
            cooling.append((thesis, dates))

    # Crypto classification across briefs
    crypto_dashboard_items = []
    crypto_six_items = []
    for brief in briefs:
        if 'Crypto' in brief['sections']:
            for bullet in brief['sections']['Crypto']['bullets']:
                classification = bullet.get('classification', 'SIX')
                entry = f"{brief['date']}: {bullet['thesis'][:60]}"
                if classification == 'DASHBOARD':
                    crypto_dashboard_items.append(entry)
                else:
                    crypto_six_items.append(entry)

    # Build output
    lines = [f"# Novelty Map\n"]
    lines.append(f"Generated from {len(briefs)} briefs: {', '.join(b['date'] for b in briefs)}\n")

    lines.append("## Exhausted Themes (3+ appearances — CANNOT lead)\n")
    for thesis, count, dates in sorted(exhausted, key=lambda x: -x[1]):
        lines.append(f"- **{thesis}** — appeared {count}x ({', '.join(dates)})")

    lines.append("\n## Cooling Themes (2 appearances — supporting only)\n")
    for thesis, dates in cooling:
        lines.append(f"- {thesis} — appeared in {', '.join(dates)}")

    lines.append("\n## Crypto: Dashboard vs Six Classification\n")
    lines.append("### Dashboard-grade (price + metrics, no new thesis):\n")
    for item in crypto_dashboard_items:
        lines.append(f"- {item}")
    lines.append("\n### Six-grade (new story/framework/prediction):\n")
    for item in crypto_six_items:
        lines.append(f"- {item}")

    lines.append("\n## Topic Saturation\n")
    for topic, count in sorted(topic_counts.items(), key=lambda x: -x[1])[:20]:
        if count >= 2:
            lines.append(f"- {topic}: {count}/{len(briefs)} briefs")

    return '\n'.join(lines)


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  extract_insights.py <brief_path>              — extract insights from one brief")
        print("  extract_insights.py --compare <draft> <b1> <b2> <b3>  — audit draft vs briefs")
        print("  extract_insights.py --map <b1> <b2> ...       — generate novelty map")
        sys.exit(1)

    if sys.argv[1] == '--compare':
        draft_path = sys.argv[2]
        brief_paths = sys.argv[3:]
        result = compare_draft_to_briefs(draft_path, brief_paths)
        print(json.dumps(result, indent=2))

    elif sys.argv[1] == '--map':
        brief_paths = sys.argv[2:]
        result = generate_novelty_map(brief_paths)
        print(result)

    else:
        result = extract_brief_insights(sys.argv[1])
        print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
