"""
Security Headers Middleware.
Applies modern HTTP defense-in-depth headers:
- Strict-Transport-Security (HSTS)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Content-Security-Policy (CSP)
- Permissions-Policy
- X-XSS-Protection: 0 (modern standard superseded by CSP)
"""
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        
        # Defense-in-depth HTTP headers
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), browsing-topics=()"
        
        # Only attach CSP if not already provided (e.g. static assets)
        if "Content-Security-Policy" not in response.headers:
            path = request.url.path
            # Relax CSP specifically for Swagger UI and ReDoc to allow external assets (jsdelivr CDN and Google Fonts)
            if path in ("/docs", "/redoc", "/api/v1/docs", "/api/v1/redoc"):
                response.headers["Content-Security-Policy"] = (
                    "default-src 'self'; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
                    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
                    "img-src 'self' data: https: blob:; "
                    "font-src 'self' data: https://fonts.gstatic.com; "
                    "connect-src 'self' ws: wss:; "
                    "frame-ancestors 'none';"
                )
            else:
                response.headers["Content-Security-Policy"] = (
                    "default-src 'self'; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                    "style-src 'self' 'unsafe-inline'; "
                    "img-src 'self' data: https: blob:; "
                    "font-src 'self' data:; "
                    "connect-src 'self' ws: wss:; "
                    "frame-ancestors 'none';"
                )
            
        return response
