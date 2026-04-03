"""MATLAB subprocess bridge.

This is optional by design because MATLAB is proprietary and may not be
installed on the deployment target. We use `matlab -batch ...` when the
binary is available and otherwise return a structured error.
"""

from __future__ import annotations

import subprocess
import time


def run_matlab(code: str, timeout: int = 30) -> dict:
    start = time.perf_counter()
    try:
        result = subprocess.run(
            ["matlab", "-batch", code],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        duration_ms = int((time.perf_counter() - start) * 1000)
        if result.returncode == 0:
            return {
                "ok": True,
                "result": result.stdout.strip(),
                "error": None,
                "duration_ms": duration_ms,
            }

        return {
            "ok": False,
            "result": None,
            "error": result.stderr.strip() or result.stdout.strip(),
            "duration_ms": duration_ms,
        }
    except FileNotFoundError:
        return {
            "ok": False,
            "result": None,
            "error": "matlab not found on this system",
            "duration_ms": None,
        }
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "result": None,
            "error": "Computation timed out",
            "duration_ms": int((time.perf_counter() - start) * 1000),
        }
