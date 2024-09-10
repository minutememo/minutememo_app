from flask import Blueprint, request, jsonify
from flask_login import login_user, current_user, login_required
from models import User  # Adjust based on your models location

# Define the blueprint for the super admin section
super_admin_bp = Blueprint('super_admin', __name__, url_prefix='/superadmin')

# Super Admin Login route
@super_admin_bp.route('/login', methods=['POST'])
def super_admin_login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    # Query the user by email
    user = User.query.filter_by(email=email).first()

    # Check if user exists, password is valid, and internal_user_role is super_admin
    if user and user.check_password(password):
        login_user(user)
        # Return internal_user_role for frontend to handle role-based navigation
        return jsonify({
            "message": "Login successful",
            "internal_user_role": user.internal_user_role  # Send this field for frontend role check
        }), 200
    else:
        return jsonify({"message": "Invalid credentials"}), 401

# Super Admin Dashboard route
@super_admin_bp.route('/dashboard', methods=['GET'])
@login_required
def super_admin_dashboard():
    # Ensure only users with 'super_admin' role can access this route
    if current_user.internal_user_role != 'super_admin':
        return jsonify({"message": "You do not have the required access"}), 403  # Forbidden access for non-super_admins

    # Super admin access confirmed, return dashboard data
    return jsonify({"message": "Welcome to the Super Admin Dashboard"}), 200