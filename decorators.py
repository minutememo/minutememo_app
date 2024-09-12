from functools import wraps
from flask import jsonify, g
from flask_login import current_user
from models import Company  # Assuming your models are in a file called models.py

def subscription_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        company = Company.query.get(current_user.company_id)
        if not company or not company.subscriptions or not any(sub.is_active for sub in company.subscriptions):
            return jsonify({'status': 'error', 'message': 'No active subscription found'}), 403
        return f(*args, **kwargs)
    return decorated_function