#!/usr/bin/env python3
"""
IMP-194 selftest — the api.github.com TUNNEL SHORT-CIRCUIT in scripts/publish-brief.py.

WHY THIS FILE EXISTS SEPARATELY. publish-brief.py's job is to put reader-facing content on
origin/main; bolting a --selftest mode onto it would put test scaffolding inside the one script
whose failure mode is "the brief did not publish and nobody found out". This harness imports it
and exercises `github_request` against a stubbed `urlopen`, so the proof costs no network and
touches no repository.

WHAT IT PROVES, both directions — a check that only fires is not a check:

  FIRES   a CONNECTION-level failure (URLError / timeout / OSError) is learned ONCE. Twelve
          subsequent REST calls make zero further network attempts. Receipt, 2026-08-18: two
          consecutive sessions burned their entire time budget rediscovering that the sandbox
          proxy refuses api.github.com — brief-morning timed out at 178s inside that loop and
          the companion LIGHT brief never published, reaching origin/main thirteen minutes late,
          by which time the 05:45 ET audio cron had already run against a 404.

  SILENT  an HTTP answer (403, 404, 422 …) means we REACHED GitHub and it replied. That must
          NOT disable the REST path — the callers are written to interpret those codes, and a
          rate-limit 403 on one call is not a dead tunnel. Tripping here would silently degrade
          every publish to the slower git path forever.

Usage: python3 scripts/publish-tunnel-selftest.py    # exit 0 pass / 1 fail
"""

import importlib.util
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "publish-brief.py")


def load():
    spec = importlib.util.spec_from_file_location("publish_brief_under_test", TARGET)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["publish_brief_under_test"] = mod
    spec.loader.exec_module(mod)
    return mod


def main():
    if not os.path.exists(TARGET):
        print(f"✗ missing {TARGET}")
        return 1
    pb = load()
    failures = []

    if not hasattr(pb, "_API_TUNNEL_BLOCKED"):
        print("✗ _API_TUNNEL_BLOCKED absent — the short-circuit has been reverted")
        return 1

    # ---- FIRES: connection-level failure is learned once ----
    pb._API_TUNNEL_BLOCKED = False
    attempts = {"n": 0}

    def refusing_urlopen(req, timeout=None):
        attempts["n"] += 1
        time.sleep(0.02)  # stand-in for the 8s socket timeout each call would really pay
        raise pb.URLError("proxy CONNECT refused")

    real_urlopen = pb.urlopen
    pb.urlopen = refusing_urlopen
    started = time.time()
    for _ in range(12):
        pb.github_request("https://api.github.com/repos/x/contents/y", "tok")
    elapsed = time.time() - started
    if attempts["n"] != 1:
        failures.append(
            f"FIRES: expected 1 network attempt across 12 calls, got {attempts['n']} "
            "— the tunnel short-circuit is not engaging and every publish will re-pay the timeout"
        )
    if not pb._API_TUNNEL_BLOCKED:
        failures.append("FIRES: _API_TUNNEL_BLOCKED never set on a connection-level failure")
    print(
        f"  {'✓' if attempts['n'] == 1 else '✗'} FIRES — 12 REST calls behind a refused tunnel "
        f"made {attempts['n']} network attempt(s) in {elapsed:.2f}s"
    )

    # ---- SILENT: an HTTP answer must not disable the REST path ----
    pb._API_TUNNEL_BLOCKED = False

    class Answered(pb.HTTPError):
        def __init__(self):
            pass

        def read(self):
            return b'{"message":"Not Found"}'

        @property
        def code(self):
            return 404

    def answering_urlopen(req, timeout=None):
        raise Answered()

    pb.urlopen = answering_urlopen
    _, status = pb.github_request("https://api.github.com/repos/x/contents/y", "tok")
    ok_silent = status == 404 and pb._API_TUNNEL_BLOCKED is False
    if not ok_silent:
        failures.append(
            f"SILENT: an HTTP {status} answer set blocked={pb._API_TUNNEL_BLOCKED} — GitHub replied, "
            "so the REST path is alive and must stay enabled"
        )
    print(
        f"  {'✓' if ok_silent else '✗'} SILENT — an HTTP 404 answer leaves the REST path enabled "
        f"(status={status}, blocked={pb._API_TUNNEL_BLOCKED})"
    )

    pb.urlopen = real_urlopen
    pb._API_TUNNEL_BLOCKED = False

    print(f"\npublish-tunnel-selftest — {2 - len(failures)}/2 assertions passed")
    for f in failures:
        print(f"  ✗ {f}")
    if failures:
        print("✗ SELFTEST FAILED — the publish tunnel short-circuit no longer bites both directions.")
        return 1
    print("✓ IMP-194 verified: the dead tunnel is learned once, and a live GitHub answer is never mistaken for one.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
