"""Add multisite remote sites and sync logs tables

Revision ID: 0004_multisite_tables
Revises: 0003_notifications_workflows_tables
Create Date: 2026-11-12 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0004_multisite_tables'
down_revision = '0003_notifications_workflows_tables'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. remote_sites
    op.create_table(
        'remote_sites',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('interface', sa.String(length=50), nullable=True),
        sa.Column('api_key_hash', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=True),
        sa.Column('device_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_remote_sites_name'), 'remote_sites', ['name'], unique=True)
    op.create_index(op.f('ix_remote_sites_is_active'), 'remote_sites', ['is_active'], unique=False)

    # 2. site_sync_logs
    op.create_table(
        'site_sync_logs',
        sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), "sqlite"), primary_key=True, autoincrement=True),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('remote_sites.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='SUCCESS'),
        sa.Column('devices_synced', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_site_sync_logs_site_id'), 'site_sync_logs', ['site_id'], unique=False)
    op.create_index(op.f('ix_site_sync_logs_timestamp'), 'site_sync_logs', ['timestamp'], unique=False)

    # 3. Add site_id to devices
    op.add_column('devices', sa.Column('site_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('remote_sites.id', ondelete='SET NULL'), nullable=True))
    op.create_index(op.f('ix_devices_site_id'), 'devices', ['site_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_devices_site_id'), table_name='devices')
    op.drop_column('devices', 'site_id')
    op.drop_index(op.f('ix_site_sync_logs_timestamp'), table_name='site_sync_logs')
    op.drop_index(op.f('ix_site_sync_logs_site_id'), table_name='site_sync_logs')
    op.drop_table('site_sync_logs')
    op.drop_index(op.f('ix_remote_sites_is_active'), table_name='remote_sites')
    op.drop_index(op.f('ix_remote_sites_name'), table_name='remote_sites')
    op.drop_table('remote_sites')

