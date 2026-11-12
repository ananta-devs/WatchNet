from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.monitoring import TopologyResponse
from app.services.monitoring.topology_service import TopologyService

router = APIRouter(prefix="/topology", tags=["Topology"])

@router.get("", response_model=TopologyResponse)
async def get_network_topology(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Dynamic graph nodes and edges representing network hierarchy:
    WAN Gateway -> Switches / APs -> Clients.
    """
    service = TopologyService(db)
    topology_data = await service.build_topology()
    return topology_data
