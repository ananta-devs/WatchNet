"""Add routers and family safety tables

Revision ID: 0005_routers_family_safety_tables
Revises: 0004_multisite_tables
Create Date: 2026-11-12 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0005_routers_family_safety_tables'
down_revision = '0004_multisite_tables'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. routers
    op.create_table(
        'routers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('vendor', sa.String(length=50), nullable=False, server_default='Generic'),
        sa.Column('model', sa.String(length=255), nullable=True),
        sa.Column('firmware', sa.String(length=255), nullable=True),
        sa.Column('host', sa.String(length=255), nullable=False),
        sa.Column('port', sa.Integer(), nullable=False, server_default='80'),
        sa.Column('username', sa.String(length=255), nullable=True),
        sa.Column('password_encrypted', sa.String(length=1024), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('last_connected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('client_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_routers_vendor'), 'routers', ['vendor'], unique=False)
    op.create_index(op.f('ix_routers_host'), 'routers', ['host'], unique=False)

    # 2. household_profiles
    op.create_table(
        'household_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='Child'),
        sa.Column('avatar', sa.String(length=255), nullable=True),
        sa.Column('is_paused', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('pause_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 3. profile_devices
    op.create_table(
        'profile_devices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('profile_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('household_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('devices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_profile_devices_profile_id'), 'profile_devices', ['profile_id'], unique=False)
    op.create_index(op.f('ix_profile_devices_device_id'), 'profile_devices', ['device_id'], unique=False)
    op.create_index('ix_profile_device_unique', 'profile_devices', ['profile_id', 'device_id'], unique=True)

    # 4. dns_policies
    op.create_table(
        'dns_policies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('profile_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('household_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('categories_json', sa.JSON(), nullable=False),
        sa.Column('blocked_domains_json', sa.JSON(), nullable=False),
        sa.Column('allowed_domains_json', sa.JSON(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_dns_policies_profile_id'), 'dns_policies', ['profile_id'], unique=False)

    # 5. access_schedules
    op.create_table(
        'access_schedules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('profile_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('household_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('days_of_week', sa.JSON(), nullable=False),
        sa.Column('start_time', sa.String(length=5), nullable=False),
        sa.Column('end_time', sa.String(length=5), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_access_schedules_profile_id'), 'access_schedules', ['profile_id'], unique=False)

    # 6. dns_activity_logs
    op.create_table(
        'dns_activity_logs',
        sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), "sqlite"), primary_key=True, autoincrement=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('devices.id', ondelete='SET NULL'), nullable=True),
        sa.Column('profile_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('household_profiles.id', ondelete='SET NULL'), nullable=True),
        sa.Column('domain', sa.String(length=512), nullable=False),
        sa.Column('query_type', sa.String(length=16), nullable=False, server_default='A'),
        sa.Column('action', sa.String(length=50), nullable=False, server_default='ALLOWED'),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('resolver_source', sa.String(length=100), nullable=False, server_default='AdGuardHome'),
    )
    op.create_index(op.f('ix_dns_activity_logs_timestamp'), 'dns_activity_logs', ['timestamp'], unique=False)
    op.create_index(op.f('ix_dns_activity_logs_device_id'), 'dns_activity_logs', ['device_id'], unique=False)
    op.create_index(op.f('ix_dns_activity_logs_profile_id'), 'dns_activity_logs', ['profile_id'], unique=False)
    op.create_index(op.f('ix_dns_activity_logs_domain'), 'dns_activity_logs', ['domain'], unique=False)
    op.create_index(op.f('ix_dns_activity_logs_action'), 'dns_activity_logs', ['action'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_dns_activity_logs_action'), table_name='dns_activity_logs')
    op.drop_index(op.f('ix_dns_activity_logs_domain'), table_name='dns_activity_logs')
    op.drop_index(op.f('ix_dns_activity_logs_profile_id'), table_name='dns_activity_logs')
    op.drop_index(op.f('ix_dns_activity_logs_device_id'), table_name='dns_activity_logs')
    op.drop_index(op.f('ix_dns_activity_logs_timestamp'), table_name='dns_activity_logs')
    op.drop_table('dns_activity_logs')

    op.drop_index(op.f('ix_access_schedules_profile_id'), table_name='access_schedules')
    op.drop_table('access_schedules')

    op.drop_index(op.f('ix_dns_policies_profile_id'), table_name='dns_policies')
    op.drop_table('dns_policies')

    op.drop_index('ix_profile_device_unique', table_name='profile_devices')
    op.drop_index(op.f('ix_profile_devices_device_id'), table_name='profile_devices')
    op.drop_index(op.f('ix_profile_devices_profile_id'), table_name='profile_devices')
    op.drop_table('profile_devices')

    op.drop_table('household_profiles')

    op.drop_index(op.f('ix_routers_host'), table_name='routers')
    op.drop_index(op.f('ix_routers_vendor'), table_name='routers')
    op.drop_table('routers')

