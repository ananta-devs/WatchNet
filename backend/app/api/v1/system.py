"""
System Maintenance, Backup, Export & Restore REST API Endpoints.
Covers:
- POST /api/v1/system/backup
- POST /api/v1/system/restore
- GET /api/v1/system/backups
- DELETE /api/v1/system/backups/{filename}
- POST /api/v1/system/maintenance/prune
- GET /api/v1/system/maintenance/stats
- POST /api/v1/system/maintenance/vacuum
- GET /api/v1/system/export/devices.csv
- POST /api/v1/system/import/devices.csv
"""
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.entities import User, UserRole
from app.services.system.backup_service import BackupService
from app.services.system.maintenance_service import MaintenanceService

logger = logging.getLogger("watchnet.api.system")

router = APIRouter(prefix="/system", tags=["System Management & Maintenance"])

def require_admin_or_owner(current_user: User = Depends(get_current_user)) -> User:
    """Verifies that the caller has Administrator or Owner role."""
    if current_user.role not in [UserRole.ADMINISTRATOR, UserRole.OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required"
        )
    return current_user


# -------------------------------------------------------------
# Backup & Restore Endpoints
# -------------------------------------------------------------
@router.post("/backup")
async def trigger_backup(
    backup_type: str = Query("json", pattern="^(json|sql|csv)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_owner)
):
    """Generates an immediate backup archive and returns file metadata."""
    svc = BackupService(db)
    filename, filepath = await svc.create_backup(backup_type=backup_type)
    return {
        "status": "success",
        "message": f"Backup created successfully: {filename}",
        "filename": filename,
        "download_url": f"/api/v1/system/backups/{filename}/download"
    }


@router.get("/backups/{filename}/download")
async def download_backup_file(
    filename: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_owner)
):
    """Downloads an existing backup archive."""
    svc = BackupService(db)
    safe_name = Path(filename).name
    from app.services.system.backup_service import BACKUP_DIR
    target_path = BACKUP_DIR / safe_name
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="Backup file not found")
    return FileResponse(
        path=str(target_path),
        filename=safe_name,
        media_type="application/zip"
    )


@router.get("/backups")
async def list_backups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_owner)
):
    """Lists all stored backup archives with size and timestamps."""
    svc = BackupService(db)
    return svc.list_backups()


@router.delete("/backups/{filename}")
async def delete_backup(
    filename: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_owner)
):
    """Deletes a backup archive."""
    svc = BackupService(db)
    deleted = svc.delete_backup(filename)
    if not deleted:
        raise HTTPException(status_code=404, detail="Backup file not found")
    return {"status": "success", "message": f"Backup {filename} deleted successfully"}


@router.post("/restore")
async def restore_backup(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_owner)
):
    """Uploads and restores WatchNet from a backup archive."""
    svc = BackupService(db)
    content = await file.read()
    try:
        result = await svc.restore_backup(content)
        return {
            "status": "success",
            "message": "System restored successfully from backup archive",
            "details": result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Restore endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal restore failure: {str(e)}")


# -------------------------------------------------------------
# Device CSV Export / Import (CSVBCKP Compatible)
# -------------------------------------------------------------
@router.get("/export/devices.csv")
async def export_devices_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Downloads upstream NetAlertX CSVBCKP compatible device CSV."""
    svc = BackupService(db)
    csv_data = await svc.export_devices_csv()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=watchnet_devices_export.csv"}
    )


@router.post("/import/devices.csv")
async def import_devices_csv(
    file: UploadFile = File(...),
    conflict_resolution: str = Query("overwrite", pattern="^(overwrite|skip)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_owner)
):
    """Imports devices from CSV with conflict resolution (overwrite or skip)."""
    svc = BackupService(db)
    raw_content = await file.read()
    try:
        csv_text = raw_content.decode("utf-8-sig")
    except UnicodeDecodeError:
        csv_text = raw_content.decode("latin-1")
    
    result = await svc.import_devices_csv(csv_text, conflict_resolution=conflict_resolution)
    return {
        "status": "success",
        "message": f"CSV import finished: {result['created']} created, {result['updated']} updated, {result['skipped']} skipped",
        "summary": result
    }


# -------------------------------------------------------------
# Maintenance & Pruning Endpoints
# -------------------------------------------------------------
@router.get("/maintenance/stats")
async def get_maintenance_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_owner)
):
    """Returns database storage stats, table counts, and retention periods."""
    svc = MaintenanceService(db)
    return await svc.get_storage_stats()


@router.post("/maintenance/prune")
async def trigger_pruning(
    custom_retention: Optional[Dict[str, int]] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_owner)
):
    """Triggers on-demand pruning of expired telemetry records."""
    svc = MaintenanceService(db)
    prune_res = await svc.prune_expired_data(custom_retention)
    return {
        "status": "success",
        "message": "Data retention pruning completed",
        "pruned": prune_res
    }


@router.post("/maintenance/vacuum")
async def trigger_vacuum(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_owner)
):
    """Executes vacuum / database optimization routine."""
    svc = MaintenanceService(db)
    return await svc.vacuum_and_reindex()
