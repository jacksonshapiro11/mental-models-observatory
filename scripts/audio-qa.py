#!/usr/bin/env python3
"""audio-qa.py — mechanical QA for the Super Brief / weekly audio. Never calls a model.

WHY THIS EXISTS. On 2026-08-09 the owner reported a drum-like noise in the W32 episode. Nothing in
the pipeline could see it: the audio path had no measurement at all between TTS and publish. The
forensic scan named the root cause — an amplitude discontinuity at a TTS chunk seam at 11:34.20,
a +33.1 dB attack out of 0.7s of near-silence, terminating in a hard cut to absolute digital zero —
and found the systemic version underneath it: 202 runs of absolute digital zero of 30ms or more,
mid-episode, in a 15-minute file. Every one is a splice made with no fade, no dither, no room tone.

THRESHOLDS ARE MEASURED, NOT INVENTED. Every default below is anchored to that scan (W32, 2026-08-08,
924.9s, 128kbps, 24kHz mono): integrated -23.8 LUFS, LRA 4.1, true peak -4.0 dBTP, 202 zero-runs,
max transient attack +33.1 dB. Where a measured value IS the current normal (zero-runs), the check
reports the count and flags only the audible subset rather than firing every night on a known state.

WHAT IT DOES NOT DO, STATED PLAINLY. It does not localise the moment the owner heard. Measured: the
episode contains 298 loud onsets out of a near-silent gap and 246 runs of absolute digital zero of
30ms or more, and the owner's reported 11:34.20 ranks 166th of 298 by amplitude. It is not a special
event; it is one instance of a defect the file commits hundreds of times. The COUNT is the finding.
Any future version that claims to point at "the" artifact is overfitting to one ear on one night.

ADVISORY FIRST. Exit is 0 unless --strict. A QA check that blocks a publish on its first night is a
check nobody trusts by its third.
"""
import argparse, json, os, re, subprocess, sys
import numpy as np

# ── measured baselines (W32, 2026-08-08) — the calibration this file was written against ──────────
BASELINE = {
    "file": "weekly-W32.mp3", "duration_s": 924.888, "lufs_i": -23.8, "lra": 4.1,
    "true_peak_dbtp": -4.0, "zero_runs_30ms": 202, "max_attack_db": 33.1, "max_attack_at_s": 694.2,
}
PODCAST_LUFS = -16.0          # the norm the episode is 7.8 LU under
LUFS_TOL = 2.0
TP_CEIL_DBTP = -1.0
ATTACK_FLAG_DB = 20.0         # the owner's mark measured +33.1; the next candidate was +30.1
QUIET_GATE_REL_DB = -20.0     # a gap is "near-silent" this far under the episode's own median speech
GAP_MIN_S = 0.20              # the owner's mark sat behind a 0.8 s gap; 0.20 catches the family
ONSET_OVER_SPEECH_DB = 5.0    # measured: that onset came back +5.8 dB over median at 100 ms framing
ZERO_RUN_MS = 30.0
SILENCE_DB = -50.0
SILENCE_MIN_S = 1.5
EDGE_S = 5.0                  # head/tail excluded — an episode legitimately starts and ends in silence
WPM_MEASURED = None           # filled from --script when given


def sh(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def decode(path):
    """Decode to native-rate mono s16le. NO resampling: a resampler smears absolute zeros and the
    zero-run count is the whole point of this check."""
    pr = sh(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
             "stream=sample_rate", "-show_entries", "format=duration", "-of", "json", path])
    meta = json.loads(pr.stdout or "{}")
    sr = int(meta.get("streams", [{}])[0].get("sample_rate", 24000))
    dur = float(meta.get("format", {}).get("duration", 0.0))
    p = sh(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr),
            "-f", "s16le", "-acodec", "pcm_s16le", "-"])
    x = np.frombuffer(p.stdout.encode("latin-1") if isinstance(p.stdout, str) else p.stdout,
                      dtype="<i2")
    return x.astype(np.float32) / 32768.0, sr, dur


def decode_bin(path):
    pr = sh(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
             "stream=sample_rate", "-show_entries", "format=duration", "-of", "json", path])
    meta = json.loads(pr.stdout or "{}")
    sr = int(meta.get("streams", [{}])[0].get("sample_rate", 24000))
    dur = float(meta.get("format", {}).get("duration", 0.0))
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr),
                        "-f", "s16le", "-acodec", "pcm_s16le", "-"], capture_output=True)
    x = np.frombuffer(p.stdout, dtype="<i2").astype(np.float32) / 32768.0
    return x, sr, dur


def loudness(path):
    """ebur128 prints a running M:/S:/I: line per frame and THEN a Summary block. Reading the first
    match reads frame 1 and reports -70 LUFS on a normal episode — caught on the first live run."""
    r = sh(["ffmpeg", "-v", "info", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"])
    t = r.stderr
    tail = t[t.rfind("Summary:"):] if "Summary:" in t else t

    def grab(label):
        m = re.findall(label + r":\s*(-?[\d.]+)", tail)
        return float(m[-1]) if m else None
    return {"lufs_i": grab("I"), "lra": grab("LRA"), "true_peak_dbtp": grab("Peak")}


def zero_runs(x, sr, dur):
    """Runs of ABSOLUTE digital zero. Real recorded silence never reaches absolute zero; every one of
    these is a concatenation seam."""
    z = (x == 0.0).astype(np.int8)
    d = np.diff(np.concatenate(([0], z, [0])))
    starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
    out = []
    minlen = int(ZERO_RUN_MS / 1000.0 * sr)
    for s, e in zip(starts, ends):
        if e - s < minlen:
            continue
        t0, t1 = s / sr, e / sr
        if t0 < EDGE_S or t1 > dur - EDGE_S:
            continue
        out.append((round(t0, 2), round((t1 - t0) * 1000.0, 1)))
    return out


def seam_onsets(x, sr, dur, frame_ms=50.0):
    """SEAMS, NOT SPIKES. The audible defect is an onset out of a near-silent gap straight to a level
    above ordinary speech — a chunk boundary made with no fade. A plain frame-to-frame attack test
    does not work here: absolute-zero frames read -240 dB, so an unfloored baseline turned 1925 of
    18497 frames into "+105 dB attacks" on the first live run, and a floored one still missed the
    owner's own mark. Measuring the gap directly is what reproduces it.

    Ground truth (W32, owner-reported): speech ends 693.30, near-silence to 694.10 at -65 dB, abrupt
    onset at 694.20 to -19 dB and -17 by 694.80, then a hard cut to absolute zero for 282 ms at
    696.05. THREE seams inside seven seconds — the count is the finding, not the single timestamp."""
    n = int(frame_ms / 1000.0 * sr)
    m = len(x) // n
    fr = x[: m * n].reshape(m, n)
    db = 20.0 * np.log10(np.sqrt((fr ** 2).mean(axis=1) + 1e-12) + 1e-12)
    speech = db[db > -45.0]
    med = float(np.median(speech)) if speech.size else float(np.median(db))
    quiet_gate = med + QUIET_GATE_REL_DB
    q = (db < quiet_gate).astype(np.int8)
    d = np.diff(np.concatenate(([0], q, [0])))
    starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
    hits = []
    look = max(1, int(0.5 / (frame_ms / 1000.0)))
    for s0, e0 in zip(starts, ends):
        gap = (e0 - s0) * frame_ms / 1000.0
        if gap < GAP_MIN_S:
            continue
        t = e0 * frame_ms / 1000.0
        if t < EDGE_S or t > dur - EDGE_S:
            continue
        post = db[e0:e0 + look]
        if not len(post):
            continue
        peak = float(post.max())
        if peak < med + ONSET_OVER_SPEECH_DB:
            continue
        k = int(np.argmax(post >= peak - 3.0))
        hits.append({"at_s": round(t, 2), "gap_s": round(gap, 2),
                     "level_db": round(peak, 1), "over_speech_db": round(peak - med, 1),
                     "attack_ms": int(k * frame_ms), "floor_db": round(float(db[s0:e0].min()), 1)})
    hits.sort(key=lambda h: -h["over_speech_db"])
    return hits, med


def long_silences(path, dur):
    r = sh(["ffmpeg", "-v", "info", "-i", path, "-af",
            f"silencedetect=n={SILENCE_DB}dB:d={SILENCE_MIN_S}", "-f", "null", "-"])
    out, start = [], None
    for line in r.stderr.splitlines():
        m = re.search(r"silence_start:\s*(-?[\d.]+)", line)
        if m:
            start = float(m.group(1))
        m = re.search(r"silence_duration:\s*([\d.]+)", line)
        if m and start is not None:
            if EDGE_S < start < dur - EDGE_S:
                out.append({"at_s": round(start, 2), "dur_s": round(float(m.group(1)), 2)})
            start = None
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--script", help="the spoken script, for the duration sanity check")
    ap.add_argument("--json", help="write the full result here")
    ap.add_argument("--wpm", type=float, default=150.0, help="expected speaking rate")
    ap.add_argument("--strict", action="store_true", help="exit 1 on any flag (default: advisory)")
    a = ap.parse_args()

    if not os.path.exists(a.audio):
        print(f"AUDIO-QA — 0/0 · file not found: {a.audio}. Nothing measured. Not a pass, an absence.")
        return 0

    x, sr, dur = decode_bin(a.audio)
    L = loudness(a.audio)
    zr = zero_runs(x, sr, dur)
    tr, med_db = seam_onsets(x, sr, dur)
    sil = long_silences(a.audio, dur)

    flags = []
    if L["lufs_i"] is not None and abs(L["lufs_i"] - PODCAST_LUFS) > LUFS_TOL:
        flags.append(f"LOUDNESS {L['lufs_i']} LUFS against a {PODCAST_LUFS} norm "
                     f"({abs(L['lufs_i'] - PODCAST_LUFS):.1f} LU off)")
    if L["true_peak_dbtp"] is not None and L["true_peak_dbtp"] > TP_CEIL_DBTP:
        flags.append(f"CLIPPING RISK true peak {L['true_peak_dbtp']} dBTP over {TP_CEIL_DBTP}")
    if tr:
        flags.append(f"SEAM ONSETS {len(tr)} loud onset(s) out of a near-silent gap — worst "
                     f"+{tr[0]['over_speech_db']} dB over speech at "
                     f"{int(tr[0]['at_s'] // 60)}:{tr[0]['at_s'] % 60:05.2f}")
    if sil:
        flags.append(f"DEAD AIR {len(sil)} mid-episode silence(s) over {SILENCE_MIN_S}s")

    words = None
    if a.script and os.path.exists(a.script):
        words = len(open(a.script, encoding="utf-8", errors="replace").read().split())
        expect = words / a.wpm * 60.0
        drift = abs(dur - expect) / expect if expect else 0.0
        if drift > 0.20:
            flags.append(f"DURATION {dur:.0f}s against {expect:.0f}s expected from {words} words "
                         f"at {a.wpm:.0f} wpm ({drift * 100:.0f}% off)")

    print(f"AUDIO-QA {os.path.basename(a.audio)} — {len(flags)} flag(s) · {dur / 60:.1f} min · {sr} Hz")
    print(f"  loudness      {L['lufs_i']} LUFS I · LRA {L['lra']} · true peak {L['true_peak_dbtp']} dBTP"
          f"   (norm {PODCAST_LUFS}, ceiling {TP_CEIL_DBTP})")
    print(f"  seam onsets   {len(tr)} loud onset(s) out of a near-silent gap · median speech {med_db:.1f} dB")
    for h in tr[:5]:
        print(f"                · {int(h['at_s'] // 60):02d}:{h['at_s'] % 60:05.2f}  gap {h['gap_s']}s to "
              f"{h['floor_db']} dB, onset {h['level_db']} dB (+{h['over_speech_db']} over speech) in "
              f"{h['attack_ms']}ms")
    print(f"  splice seams  {len(zr)} run(s) of absolute digital zero at or over {ZERO_RUN_MS:.0f}ms, "
          f"mid-episode   (W32 measured {BASELINE['zero_runs_30ms']})")
    print(f"  dead air      {len(sil)} silence(s) over {SILENCE_MIN_S}s below {SILENCE_DB} dB")
    if words is not None:
        print(f"  duration      {dur:.0f}s for {words} words = {words / (dur / 60):.0f} wpm")
    for f in flags:
        print(f"  ⚠ {f}")
    if not flags:
        print("  clean against every measured threshold.")

    if a.json:
        json.dump({"file": a.audio, "duration_s": dur, "sample_rate": sr, "loudness": L,
                   "transients": tr, "zero_runs": zr, "long_silences": sil,
                   "words": words, "flags": flags, "baseline": BASELINE},
                  open(a.json, "w"), indent=2)
        print(f"  → {a.json}")

    return 1 if (a.strict and flags) else 0


if __name__ == "__main__":
    sys.exit(main())
