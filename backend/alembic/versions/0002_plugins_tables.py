"""Add plugin records and execution logs tables

Revision ID: 0002_plugins_tables
Revises: 0001_initial_schema
Create Date: 2026-11-12 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002_plugins_tables'
down_revision = '0001_initial_schema'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. plugins
    op.create_table(
        'plugins',
        sa.Column('plugin_id', sa.String(length=100), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('schedule_interval_sec', sa.Integer(), nullable=False, server_default='300'),
        sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_status', sa.String(length=50), nullable=False, server_default='idle'),
        sa.Column('config_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_plugins_category'), 'plugins', ['category'], unique=False)
    op.create_index(op.f('ix_plugins_is_enabled'), 'plugins', ['is_enabled'], unique=False)

    # 2. plugin_execution_logs
    op.create_table(
        'plugin_execution_logs',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('plugin_id', sa.String(length=100), sa.ForeignKey('plugins.plugin_id', ondelete='CASCADE'), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_ms', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='running'),
        sa.Column('items_produced', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('log_output', sa.Text(), nullable=False, server_default="''"),
        sa.Column('error', sa.Text(), nullable=True),
    )
    op.create_index(op.f('ix_plugin_execution_logs_plugin_id'), 'plugin_execution_logs', ['plugin_id'], unique=False)
    op.create_index(op.f('ix_plugin_execution_logs_started_at'), 'plugin_execution_logs', ['started_at'], unique=False)

def downgrade() -> None:
    op.drop_table('plugin_execution_logs')
    op.drop_table('plugins')
