"""0006_monitoring_tables

Revision ID: 17ae494c5545
Revises: 0005_routers_family_safety_tables
Create Date: 2026-11-14 12:35:26.333395

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '17ae494c5545'
down_revision: Union[str, Sequence[str], None] = '0005_routers_family_safety_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'internet_health_logs',
        sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('wan_ip', sa.String(length=45), nullable=True),
        sa.Column('gateway_latency_ms', sa.Float(), nullable=True),
        sa.Column('dns_resolution_ms', sa.Float(), nullable=True),
        sa.Column('is_connected', sa.Boolean(), nullable=False),
        sa.Column('details', sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_internet_health_logs_is_connected'), 'internet_health_logs', ['is_connected'], unique=False)
    op.create_index(op.f('ix_internet_health_logs_timestamp'), 'internet_health_logs', ['timestamp'], unique=False)

    op.create_table(
        'speedtest_results',
        sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('download_mbps', sa.Float(), nullable=False),
        sa.Column('upload_mbps', sa.Float(), nullable=False),
        sa.Column('ping_ms', sa.Float(), nullable=False),
        sa.Column('jitter_ms', sa.Float(), nullable=False),
        sa.Column('server_name', sa.String(length=255), nullable=True),
        sa.Column('server_location', sa.String(length=255), nullable=True),
        sa.Column('client_ip', sa.String(length=45), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_speedtest_results_timestamp'), 'speedtest_results', ['timestamp'], unique=False)

    op.create_table(
        'website_targets',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('url', sa.String(length=2048), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('check_interval_sec', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('last_status_code', sa.Integer(), nullable=True),
        sa.Column('last_latency_ms', sa.Float(), nullable=True),
        sa.Column('ssl_days_remaining', sa.Integer(), nullable=True),
        sa.Column('is_up', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_website_targets_is_active'), 'website_targets', ['is_active'], unique=False)

    op.create_table(
        'website_check_logs',
        sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
        sa.Column('target_id', sa.UUID(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('latency_ms', sa.Float(), nullable=True),
        sa.Column('is_up', sa.Boolean(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['target_id'], ['website_targets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_website_check_logs_target_id'), 'website_check_logs', ['target_id'], unique=False)
    op.create_index(op.f('ix_website_check_logs_timestamp'), 'website_check_logs', ['timestamp'], unique=False)

    op.create_table(
        'device_port_scans',
        sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
        sa.Column('device_id', sa.UUID(), nullable=False),
        sa.Column('port', sa.Integer(), nullable=False),
        sa.Column('protocol', sa.String(length=10), nullable=False),
        sa.Column('service_name', sa.String(length=100), nullable=True),
        sa.Column('state', sa.String(length=20), nullable=False),
        sa.Column('banner', sa.Text(), nullable=True),
        sa.Column('last_scanned', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_device_port_protocol', 'device_port_scans', ['device_id', 'port', 'protocol'], unique=True)
    op.create_index(op.f('ix_device_port_scans_device_id'), 'device_port_scans', ['device_id'], unique=False)
    op.create_index(op.f('ix_device_port_scans_last_scanned'), 'device_port_scans', ['last_scanned'], unique=False)

    op.add_column('routers', sa.Column('integration_level', sa.String(length=50), nullable=True, server_default='read_only_api'))


def downgrade() -> None:
    op.drop_column('routers', 'integration_level')
    op.drop_index(op.f('ix_device_port_scans_last_scanned'), table_name='device_port_scans')
    op.drop_index(op.f('ix_device_port_scans_device_id'), table_name='device_port_scans')
    op.drop_index('ix_device_port_protocol', table_name='device_port_scans')
    op.drop_table('device_port_scans')
    op.drop_index(op.f('ix_website_check_logs_timestamp'), table_name='website_check_logs')
    op.drop_index(op.f('ix_website_check_logs_target_id'), table_name='website_check_logs')
    op.drop_table('website_check_logs')
    op.drop_index(op.f('ix_website_targets_is_active'), table_name='website_targets')
    op.drop_table('website_targets')
    op.drop_index(op.f('ix_speedtest_results_timestamp'), table_name='speedtest_results')
    op.drop_table('speedtest_results')
    op.drop_index(op.f('ix_internet_health_logs_timestamp'), table_name='internet_health_logs')
    op.drop_index(op.f('ix_internet_health_logs_is_connected'), table_name='internet_health_logs')
    op.drop_table('internet_health_logs')
