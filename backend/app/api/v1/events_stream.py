import asyncio
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Depends
from fastapi.responses import StreamingResponse

from app.core.event_broker import event_broker

logger = logging.getLogger("watchnet.api.events")

router = APIRouter(prefix="/events", tags=["Events Stream"])


@router.get("/stream")
async def stream_events(request: Request):
    """
    Server-Sent Events (SSE) endpoint: GET /api/v1/events/stream
    Streams real-time network events, device status transitions, and in-app notifications
    over persistent HTTP connection.
    """
    async def event_generator():
        # Send initial connected greeting
        initial_data = {
            "status": "connected",
            "server_time": datetime.now(timezone.utc).isoformat(),
            "message": "WatchNet SSE event stream active"
        }
        yield f"event: ping\ndata: {json.dumps(initial_data)}\n\n"

        subscriber = event_broker.subscribe()
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(subscriber.__anext__(), timeout=1.0)
                    event_name = msg.get("type", "message")
                    payload_str = json.dumps(msg.get("data", {}))
                    yield f"event: {event_name}\ndata: {payload_str}\n\n"
                except asyncio.TimeoutError:
                    # Keepalive ping
                    yield ": keepalive\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        except Exception as e:
            logger.debug(f"[SSE] Stream exception: {e}")
        finally:
            await subscriber.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
