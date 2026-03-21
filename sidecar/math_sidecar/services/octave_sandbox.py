"""Octave subprocess wrapper with sandboxing."""

import subprocess


def run_octave(code: str, timeout: int = 30) -> dict:
    try:
        result = subprocess.run(
            ["octave-cli", "--eval", code],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode == 0:
            return {"ok": True, "result": result.stdout.strip(), "error": None}
        else:
            return {
                "ok": False,
                "result": None,
                "error": result.stderr.strip() or result.stdout.strip(),
            }
    except FileNotFoundError:
        return {"ok": False, "result": None, "error": "octave-cli not found"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "result": None, "error": "Computation timed out"}
