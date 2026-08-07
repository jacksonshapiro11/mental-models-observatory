# STAGE 0 — LIVE READ-BACK EXPERIMENT, CALIBRATION PAIR 3
**Run: 2026-08-07 12:30 ET · 6 blind Haiku Reader subagents · 3 replicas per artifact**
**Artifacts: `2026-08-07-light.md` (shipped) vs the hand rewrite. Same 17 units, same atoms.**
**Readers saw one file each, were told nothing about a comparison, used one Read call, no other tools.**

Reader prompt was the work order's Part 1.1 template verbatim, plus a unit-numbering instruction.
Deviation from spec: the artifact was passed as a path, not interpolated. Noted; equivalent for a probe.

---

## THE HEADLINE RESULT — U3, THE WARSH VOTE ITEM

This is the unit that carried Wednesday's factual error. Three readers each side.

### Shipped ("…reaching seven means Kevin Warsh turning four colleagues who just voted the other way")

> **A1:** "the actual voting math requires seven of twelve votes with a recent composition that favors
> the lower probability, masking structural difficulty behind average odds"

> **A2:** "the actual committee vote requires seven of twelve members to pass and currently only three
> want a hike"

> **A3:** "the Fed only needs seven of twelve votes, so a tied vote means no increase, and the voting
> bloc may not have those seven"

**No reader named an actor. No reader stated who has to be persuaded. And — this is the finding —
no reader stated back the false claim either.** The error did not transmit as an error. It
transmitted as nothing.

### Rewrite ("…Warsh reverses his own vote and brings three of his governors with him")

> **B1:** "it requires the Fed Chair to reverse his current position and bring governors with him to
> get seven votes"

> **B2:** "the Chair and his appointed governors together have enough votes to block one"

> **B3:** "basic arithmetic shows it would require the Fed chair to reverse his recent vote and flip
> three board governors"

**3/3 named the actor and the mechanism. B3 recovered the exact number.**

**Score: shipped 0/3 · rewrite 3/3.**

---

## U10 — BURGER KING. A SYSTEMATIC DISTORTION, NOT NOISE

Intent: *Burger King's 8.5% gain is share, not weather — proven by Popeyes falling 5.1% under the
same parent.* The claim is that BK is winning.

**Shipped — all three readers inverted it the same way:**
- A1: "internal cannibalization rather than net growth, **making it unsustainable**"
- A2: "money moving between sister brands under the same owner **creates no value**"
- A3: "reveals the growth is **hollow** — portfolio cannibalization and maturity"

Three of three heard "this gain is fake." The item meant the opposite. The culprit is the closing
line *"The money walked across the street"* with no anchor before it.

**Rewrite — the added sentence "Nothing about the economy explains that" fixed it:**
- B1: "points to execution and brand quality, not the economy"
- B2: "brand management and execution matter more than macroeconomic conditions"
- B3: "cannot be explained by broader economic conditions"

**Score: shipped 0/3 · rewrite 3/3.** Note this distortion is invisible to every existing gate —
every fact in the shipped unit is true and sourced.

---

## U6 — ATLASSIAN / CLOUDFLARE

Intent: *Atlassian guided next year's growth down to 13% from 26% delivered, and the tape took it up
20%+ anyway.*

- **A1** got the paradox. **A2 invented a rationale not in the text** ("the belief that pulling back
  shows the company is shifting to a higher-margin business model") — a confidently-wrong read-back,
  the DISTORTED class the work order is built to catch. **A3 missed the stock move entirely** and
  inverted the item's own conclusion.
- **B1, B2, B3** all stated the paradox with both numbers.

**Score: shipped 1/3 · rewrite 3/3.**

---

## THE BUG THE EXPERIMENT FOUND — SEGMENTATION

Units were marked by bold-lead, which is what the format gate's parser keys on. In both artifacts
that yields 17 units: 4 deep + 8 line + 3 interesting + "Today's practice" + **the "[→ Explore this
model]" hyperlink line.**

U17 is therefore a link, not a claim.

> **A2 answered: "LOST. This is only a hyperlink to read more about identity-based habits; no
> independent claim is presented here."**

**A2 was right, and the instrument would have scored it a transmission failure.** Meanwhile B1 and
B3 answered U17 with THE MODEL's actual argument — which lives in unlabeled prose the segmenter never
marked — so they "passed" a unit that does not exist by reading a unit that was never assigned.

**Four of the super brief's eight sections are not bold-led at all: MARKETS MINUTE, THE TAKE, the
MEDITATION body, THE CLOSE.** A bold-lead segmenter gives them no unit and never grades them. THE
TAKE — the dated falsifiable call, arguably the highest-stakes prose in the product — would be
invisible to the instrument on night one.

---

## HONEST CAVEATS

1. **I wrote the rewrite.** The read-backs above are raw and unedited, but the tallies are my
   judgment and I am not a neutral grader. The work order's blind Sonnet Grader was **not** run —
   it remains the one component of this design with zero validation. That is a Stage 0 requirement,
   not an optional extra.
2. **Replica agreement was high** on this pair — the three readers per side clustered tightly, which
   is weak evidence that per-reader noise is lower than feared. One pair is not a noise measurement.
   A 10-replica run on a single archive night is still owed.
3. **Open-book leniency is real and unmeasured.** These Readers had the full artifact in context
   while writing every read-back. They were not recalling; they were attending. The "listening while
   making coffee" construct is not what this harness tests.
4. **Position effects were not isolated.** U13–U17 read-backs are visibly thinner than U1–U5 across
   all six readers. That could be prose or it could be output-position degradation. A shuffle test
   settles it in one run.
