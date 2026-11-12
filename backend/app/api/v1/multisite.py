import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.entities import User, UserRole
from app.services.multisite.sync_service import MultiSiteSyncService

logger = logging.getLogger("watchnet.api.sync")

router = APIRouter(prefix="/sync", tags=["Multi-Site Sync"])


class SiteRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Unique remote site name")
    location: Optional[str] = Field(None, max_length=255, description="Geographic location or branch office")
    interface: Optional[str] = Field(None, max_length=50, description="Default network interface e.g. eth0")


class SiteRegisterResponse(BaseModel):
    id: str
    name: str
    location: Optional[str]
    interface: Optional[str]
    api_key: str
    message: str


class SyncBatchRequest(BaseModel):
    batch: List[Dict[str, Any]] = Field(..., description="List of discovered devices from remote collector")


@router.post("/register", response_model=SiteRegisterResponse, status_code=status.HTTP_201_CREATED)
async def register_site_node(
    payload: SiteRegisterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.OWNER]))
):
    """
    Register a remote collector node.
    Returns generated API key token (shown only once).
    """
    service = MultiSiteSyncService(db)
    try:
        site, raw_key = await service.register_site(
            name=payload.name,
            location=payload.location,
            interface=payload.interface
        )
        return SiteRegisterResponse(
            id=str(site.id),
            name=site.name,
            location=site.location,
            interface=site.interface,
            api_key=raw_key,
            message="Remote site registered successfully. Save this API key securely; it will not be displayed again."
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/ingest")
async def ingest_remote_payload(
    payload: SyncBatchRequest,
    x_site_key: Optional[str] = Header(None, alias="X-Site-Key"),
    db: AsyncSession = Depends(get_db)
):
    """
    Ingest batch discovery payload from remote collector authenticated via X-Site-Key header.
    """
    if not x_site_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Site-Key header"
        )

    service = MultiSiteSyncService(db)
    site = await service.authenticate_site(x_site_key)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or deactivated Site API Key"
        )

    try:
        result = await service.ingest_site_batch(site, payload.batch)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest remote batch: {str(e)}"
        )


@router.get("/nodes")
async def list_remote_nodes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List registered remote collector nodes, connection status, last sync timestamp, and device tally.
    """
    service = MultiSiteSyncService(db)
    nodes = await service.list_nodes()
    return nodes

