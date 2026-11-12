import asyncio
import json
import logging
from typing import AsyncGenerator, Optional, Set
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger("watchnet.events.broker")

EVENTS_CHANNEL = "watchnet:events:stream"


class EventBroker:
    """
    In-memory and Redis PubSub backed event broadcaster for SSE streaming.
    Provides fallback to in-memory async queues when Redis is not reachable.
    """
    _instance: Optional["EventBroker"] = None

    def __init__(self):
        self.subscribers: Set[asyncio.Queue] = set()
        self.redis_client: Optional[aioredis.Redis] = None
        self._redis_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> "EventBroker":
        if cls._instance is None:
            cls._instance = EventBroker()
        return cls._instance

    async def get_redis(self) -> Optional[aioredis.Redis]:
        if self.redis_client is None:
            try:
                r = aioredis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=0.2)
                await asyncio.wait_for(r.ping(), timeout=0.2)
                self.redis_client = r
            except Exception as e:
                logger.debug(f"[EventBroker] Redis not available, using in-memory pubsub: {e}")
                self.redis_client = None
        return self.redis_client

    async def publish(self, event_type: str, data: dict):
        """Publish an event to all active SSE subscribers."""
        payload = {
            "type": event_type,
            "data": data
        }
        json_payload = json.dumps(payload)

        # 1. Publish to in-memory queues
        async with self._lock:
            for q in list(self.subscribers):
                try:
                    q.put_nowait(payload)
                except asyncio.QueueFull:
                    pass

        # 2. Publish to Redis PubSub if available
        r = await self.get_redis()
        if r:
            try:
                await r.publish(EVENTS_CHANNEL, json_payload)
            except Exception as e:
                logger.debug(f"[EventBroker] Redis publish error: {e}")

    async def subscribe(self) -> AsyncGenerator[dict, None]:
        """Subscribe to real-time events yielding dictionary events."""
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self.subscribers.add(q)
        try:
            while True:
                item = await q.get()
                yield item
        finally:
            async with self._lock:
                self.subscribers.discard(q)


event_broker = EventBroker.get_instance()
