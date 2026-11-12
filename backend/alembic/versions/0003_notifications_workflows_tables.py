"""Add notifications and workflows tables

Revision ID: 0003_notifications_workflows_tables
Revises: 0002_plugins_tables
Create Date: 2026-11-12 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003_notifications_workflows_tables'
down_revision = '0002_plugins_tables'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. in_app_notifications
    op.create_table(
        'in_app_notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('severity', sa.String(length=50), nullable=False, server_default='INFO'),
        sa.Column('event_type', sa.String(length=100), nullable=False, server_default='CUSTOM'),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('devices.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_in_app_notifications_is_read'), 'in_app_notifications', ['is_read'], unique=False)
    op.create_index(op.f('ix_in_app_notifications_device_id'), 'in_app_notifications', ['device_id'], unique=False)
    op.create_index(op.f('ix_in_app_notifications_created_at'), 'in_app_notifications', ['created_at'], unique=False)

    # 2. notification_channels
    op.create_table(
        'notification_channels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('channel_type', sa.String(length=50), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('config_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('min_severity', sa.String(length=50), nullable=False, server_default='INFO'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_notification_channels_channel_type'), 'notification_channels', ['channel_type'], unique=False)
    op.create_index(op.f('ix_notification_channels_is_enabled'), 'notification_channels', ['is_enabled'], unique=False)

    # 3. notification_delivery_logs
    op.create_table(
        'notification_delivery_logs',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('channel_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('notification_channels.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='SUCCESS'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_notification_delivery_logs_channel_id'), 'notification_delivery_logs', ['channel_id'], unique=False)
    op.create_index(op.f('ix_notification_delivery_logs_sent_at'), 'notification_delivery_logs', ['sent_at'], unique=False)

    # 4. workflow_rules
    op.create_table(
        'workflow_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('trigger_event', sa.String(length=100), nullable=False),
        sa.Column('conditions_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('actions_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('execution_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_triggered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_workflow_rules_trigger_event'), 'workflow_rules', ['trigger_event'], unique=False)
    op.create_index(op.f('ix_workflow_rules_is_enabled'), 'workflow_rules', ['is_enabled'], unique=False)

    # 5. workflow_execution_logs
    op.create_table(
        'workflow_execution_logs',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('rule_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workflow_rules.id', ondelete='CASCADE'), nullable=False),
        sa.Column('trigger_event', sa.String(length=100), nullable=False),
        sa.Column('matched', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('actions_executed', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_workflow_execution_logs_rule_id'), 'workflow_execution_logs', ['rule_id'], unique=False)
    op.create_index(op.f('ix_workflow_execution_logs_executed_at'), 'workflow_execution_logs', ['executed_at'], unique=False)

def downgrade() -> None:
    op.drop_table('workflow_execution_logs')
    op.drop_table('workflow_rules')
    op.drop_table('notification_delivery_logs')
    op.drop_table('notification_channels')
    op.drop_table('in_app_notifications')
