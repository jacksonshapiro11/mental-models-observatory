#!/usr/bin/env node --experimental-strip-types
/**
 * ai-release-freshness-gate.ts — a NAMED AI MODEL FRAMED AS A FUTURE RELEASE IS A CHECKABLE
 * TRUTH CLAIM (IMP-090, 2026-07-23 — the 07-23 Critic's mandate #1, 🔴, RC2).
 *
 * WORKED FAILURE. The 07-23 AI&T-2 shipped: "Two Chinese labs will release open-weight frontier
 * models four days apart: DeepSeek's V4 on July 24 and MoonshotAI's Kimi K3 on July 27." Kimi K3
 * had ALREADY launched on July 16 (Bloomberg/Fortune/TechCrunch) — a week before the reading date.
 * The section's whole hook ("the cadence is the signal — two coordinated releases four days apart")
 * rested on a timeline that was fiction. The morning truth gate CAUGHT it (the published brief was
 * corrected to "MoonshotAI released Kimi K3 … on July 16, with open weights due …") — but it caught
 * it by ATTENTION, not by a detector. The fact-gate's RELEASE-DATE class (IMP-044) only knows a
 * calendar of MACRO events (CPI, FOMC, earnings); it has no notion of a model launch. So a model
 * presented as forthcoming that already shipped rode all the way to v2 with nothing forcing it onto
 * the truth rails. That is the exact RC2 shape the system mechanizes same-day (FLOOR/truth, exempt
 * from proxy discipline): don't try to KNOW every model's launch date — DETECT the risky claim class
 * and FORCE the morning gate to verify it (the IMP-069/IMP-074/IMP-077 pattern: verified or flagged).
 *
 * THE CHECK. Inside the AI & Tech section only, FLAG any sentence that frames a NAMED model/lab as a
 * FUTURE release — "will/to release|launch|ship|debut|unveil|drop|roll out", or "<Model> releases|
 * launches|drops|arrives|lands on <future month-date>". Each flagged sentence is a WORKLIST item the
 * morning truth gate must resolve: confirm the model has NOT already launched, or reframe. It is
 * deliberately SILENT on the corrected past-tense form ("released … on July 16") and on a weights/
 * API/preview drop that is not the model itself ("open weights due around July 27").
 *
 * Usage:
 *   node --experimental-strip-types scripts/ai-release-freshness-gate.ts <brief.md>
 *   node --experimental-strip-types scripts/ai-release-freshness-gate.ts --selftest
 * Exit: 0 no unverified future-release framing (or selftest pass) · 1 worklist non-empty (or selftest
 *       fail) · 2 usage/file error.
 * Wired into: Brief_Editor.md (Gate: AI MODEL RELEASE STATUS 🔴 REJECT), AI_Tech_Generator.md
 *   (THE FACT PREMISE — release-status rule), Pipeline_Controller.md morning truth gate (spot-check),
 *   and system/Improvement_Ledger.md IMP-090 (run:--selftest).
 */
import * as fs from 'fs';
import * as path from 'path';

type Finding = { check: string; severity: 'FAIL'; message: string };

const AIT_HEADER_RE = /^#{1,3}\s*(?:▸\s*)?AI\s*&\s*TECH(?:NOLOGY)?\b/im;

/** Extract the AI & Tech section body: from its header to the next top-level (#/##/###) header. */
export function aiTechSection(body: string): string | null {
  const lines = body.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (AIT_HEADER_RE.test(lines[i]!)) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

// Labs and model families whose presence marks a sentence as a MODEL-release claim (not a generic
// "will launch a platform"). Kept broad but proper-noun anchored to avoid firing on ordinary prose.
const MODEL_CUE_RE = new RegExp(
  '\\b(' +
    'deepseek|moonshot(?:ai)?|kimi|openai|gpt-?\\d|anthropic|claude|google|gemini|deepmind|' +
    'meta|llama|mistral|qwen|alibaba|xai|grok|cohere|command\\s?r|nvidia|microsoft|phi-?\\d|' +
    'stability|falcon|yi-?\\d|baidu|ernie|minimax|zhipu|glm-?\\d' +
    ')\\b',
  'i'
);

// A generic "<Proper> V4 / K3 / R2 / 4.0" model-version token (catches unlisted labs' model names).
const MODEL_VERSION_RE =
  /\b[A-Z][A-Za-z.]+\s+(?:V|K|R|GLM-|Phi-)?\d+(?:\.\d+)?\b/;

// FUTURE-release framing #1: an explicit forward auxiliary + a release verb.
const FUTURE_VERB_RE =
  /\b(?:will|to|is\s+(?:set|slated|expected|going|due)\s+to|are\s+(?:set|slated|expected|going|due)\s+to|plans?\s+to|set\s+to|slated\s+to|expected\s+to|due\s+to)\s+(?:release|launch|ship|debut|unveil|drop|roll\s*out|introduce|publish)\b/i;

// FUTURE-release framing #2: a PRESENT-tense release verb pointing AT a forward date
// ("Kimi K3 … on July 27", "GPT-6 lands on August 15"). Present tense only — "released … on
// July 16" (past) must NOT match, which is why the verbs below carry no "-ed" form.
const MONTHS =
  'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
const PRESENT_RELEASE_TO_DATE_RE = new RegExp(
  `\\b(?:releases?|launches?|drops?|arrives?|lands?|ships?|debuts?)\\b[^.?!]*?\\bon\\b[^.?!]*?\\b(?:${MONTHS})\\s+\\d{1,2}\\b`,
  'i'
);

// A weights / API / preview / update drop is NOT the model shipping — the corrected 07-23 form
// ("open weights due around July 27") must stay silent even though it carries a forward date.
const NON_MODEL_OBJECT_RE =
  /\b(?:open\s+)?weights?\b|\bapi\b|\bpreview\b|\bwaitlist\b|\bupdate\b|\bcheckpoint\b/i;

function splitSentences(text: string): string[] {
  // Strip list markers / bold, then split on sentence terminators and hard newlines.
  return text
    .replace(/\*\*/g, '')
    .split(/(?<=[.?!])\s+|\n{1,}/)
    .map(s => s.replace(/^[-*\d.\s]+/, '').trim())
    .filter(s => s.length > 0);
}

export function checkAiReleaseFreshness(body: string): Finding[] {
  const section = aiTechSection(body);
  if (section == null) return []; // absence of the section is validate-brief's job
  const findings: Finding[] = [];
  for (const sentence of splitSentences(section)) {
    const future =
      FUTURE_VERB_RE.test(sentence) ||
      PRESENT_RELEASE_TO_DATE_RE.test(sentence);
    if (!future) continue;
    const namesModel =
      MODEL_CUE_RE.test(sentence) || MODEL_VERSION_RE.test(sentence);
    if (!namesModel) continue;
    // If the ONLY forward object is weights/API/preview/update (not the model), stay silent.
    if (NON_MODEL_OBJECT_RE.test(sentence) && !FUTURE_VERB_RE.test(sentence))
      continue;
    findings.push({
      check: 'ai-release-status-unverified',
      severity: 'FAIL',
      message:
        `AI MODEL FRAMED AS A FUTURE RELEASE — a release status is a checkable fact. Verify this ` +
        `model has NOT already launched before shipping it as forthcoming; if it has, reframe (the ` +
        `07-23 Kimi K3 class: presented for "July 27", had already launched July 16). Resolve at the ` +
        `morning truth gate — verified-or-reframed. Sentence: "${sentence.slice(0, 180)}"`,
    });
  }
  return findings;
}

function selftest(): number {
  let fail = 0;
  const t = (name: string, cond: boolean) => {
    console.log(`  ${cond ? '✓' : '✗'} ${name}`);
    if (!cond) fail++;
  };

  // FIRE on the REAL 07-23 failure sentence (Critic-quoted verbatim).
  const bad = `## AI & Tech\n\n- Two Chinese labs will release open-weight frontier models four days apart: DeepSeek's V4 on July 24 and MoonshotAI's Kimi K3 on July 27.\n\n## Geopolitics\n`;
  t(
    'FIRE on the real 07-23 "will release … Kimi K3 on July 27"',
    checkAiReleaseFreshness(bad).some(
      f => f.check === 'ai-release-status-unverified'
    )
  );

  // SILENT on the CORRECTED past-tense form the morning gate produced (released … on July 16; weights due).
  const fixed = `## AI & Tech\n\n- MoonshotAI released Kimi K3, a 2.8-trillion-parameter model rivaling top US systems, on July 16, with open weights due around July 27.\n\n## Geopolitics\n`;
  t(
    'SILENT on the corrected "released … on July 16, weights due ~July 27"',
    checkAiReleaseFreshness(fixed).length === 0
  );

  // FIRE on a clean future model launch ("OpenAI will launch GPT-6 on August 15").
  const bad2 = `## AI & Tech\n\n- OpenAI will launch GPT-6 on August 15, its first frontier model since GPT-5.\n\n## Markets\n`;
  t(
    'FIRE on "OpenAI will launch GPT-6 on August 15"',
    checkAiReleaseFreshness(bad2).length === 1
  );

  // SILENT on a straightforward PAST-tense ship (the normal, healthy AI&T bullet).
  const ok1 = `## AI & Tech\n\n- Anthropic released Claude 4.0 with extended context and improved reasoning this week.\n\n## Markets\n`;
  t(
    'SILENT on past-tense "Anthropic released Claude 4.0"',
    checkAiReleaseFreshness(ok1).length === 0
  );

  // SILENT when the future-release language is NOT about a model (out-of-scope-but-in-section prose).
  const ok2 = `## AI & Tech\n\n- Regulators will publish new disclosure rules next quarter for frontier labs.\n\n## Markets\n`;
  t(
    'SILENT on non-model future prose ("regulators will publish rules")',
    checkAiReleaseFreshness(ok2).length === 0
  );

  // SILENT when the model release framing lives OUTSIDE the AI & Tech section (scope guard).
  const ok3 = `## Companies & Crypto\n\n- Acme will launch its GPT-6 integration next week.\n\n## Markets\n`;
  t(
    'SILENT on model-future framing outside AI & Tech (scope guard)',
    checkAiReleaseFreshness(ok3).length === 0
  );

  // SILENT when the section is absent.
  t(
    'SILENT when AI & Tech section absent',
    checkAiReleaseFreshness('## Markets\n\n- Stocks rose.\n').length === 0
  );

  console.log(
    `\n${fail === 0 ? '✅ SELFTEST PASS — fires on a named model framed as a future release, silent on the corrected past-tense/weights form and out-of-scope prose.' : `❌ SELFTEST FAIL (${fail})`}`
  );
  return fail === 0 ? 0 : 1;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const fileArg = args.find(a => !a.startsWith('--'));
  if (!fileArg) {
    console.error(
      'Usage: ai-release-freshness-gate.ts <brief.md> | --selftest'
    );
    return 2;
  }
  const fp = path.isAbsolute(fileArg)
    ? fileArg
    : path.join(process.cwd(), fileArg);
  if (!fs.existsSync(fp)) {
    console.error(`File not found: ${fp}`);
    return 2;
  }
  const findings = checkAiReleaseFreshness(fs.readFileSync(fp, 'utf8'));
  console.log(`ai-release-freshness-gate — ${path.basename(fp)}`);
  if (findings.length === 0) {
    console.log(
      '\n✅ PASS — no named model framed as an unverified future release.'
    );
    return 0;
  }
  console.log(
    `\n⚠️  WORKLIST — ${findings.length} future-release claim(s) to verify at the morning truth gate:`
  );
  for (const f of findings) console.log(`   ✗ [${f.check}] ${f.message}`);
  return 1;
}

process.exit(main());
