"""Async Wolfram Alpha API client."""

import httpx

WOLFRAM_API_URL = "http://api.wolframalpha.com/v2/query"


async def query_wolfram(query: str, app_id: str) -> dict:
    params = {
        "input": query,
        "appid": app_id,
        "output": "json",
        "format": "plaintext",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(WOLFRAM_API_URL, params=params)
        response.raise_for_status()
        data = response.json()

    qr = data.get("queryresult", {})
    if not qr.get("success"):
        return {"error": "Wolfram Alpha query failed", "result": None, "steps": [], "plots": []}

    pods = qr.get("pods", [])
    result = _extract_pod(pods, "Result") or _extract_pod(pods, "Solution") or _first_pod(pods)
    steps_text = _extract_pod(pods, "Step-by-step solution")
    plots = _extract_plots(pods)

    return {
        "result": result,
        "steps": [steps_text] if steps_text else [],
        "latex": None,
        "plots": plots,
    }


def _extract_pod(pods: list, title: str) -> str | None:
    for pod in pods:
        if pod.get("title") == title:
            subpods = pod.get("subpods", [])
            if subpods and subpods[0].get("plaintext"):
                return subpods[0]["plaintext"]
    return None


def _first_pod(pods: list) -> str | None:
    for pod in pods[1:]:
        subpods = pod.get("subpods", [])
        if subpods and subpods[0].get("plaintext"):
            return subpods[0]["plaintext"]
    return None


def _extract_plots(pods: list) -> list[str]:
    urls = []
    for pod in pods:
        for subpod in pod.get("subpods", []):
            img = subpod.get("img", {})
            if img.get("src"):
                urls.append(img["src"])
    return urls
