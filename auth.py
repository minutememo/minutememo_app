#auth.py
from flask import Blueprint, request, jsonify, current_app, redirect, url_for
from .models import User
import logging
from .extensions import db
from flask_login import login_user, logout_user, login_required


auth = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

# Route for user signup
@auth.route('/signup', methods=['POST', 'OPTIONS'])
def signup():
    logger.debug('Signup route hit')

    if request.method == 'OPTIONS':
        logger.debug('Handling CORS preflight request')
        # Handle CORS preflight request
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
        logger.warning('Missing email, password or password confirmation')
        return jsonify({'message': 'Email, password, and password confirmation are required'}), 400

    if password != password_confirmation:
        logger.warning('Passwords do not match')
        return jsonify({'message': 'Passwords do not match'}), 400

    user_exists = User.query.filter_by(email=email).first()
    if user_exists:
        logger.warning('Email is already in use: %s', email)
        return jsonify({'message': 'Email is already in use'}), 400

    new_user = User(email=email)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()

    logger.info('User created successfully: %s', email)
    return jsonify({'message': 'User created successfully'}), 201
# Route for user login
@auth.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter_by(email=email).first()
    if user and user.check_password(password):
        login_user(user, remember=True)
        return jsonify({"message": "Login successful"}), 200
    return jsonify({"message": "Invalid credentials"}), 401

@auth.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))