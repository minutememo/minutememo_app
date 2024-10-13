from flask import Blueprint, request, jsonify, current_app, redirect, url_for, session
from authlib.integrations.flask_client import OAuth
from models import User, Company, MeetingHub, Subscription
import logging
import json
from extensions import db
from flask_login import login_user, logout_user, login_required, current_user
import os
import secrets
from werkzeug.security import generate_password_hash  # Import the password hashing method
import requests
from datetime import datetime, timedelta

auth = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

# Set logging level based on environment
env = os.getenv('FLASK_ENV', 'development')
if env == 'production':
    logger.setLevel(logging.WARNING)
else:
    logger.setLevel(logging.DEBUG)

# Load environment variables from the correct file if needed
from dotenv import load_dotenv
load_dotenv('.env.development')

# OAuth setup
oauth = OAuth(current_app)

# Google OAuth configuration
try:
    logger.debug('Registering Google OAuth client')
    oauth.register(
        name='google',
        client_id=os.getenv('GOOGLE_CLIENT_ID'),
        client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
        access_token_url='https://accounts.google.com/o/oauth2/token',
        authorize_url='https://accounts.google.com/o/oauth2/auth',
        client_kwargs={'scope': 'openid email profile https://www.googleapis.com/auth/calendar'},
        jwks_uri='https://www.googleapis.com/oauth2/v3/certs'  # Add JWKS URI explicitly
    )
    logger.debug('Google OAuth client registered successfully')
except Exception as e:
    logger.error(f"Error during Google OAuth registration: {e}")

def generate_nonce():
    return secrets.token_urlsafe(16)  # Generate a secure random URL-safe nonce

# Route for checking authentication status and user role
@auth.route('/status', methods=['GET'])
def status():
    if current_user.is_authenticated:
        logger.debug(f"User {current_user.email} is authenticated with role: {current_user.internal_user_role}")
        return jsonify({
            "logged_in": True,
            "user": {
                "email": current_user.email,
                "internal_user_role": current_user.internal_user_role  # Return the user's role
            }
        }), 200
    else:
        logger.debug("User is not authenticated")
        return jsonify({"logged_in": False}), 200

@auth.route('/login/google')
def google_login():
    try:
        # Generate a secure random state string to protect against CSRF attacks
        state = secrets.token_urlsafe(16)
        session['oauth_state'] = state  # Store the state in session

        # Construct the redirect URI
        redirect_uri = url_for('auth.google_authorize', _external=True)

        # Log the details for debugging
        logger.debug(f"Google login initiated. Redirect URI: {redirect_uri}, State: {state}")
        logger.debug(f"Client ID: {os.getenv('GOOGLE_CLIENT_ID')}")
        logger.debug(f"Client Secret: {'REDACTED'}")
        logger.debug(f"Session contents: {session}")

        # Trigger Google OAuth flow, redirecting to the Google authorization URL
        # Ensure 'access_type=offline' is set to obtain a refresh token
        return oauth.google.authorize_redirect(
            redirect_uri=redirect_uri,
            state=state,
            access_type='offline',  # Request offline access to obtain a refresh token
            prompt='consent'  # Force re-consent to ensure we get the refresh token
        )
    except Exception as e:
        logger.error(f"Error during Google login: {e}")
        return jsonify({"message": "Error during Google login"}), 500



@auth.route('/callback')
def google_authorize():
    try:
        logger.debug("Google authorization callback reached")

        # Retrieve the OAuth state from the URL parameters
        state = request.args.get('state')
        logger.debug(f"OAuth state: {state}")

        if not state:
            raise ValueError("Missing state in request")

        # Retrieve the OAuth state details from the session using the state as the key
        oauth_state_key = f'_state_google_{state}'
        oauth_state_data = session.get(oauth_state_key)
        logger.debug(f"OAuth state data from session: {oauth_state_data}")

        if not oauth_state_data or 'data' not in oauth_state_data or 'nonce' not in oauth_state_data['data']:
            raise ValueError("Missing nonce in session state data")

        nonce = oauth_state_data['data']['nonce']
        logger.debug(f"Nonce retrieved: {nonce}")

        # Retrieve the token from Google after successful authorization
        token = oauth.google.authorize_access_token()
        logger.debug(f"Token response received: {token}")  # Log the entire token response

        # Parse the user's ID token and validate the nonce
        user_info = oauth.google.parse_id_token(token, nonce=nonce)
        logger.debug(f"User info: {user_info}")

        # Get the user's email from the user info
        email = user_info.get('email')
        if not email:
            raise ValueError("No email found in user info")

        logger.debug(f"User email: {email}")

        # Check if the user already exists in the database
        user = User.query.filter_by(email=email).first()

        # Calculate the token expiration time (current time + token's 'expires_in' value)
        expires_at = datetime.utcnow() + timedelta(seconds=token.get('expires_in', 3600))
        logger.debug(f"Access token expiration time: {expires_at}")

        refresh_token = token.get('refresh_token')  # Get the refresh token if available
        logger.debug(f"Refresh token: {refresh_token}")

        if not user:
            logger.debug(f"Creating new user with email: {email}")
            # Generate a random secure password and hash it
            random_password = secrets.token_urlsafe(16)  # Generate a random string as a "password"
            hashed_password = generate_password_hash(random_password)  # Hash the random password

            # Store the token (as a dictionary) and other details in the user record
            user = User(
                email=email,
                user_type='external',
                password_hash=hashed_password,  # Store the hashed random password
                google_oauth_token=json.dumps(token),  # Store the entire token as JSON
                google_refresh_token=refresh_token,  # Store the refresh token if available
                google_token_expires_at=expires_at
            )
            db.session.add(user)
            db.session.commit()
            logger.debug(f"New user created with email: {email} and tokens stored")
        else:
            # Update user's Google OAuth details if the user exists
            logger.debug(f"Updating existing user {user.email} with new token details")

            # Use the helper function to update the tokens
            update_user_tokens(user, token, refresh_token, expires_at)

            # If the refresh token is missing, force re-consent to get a new one
            if not user.google_refresh_token:
                logger.debug(f"Refresh token is missing for {user.email}, forcing re-consent")
                return oauth.google.authorize_redirect(
                    url_for('auth.google_authorize', _external=True),
                    state=state,
                    prompt='consent'  # Re-consent to get a refresh token
                )

        # Log the user in
        login_user(user)
        logger.info(f"User logged in with Google: {email}")

        # Clear the state from the session after successful login to avoid reuse
        session.pop(oauth_state_key, None)

        # Redirect to the dashboard after successful login
        return redirect('http://localhost:3000/')  # Change to your front-end dashboard route

    except Exception as e:
        logger.error(f"Error during Google authorization: {e}")
        return jsonify({"message": f"Error during Google authorization: {str(e)}"}), 500

# Helper function to refresh the access token using the refresh token
def refresh_google_token(refresh_token):
    try:
        token_url = "https://accounts.google.com/o/oauth2/token"
        payload = {
            'refresh_token': refresh_token,
            'client_id': os.getenv('GOOGLE_CLIENT_ID'),
            'client_secret': os.getenv('GOOGLE_CLIENT_SECRET'),
            'grant_type': 'refresh_token'
        }
        response = requests.post(token_url, data=payload)
        if response.status_code == 200:
            new_token = response.json()
            new_token['expires_at'] = datetime.utcnow() + timedelta(seconds=new_token['expires_in'])
            return new_token
        else:
            logger.error(f"Failed to refresh Google token: {response.text}")
            return None
    except Exception as e:
        logger.error(f"Error refreshing Google token: {str(e)}")
        return None
def update_user_tokens(user, token, refresh_token, expires_at):
    try:
        logger.debug(f"Updating tokens for user {user.email}")
        
        # Store the new access token
        user.google_oauth_token = json.dumps(token)
        
        # Store the refresh token if it's available
        if refresh_token:
            logger.debug(f"Updating refresh token for user {user.email}")
            user.google_refresh_token = refresh_token
        
        # Update token expiration time
        user.google_token_expires_at = expires_at
        
        # Commit changes
        db.session.commit()
        logger.debug(f"Tokens successfully updated for user {user.email}")
    except Exception as e:
        logger.error(f"Failed to update tokens for user {user.email}: {str(e)}")
        db.session.rollback()  # Roll back in case of error

# Microsoft Login Route (if applicable)
@auth.route('/login/microsoft')
def microsoft_login():
    try:
        redirect_uri = url_for('auth.microsoft_authorize', _external=True)
        logger.debug(f"Microsoft login initiated. Redirect URI: {redirect_uri}")
        return oauth.microsoft.authorize_redirect(redirect_uri)
    except Exception as e:
        logger.error(f"Error during Microsoft login: {e}")
        return jsonify({"message": "Error during Microsoft login"}), 500

# Microsoft Authorization Callback
@auth.route('/login/microsoft/authorize')
def microsoft_authorize():
    try:
        logger.debug("Microsoft authorization callback reached")
        token = oauth.microsoft.authorize_access_token()
        logger.debug(f"Token received: {token}")
        user_info = oauth.microsoft.get('me').json()
        logger.debug(f"User info: {user_info}")

        email = user_info.get('mail', user_info.get('userPrincipalName'))
        first_name = user_info.get('givenName')
        last_name = user_info.get('surname')

        user = User.query.filter_by(email=email).first()

        if not user:
            logger.debug(f"Creating new user with email: {email}")
            user = User(email=email, first_name=first_name, last_name=last_name, user_type='external')
            db.session.add(user)
            db.session.commit()

        login_user(user)
        logger.info(f"User logged in with Microsoft: {email}")
        return redirect(url_for('auth.status'))
    except Exception as e:
        logger.error(f"Error during Microsoft authorization: {e}")
        return jsonify({"message": "Error during Microsoft authorization"}), 500

# Regular user signup route
@auth.route('/signup', methods=['POST'])
def signup():
    logger.debug('Signup route hit')

    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    password_confirmation = data.get('password_confirmation')

    if not email or not password or not password_confirmation:
        logger.warning('Missing email, password, or password confirmation')
        return jsonify({'message': 'Email, password, and password confirmation are required'}), 400

    if password != password_confirmation:
        logger.warning('Passwords do not match')
        return jsonify({'message': 'Passwords do not match'}), 400

    user_exists = User.query.filter_by(email=email).first()
    if user_exists:
        logger.warning(f"Email is already in use: {email}")
        return jsonify({'message': 'Email is already in use'}), 400

    new_user = User(email=email, user_type='external')
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()

    login_user(new_user)
    logger.info(f"User created and logged in successfully: {email}")
    return jsonify({'message': 'User created and logged in successfully'}), 201

# Regular user login route
@auth.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    logger.debug(f"Login attempt for email: {email}")
    user = User.query.filter_by(email=email).first()

    if user and user.check_password(password):
        login_user(user, remember=True)
        logger.debug(f"Login successful for user: {user.email}")
        return jsonify({
            "message": "Login successful",
            "internal_user_role": user.internal_user_role  # Return user's role for frontend checks
        }), 200
    
    logger.warning(f"Login failed for email: {email}")
    return jsonify({"message": "Invalid credentials"}), 401

# User logout route
@auth.route('/logout')
@login_required
def logout():
    logger.debug(f"User {current_user.email} is logging out")
    logout_user()  # This clears the session on the server
    response = jsonify({"message": "Logout successful"})
    response.status_code = 200
    return response