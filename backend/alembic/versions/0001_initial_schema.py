"""Initial database migration for WatchNet

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-11-12 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    # 2. devices
    op.create_table(
        'devices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('mac', sa.String(length=17), nullable=False),
        sa.Column('ipv4', sa.String(length=45), nullable=True),
        sa.Column('ipv6', sa.String(length=45), nullable=True),
        sa.Column('vendor', sa.String(length=255), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('interface', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('first_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('custom_properties', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
    )
    op.create_index(op.f('ix_devices_mac'), 'devices', ['mac'], unique=True)
    op.create_index(op.f('ix_devices_ipv4'), 'devices', ['ipv4'], unique=False)
    op.create_index(op.f('ix_devices_last_seen'), 'devices', ['last_seen'], unique=False)

    # 3. device_sessions (with monthly partition architecture support)
    op.create_table(
        'device_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('devices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('session_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
    )
    op.create_index(op.f('ix_device_sessions_device_id'), 'device_sessions', ['device_id'], unique=False)
    op.create_index(op.f('ix_device_sessions_session_start'), 'device_sessions', ['session_start'], unique=False)
    op.create_index(op.f('ix_device_sessions_is_active'), 'device_sessions', ['is_active'], unique=False)

    # 4. network_events (with monthly partition schema support)
    op.create_table(
        'network_events',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('devices.id', ondelete='SET NULL'), nullable=True),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_network_events_device_id'), 'network_events', ['device_id'], unique=False)
    op.create_index(op.f('ix_network_events_event_type'), 'network_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_network_events_timestamp'), 'network_events', ['timestamp'], unique=False)

    # 5. presence_history (24-bit compact hourly presence bitmap)
    op.create_table(
        'presence_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('devices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('hourly_bitmap', sa.Integer(), nullable=False, server_default='0'),
    )
    op.create_index(op.f('ix_presence_history_device_id'), 'presence_history', ['device_id'], unique=False)
    op.create_index(op.f('ix_presence_history_date'), 'presence_history', ['date'], unique=False)
    op.create_index('ix_presence_device_date', 'presence_history', ['device_id', 'date'], unique=True)

    # 6. audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('resource', sa.String(length=255), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_audit_logs_actor_id'), 'audit_logs', ['actor_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_timestamp'), 'audit_logs', ['timestamp'], unique=False)

    # 7. system_settings
    op.create_table(
        'system_settings',
        sa.Column('key', sa.String(length=150), primary_key=True),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('is_encrypted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

def downgrade() -> None:
    op.drop_table('system_settings')
    op.drop_table('audit_logs')
    op.drop_table('presence_history')
    op.drop_table('network_events')
    op.drop_table('device_sessions')
    op.drop_table('devices')
    op.drop_table('users')
