import logging
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from app.core.database import AsyncSessionLocal
from app.models.entities import AuditLog
from app.core.security import decode_token
import uuid

logger = logging.getLogger("watchnet.audit")

class AuditLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Only audit mutating operations (POST, PUT, PATCH, DELETE)
        if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
            # Extract user if available via Authorization header or cookie
            token = None
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
            elif "access_token" in request.cookies:
                token = request.cookies.get("access_token")
                
            actor_uuid = None
            if token:
                payload = decode_token(token)
                sub = payload.get("sub")
                if sub:
                    try:
                        actor_uuid = uuid.UUID(sub)
                    except ValueError:
                        pass
            
            client_ip = request.client.host if request.client else "unknown"
            resource = request.url.path
            action = f"{request.method} {resource}"
            status_code = response.status_code
            
            logger.info(f"AUDIT_RECORD: actor={actor_uuid} action={action} ip={client_ip} status={status_code}")
            
            # Persist to audit_logs asynchronously
            try:
                async with AsyncSessionLocal() as session:
                    audit = AuditLog(
                        actor_id=actor_uuid,
                        action=action,
                        resource=resource,
                        ip_address=client_ip,
                        details={"status_code": status_code, "query_params": str(request.query_params)}
                    )
                    session.add(audit)
                    await session.commit()
            except Exception as e:
                logger.warning(f"Failed to write audit log to DB: {e}")

        return response
