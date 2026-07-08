"""
Custom uvicorn entry point for Windows + Python 3.12+.

Problem: Windows defaults to ProactorEventLoop, which is incompatible with
psycopg3's async mode. The deprecated WindowsSelectorEventLoopPolicy is
removed in Python 3.16.

Fix: use asyncio.run(loop_factory=...) — the officially supported way since
Python 3.12 to force SelectorEventLoop without touching global policy.
"""

import asyncio
import sys

import uvicorn


def main() -> None:
    config = uvicorn.Config(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        # Disable uvicorn's own loop setup so we fully control it below
        loop="none",
    )
    server = uvicorn.Server(config)

    if sys.platform == "win32":
        # ProactorEventLoop (default on Windows) is incompatible with psycopg3
        # async mode. SelectorEventLoop works correctly on Python 3.12–3.14+.
        asyncio.run(server.serve(), loop_factory=asyncio.SelectorEventLoop)
    else:
        asyncio.run(server.serve())


if __name__ == "__main__":
    main()
