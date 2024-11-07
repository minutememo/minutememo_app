from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey, Boolean, Text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
import uuid
from extensions import db
from enum import Enum

# ==========================
# Association Tables
# ==========================

# Association table for many-to-many relationship between User and Company
user_company_association = db.Table(
    'user_company_association',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('company_id', db.Integer, db.ForeignKey('company.id'), primary_key=True),
    db.UniqueConstraint('user_id', 'company_id', name='uix_user_company_association'),
    extend_existing=True
)

# Existing Junction table for User and MeetingHub
user_meeting_hub = db.Table(
    'user_meeting_hub',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('meeting_hub_id', db.Integer, db.ForeignKey('meeting_hub.id'), primary_key=True),
    db.UniqueConstraint('user_id', 'meeting_hub_id', name='uix_user_meeting_hub'),
    extend_existing=True
)

# Existing Junction table for User and MeetingSession
user_meeting_session = db.Table(
    'user_meeting_session',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('meeting_session_id', db.Integer, db.ForeignKey('meeting_session.id'), primary_key=True),
    db.UniqueConstraint('user_id', 'meeting_session_id', name='uix_user_meeting_session'),
    extend_existing=True
)

# ==========================
# Models
# ==========================

class Company(db.Model):
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    address = db.Column(db.String(256))
    city = db.Column(db.String(64))
    state = db.Column(db.String(64))
    zip_code = db.Column(db.String(10))
    country = db.Column(db.String(64))
    phone_number = db.Column(db.String(20))

    # Existing one-to-many relationship
    users = db.relationship('User', backref='company', lazy=True)

    # Existing relationships
    departments = db.relationship('Department', backref='company', lazy=True)
    roles = db.relationship('Role', backref='company', lazy=True)
    subscriptions = db.relationship('Subscription', backref='company', lazy=True)
    payments = db.relationship('Payment', backref='company', lazy=True)

    # Access to additional users via backref from User
    # company.additional_users will be available through User.additional_companies


class MeetingParticipant(db.Model):
    __tablename__ = 'meeting_participants'  # **Explicitly define the table name**

    __table_args__ = (
        UniqueConstraint('meeting_id', 'user_id', name='uix_meeting_user'),
        {'extend_existing': True}
    )

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey('meeting.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    raci_role_id = db.Column(db.Integer, db.ForeignKey('raci_role.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class User(UserMixin, db.Model):
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(512), nullable=False)
    first_name = db.Column(db.String(64))
    last_name = db.Column(db.String(64))
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'))

    sso_platform = db.Column(db.String(10), nullable=True)  # 'google' or 'microsoft'

    # Existing Relationships
    recordings = db.relationship('Recording', backref='user', lazy=True)
    meeting_hubs = db.relationship(
        'MeetingHub',
        secondary=user_meeting_hub,
        backref=db.backref('users', lazy='dynamic')
    )
    meetings = db.relationship(
        'Meeting',
        secondary='meeting_participants',
        backref=db.backref('users', lazy='dynamic')
    )
    meeting_sessions = db.relationship(
        'MeetingSession',
        secondary=user_meeting_session,
        backref=db.backref('users', lazy='dynamic')
    )

    # New Many-to-Many Relationship
    additional_companies = db.relationship(
        'Company',
        secondary=user_company_association,
        backref=db.backref('additional_users', lazy='dynamic'),
        lazy='dynamic'
    )

    # Role and status fields
    role_assignments = db.relationship('UserRoleAssignment', backref='user', lazy='dynamic')
    meeting_participants = db.relationship('MeetingParticipant', backref='user', lazy='dynamic')

    # User activity status
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    is_suspended = db.Column(db.Boolean, nullable=False, default=False)
    is_banned = db.Column(db.Boolean, nullable=False, default=False)

    # Active meeting hub reference
    active_meeting_hub_id = db.Column(db.Integer, db.ForeignKey('meeting_hub.id'), nullable=True)

    # OAuth token storage fields
    google_oauth_token = db.Column(db.Text, nullable=True)
    google_refresh_token = db.Column(db.Text, nullable=True)
    google_token_expires_at = db.Column(db.DateTime, nullable=True)

    microsoft_oauth_token = db.Column(db.Text, nullable=True)
    microsoft_refresh_token = db.Column(db.Text, nullable=True)
    microsoft_token_expires_at = db.Column(db.DateTime, nullable=True)

    # Password management
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    # Token validity checkers
    def is_google_token_valid(self):
        if self.google_token_expires_at:
            return datetime.utcnow() < self.google_token_expires_at
        return False

    def is_microsoft_token_valid(self):
        if self.microsoft_token_expires_at:
            return datetime.utcnow() < self.microsoft_token_expires_at
        return False

    # Token refreshing logic (if you need automatic refreshes)
    def refresh_google_token(self):
        if not self.is_google_token_valid():
            # Add logic to refresh Google token using the stored refresh token
            pass

    def refresh_microsoft_token(self):
        if not self.is_microsoft_token_valid():
            # Add logic to refresh Microsoft token using the stored refresh token
            pass


class Department(db.Model):
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.String(256))

    # Relationships
    user_role_assignments = db.relationship('UserRoleAssignment', backref='department', lazy='dynamic')


class Role(db.Model):
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    name = db.Column(db.String(64), nullable=False)
    description = db.Column(db.String(256))
    hierarchy_level = db.Column(db.Integer, nullable=False)  # Lower number indicates higher authority

    # Relationships
    user_role_assignments = db.relationship('UserRoleAssignment', backref='role', lazy='dynamic')


class UserRoleAssignment(db.Model):
    __table_args__ = (
        UniqueConstraint('user_id', 'role_id', 'department_id', 'hub_id', name='uix_user_role_scope'),
        {'extend_existing': True}
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('role.id'), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=True)
    hub_id = db.Column(db.Integer, db.ForeignKey('meeting_hub.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

    # Relationships
    hub = db.relationship(
        'MeetingHub',
        back_populates='user_role_assignments'
        # Removed 'lazy' parameter
    )


class MeetingHub(db.Model):
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.String(256))
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # Track who created the hub
    admin_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # Track admin if different from creator

    # Relationships
    meetings = db.relationship('Meeting', backref='meeting_hub', lazy=True)
    user_role_assignments = db.relationship(
        'UserRoleAssignment',
        back_populates='hub',
        lazy='dynamic'  # One-to-Many relationship; 'dynamic' is acceptable here
    )


class VisibilitySettings(str, Enum):
    ALL_HUB_MEMBERS = 'all_hub_members'
    PARTICIPANTS = 'participants'
    PRIVATE = 'private'


class Meeting(db.Model):
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.String(256))
    is_recurring = db.Column(db.Boolean, default=False)
    recurring_event_id = db.Column(db.String(255), unique=True)
    meeting_hub_id = db.Column(db.Integer, db.ForeignKey('meeting_hub.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # New visibility field with default setting
    visibility = db.Column(db.String(32), nullable=False, default=VisibilitySettings.PARTICIPANTS)

    # Relationships
    meeting_sessions = db.relationship('MeetingSession', backref='meeting', lazy=True)
    participants = db.relationship('MeetingParticipant', backref='meeting', lazy='dynamic')
    
    def is_visible_to_user(self, user):
        """
        Determine if the meeting is visible to the given user based on visibility settings.
        """
        if self.visibility == VisibilitySettings.ALL_HUB_MEMBERS:
            # The meeting is visible to all members of the hub
            return any(hub.id == self.meeting_hub_id for hub in user.meeting_hubs)
        elif self.visibility == VisibilitySettings.PARTICIPANTS:
            # The meeting is only visible to participants
            return any(participant.user_id == user.id for participant in self.participants)
        elif self.visibility == VisibilitySettings.PRIVATE:
            # The meeting is only visible to the organizer (created_by)
            return self.created_by == user.id
        return False


class RaciRole(db.Model):
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)  # E.g., 'Responsible', 'Accountable', 'Consulted', 'Informed'
    description = db.Column(db.String(256))

    # Relationships
    meeting_participants = db.relationship('MeetingParticipant', backref='raci_role', lazy='dynamic')


class MeetingSession(db.Model):
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(256), nullable=False)
    session_datetime = db.Column(db.DateTime, nullable=False)
    agenda = db.Column(db.Text)
    notes = db.Column(db.Text)
    meeting_id = db.Column(db.Integer, db.ForeignKey('meeting.id'), nullable=True)
    audio_url = db.Column(db.Text)  # Audio URL for the session
    transcription = db.Column(db.Text)  # Field for storing the transcription
    recordings = db.relationship('Recording', backref='meeting_session', lazy=True)
    action_items = db.relationship('ActionItem', backref='meeting_session', lazy=True)
    short_summary = db.Column(db.Text)  # Store short summary
    long_summary = db.Column(db.Text)  # Store long summary


class ActionItem(db.Model):
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    assigned_to = db.Column(db.String(128))
    due_date = db.Column(db.DateTime)
    completed = db.Column(db.Boolean, default=False)
    status = db.Column(db.String(50), nullable=False, default='explicit')
    meeting_session_id = db.Column(db.Integer, db.ForeignKey('meeting_session.id'), nullable=False)
    sorting_id = db.Column(db.Integer, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'assigned_to': self.assigned_to,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'completed': self.completed,
            'status': self.status,
            'meeting_session_id': self.meeting_session_id,
            'sorting_id': self.sorting_id
        }


class Recording(db.Model):
    __table_args__ = {'extend_existing': True}

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, nullable=False)
    file_name = db.Column(db.String(256), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    concatenation_status = db.Column(db.String(10), nullable=False)
    concatenation_file_name = db.Column(db.String(256), nullable=False)
    meeting_session_id = db.Column(db.Integer, db.ForeignKey('meeting_session.id'), nullable=False)


class Subscription(db.Model):
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    plan_name = db.Column(db.String(64), nullable=False)
    price = db.Column(db.Float, nullable=False)
    billing_cycle = db.Column(db.String(20), nullable=False)
    max_users = db.Column(db.Integer, nullable=False)  # Maximum users allowed per subscription
    status = db.Column(db.String(20), nullable=False, default='active')
    start_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    end_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

    # Relationship to Payments
    payments = db.relationship('Payment', backref='subscription', lazy=True)

    @property
    def is_active(self):
        """Check if the subscription is currently active."""
        if self.status != 'active':
            return False
        if self.end_date and self.end_date < datetime.utcnow():
            return False
        return True

    @property
    def active_users_count(self):
        """Count the number of active users under this subscription."""
        return User.query.filter_by(company_id=self.company_id, is_active=True, is_suspended=False).count()


class Payment(db.Model):
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    subscription_id = db.Column(db.Integer, db.ForeignKey('subscription.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    payment_method = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='successful')


# ==========================
# Additional Models (if any)
# ==========================

# If you have additional models not shown here, ensure they are included below.
# For example, models like 'PaymentMethod', 'Invoice', etc.


# ==========================
# Helper Methods or Additional Classes
# ==========================

# Include any helper functions, mixins, or additional classes below.