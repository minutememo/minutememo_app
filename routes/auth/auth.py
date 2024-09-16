from flask import Blueprint, request, jsonify, current_app
from models import User, Company, MeetingHub
import logging
from extensions import db
from flask_login import login_user, logout_user, login_required, current_user
import os

auth = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

# Set logging level based on environment
env = os.getenv('FLASK_ENV', 'development')
if env == 'production':
    logger.setLevel(logging.WARNING)
else:
    logger.setLevel(logging.DEBUG)

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

# Route for user signup
@auth.route('/signup', methods=['POST', 'OPTIONS'])
def signup():
    logger.debug('Signup route hit')

    if request.method == 'OPTIONS':
        logger.debug('Handling CORS preflight request')
        response = current_app.make_default_options_response()
        response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin')
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        return response

    # Handle POST request
    data = request.get_json()
    logger.debug('Data received: %s', data)
    
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

    new_user = User(email=email)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()

    # Create a default company for the new user
    default_company = Company(
        name=f"{email}'s Company",
        address="Default Address",
        city="Default City",
        state="Default State",
        zip_code="00000",
        country="Default Country",
        phone_number="000-000-0000"
    )
    db.session.add(default_company)
    db.session.commit()

    # Link the company to the user
    new_user.company_id = default_company.id
    db.session.commit()

    # Create a default meeting hub for the new user's company
    default_hub = MeetingHub(
        name="My Meeting Hub",
        description="Default meeting hub",
        company_id=default_company.id
    )
    db.session.add(default_hub)
    db.session.commit()

    # Log the user in automatically
    login_user(new_user)

    logger.info(f"User, company, and default meeting hub created and user logged in successfully: {email}")
    return jsonify({'message': 'User created and logged in successfully'}), 201

# Route for user login
@auth.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    logger.debug(f"Login attempt for email: {email}")
    
    user = User.query.filter_by(email=email).first()

    if user:
        logger.debug(f"User found: {user.email} with role: {user.internal_user_role}")
    else:
        logger.debug(f"User with email {email} not found")

    if user and user.check_password(password):
        login_user(user, remember=True)
        logger.debug(f"Login successful for user: {user.email} with role: {user.internal_user_role}")
        
        # Return the user's internal role
        return jsonify({
            "message": "Login successful",
            "internal_user_role": user.internal_user_role  # Return user's role for frontend checks
        }), 200
    
    logger.warning(f"Login failed for email: {email}")
    return jsonify({"message": "Invalid credentials"}), 401

# Route for user logout
@auth.route('/logout')
@login_required
def logout():
    logger.debug(f"User {current_user.email} is logging out")
    logout_user()  # This clears the session on the server
    response = jsonify({"message": "Logout successful"})
    response.status_code = 200
    return response