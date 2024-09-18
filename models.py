from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from extensions import db
import uuid
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    address = db.Column(db.String(256))
    city = db.Column(db.String(64))
    state = db.Column(db.String(64))
    zip_code = db.Column(db.String(10))
    country = db.Column(db.String(64))
    phone_number = db.Column(db.String(20))
    users = db.relationship('User', backref='company', lazy=True)
    
    # Added relationship for subscription
    subscriptions = db.relationship('Subscription', backref='company', lazy=True)
    payments = db.relationship('Payment', backref='company', lazy=True)  # Payments relationship


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(512), nullable=False)
    first_name = db.Column(db.String(64))
    last_name = db.Column(db.String(64))
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'))
    recordings = db.relationship('Recording', backref='user', lazy=True)
    meeting_hubs = db.relationship('MeetingHub', secondary='user_meeting_hub', backref=db.backref('users', lazy=True))
    meetings = db.relationship('Meeting', secondary='user_meeting', backref=db.backref('users', lazy=True))
    meeting_sessions = db.relationship('MeetingSession', secondary='user_meeting_session', backref=db.backref('users', lazy=True))
    
    # Add this line for active meeting hub
    active_meeting_hub_id = db.Column(db.Integer, db.ForeignKey('meeting_hub.id'), nullable=True)
    user_type = db.Column(db.String(20), nullable=False, default='internal')  # 'internal' or 'external'
    internal_user_role = db.Column(db.String(20), nullable=True)  # 'super_admin', 'admin', 'lite_admin'

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Subscription(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)  # Link to the Company
    plan_name = db.Column(db.String(64), nullable=False)  # Subscription plan name
    price = db.Column(db.Float, nullable=False)  # Price of the subscription
    billing_cycle = db.Column(db.String(20), nullable=False)  # e.g., 'monthly', 'yearly'
    max_users = db.Column(db.Integer, nullable=False)  # Maximum number of users allowed in the subscription
    status = db.Column(db.String(20), nullable=False, default='active')  # Subscription status
    start_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)  # When the subscription started
    end_date = db.Column(db.DateTime, nullable=True)  # Nullable if the subscription is ongoing
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

class Payment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    subscription_id = db.Column(db.Integer, db.ForeignKey('subscription.id'), nullable=False)  # Link to the Subscription
    amount = db.Column(db.Float, nullable=False)  # Amount paid
    payment_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    payment_method = db.Column(db.String(50), nullable=False)  # e.g., 'credit card', 'bank transfer'
    status = db.Column(db.String(20), nullable=False, default='successful')  # Payment status (e.g., successful, failed)


class MeetingHub(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.String(256))
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    meetings = db.relationship('Meeting', backref='meeting_hub', lazy=True)


class Meeting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.String(256))
    meeting_hub_id = db.Column(db.Integer, db.ForeignKey('meeting_hub.id'), nullable=False)
    is_recurring = db.Column(db.Boolean, default=False)
    meeting_sessions = db.relationship('MeetingSession', backref='meeting', lazy=True)


class MeetingSession(db.Model):
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

class ActionItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    summary = db.Column(db.Text, nullable=False)  # Updated to Text field
    description = db.Column(db.Text, nullable=False)  # Detailed action point description
    assigned_to = db.Column(db.String(128))  # Who is responsible for the action
    due_date = db.Column(db.DateTime)  # Optional due date for the action
    completed = db.Column(db.Boolean, default=False)  # Completion status
    status = db.Column(db.String(50), nullable=False, default='explicit')  # explicit or suggested
    meeting_session_id = db.Column(db.Integer, db.ForeignKey('meeting_session.id'), nullable=False)  # Link to meeting session


class Recording(db.Model):
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, nullable=False)
    file_name = db.Column(db.String(256), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    concatenation_status = db.Column(db.String(10), nullable=False)
    concatenation_file_name = db.Column(db.String(256), nullable=False)
    meeting_session_id = db.Column(db.Integer, db.ForeignKey('meeting_session.id'), nullable=False)


# Junction table to manage many-to-many relationship between User and MeetingHub
user_meeting_hub = db.Table('user_meeting_hub',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('meeting_hub_id', db.Integer, db.ForeignKey('meeting_hub.id'), primary_key=True)
)

# Junction table to manage many-to-many relationship between User and Meeting
user_meeting = db.Table('user_meeting',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('meeting_id', db.Integer, db.ForeignKey('meeting.id'), primary_key=True)
)

# Correct definition for the user_meeting_session table
user_meeting_session = db.Table('user_meeting_session',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('meeting_session_id', db.Integer, db.ForeignKey('meeting_session.id'), primary_key=True)
)