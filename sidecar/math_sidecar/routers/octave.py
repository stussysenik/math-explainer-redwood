"""Octave computation proxy endpoint."""

import subprocess

from fastapi import APIRouter

from ..models import OctaveRequest, OctaveResponse

router = APIRouter()


@router.post("/octave", response_model=OctaveResponse)
async def octave_compute(request: OctaveRequest):
    try:
        result = subprocess.run(
            ["octave-cli", "--eval", request.code],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            return OctaveResponse(result=result.stdout.strip())
        else:
            return OctaveResponse(
                error=result.stderr.strip() or result.stdout.strip()
            )
    except FileNotFoundError:
        return OctaveResponse(error="octave-cli not found on this system")
    except subprocess.TimeoutExpired:
        return OctaveResponse(error="Computation timed out")
