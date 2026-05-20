"""Add passenger alert lifecycle tracking

Revision ID: b1f6103a2c9f
Revises: 6605f7095eae
Create Date: 2026-05-19 12:19:54.801446

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b1f6103a2c9f'
down_revision: Union[str, Sequence[str], None] = '6605f7095eae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('passenger_alert_subscriptions', sa.Column('status', sa.String(length=20), nullable=False, server_default='ACTIVE'))
    op.add_column('passenger_alert_subscriptions', sa.Column('completed_at', sa.TIMESTAMP(), nullable=True))
    op.add_column('passenger_alert_subscriptions', sa.Column('completion_reason', sa.String(length=50), nullable=True))
    op.add_column('passenger_alert_subscriptions', sa.Column('last_checked_at', sa.TIMESTAMP(), nullable=True))
    op.add_column('passenger_alert_subscriptions', sa.Column('last_notified_status', sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('passenger_alert_subscriptions', 'last_notified_status')
    op.drop_column('passenger_alert_subscriptions', 'last_checked_at')
    op.drop_column('passenger_alert_subscriptions', 'completion_reason')
    op.drop_column('passenger_alert_subscriptions', 'completed_at')
    op.drop_column('passenger_alert_subscriptions', 'status')
