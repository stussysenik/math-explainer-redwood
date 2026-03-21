"""MathViz DSPy Sidecar — FastAPI app for tool routing optimization and engine proxies."""

from fastapi import FastAPI

from .health import router as health_router
from .routers.tool_router import router as tool_router
from .routers.wolfram import router as wolfram_router
from .routers.octave import router as octave_router
from .routers.evaluate import router as evaluate_router
from .routers.sympy import router as sympy_router

app = FastAPI(
    title="MathViz Sidecar",
    description="DSPy-powered tool routing and engine proxy for MathViz",
    version="0.1.0",
)

app.include_router(health_router)
app.include_router(tool_router, prefix="/api")
app.include_router(wolfram_router, prefix="/api")
app.include_router(octave_router, prefix="/api")
app.include_router(evaluate_router, prefix="/api")
app.include_router(sympy_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
