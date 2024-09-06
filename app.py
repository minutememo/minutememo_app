import os
import sys
from flask import Flask, request, jsonify, session, g
from flask_cors import CORS
from flask_migrate import Migrate
from flask_login import LoginManager, login_required, current_user
from dotenv import load_dotenv
from datetime import timedelta
import re
from logging.handlers import RotatingFileHandler
import logging
from extensions import *
from models import *
from auth import *
from celery_factory import make_celery

celery = None


# Initialize login manager
login_manager = LoginManager()
# Setup logging
logging.basicConfig(filename='app.log', level=logging.DEBUG, 
                    format='%(asctime)s %(levelname)s: %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')

log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Log to file with rotation
file_handler = RotatingFileHandler('app.log', maxBytes=100000, backupCount=10)
file_handler.setFormatter(log_formatter)
file_handler.setLevel(logging.DEBUG)

# Log to console
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)
console_handler.setLevel(logging.DEBUG)

# Configure the root logger
logging.getLogger().setLevel(logging.DEBUG)
logging.getLogger().addHandler(file_handler)
logging.getLogger().addHandler(console_handler)

migrate = Migrate()
frontend_url = "https://staging.minutememo.io"  # Your custom domain



def create_app():
    app = Flask(__name__)

    # Load environment variables
    env = os.getenv('FLASK_ENV', 'development')

    print(">>> To see if we update. <<<")
    if env == 'production':
        load_dotenv('.env.production')
    else:
        load_dotenv('.env.development')

    # Update CORS configuration based on environment
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    CORS(app, supports_credentials=True, resources={r"/*": {"origins": frontend_url}})

    # Configure app
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL').replace("postgres://", "postgresql://")
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Set the SECRET_KEY from the environment variable, with a fallback for development
    app.secret_key = os.getenv('SECRET_KEY', 'supersecretkey')  # In production, replace 'supersecretkey' with a securely generated key

    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)  # Session lifetime
    app.config['REMEMBER_COOKIE_DURATION'] = timedelta(days=7)
    app.config['REMEMBER_COOKIE_SECURE'] = env == 'production'  # True if using HTTPS in production
    app.config['REMEMBER_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SECURE'] = env == 'production'  # True if using HTTPS in production
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'None' if env == 'production' else 'Lax'  # 'None' for cross-domain, 'Lax' for local dev
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    app.config['CELERY_BROKER_URL'] = os.getenv('REDIS_URL', 'redis://localhost:6379/0')  # Use your Redis URL here
    app.config['CELERY_RESULT_BACKEND'] = os.getenv('REDIS_URL', 'redis://localhost:6379/0')  # Use the same or different backend if needed
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'

    global celery
    celery = make_celery(app)


    @login_manager.user_loader
    def load_user(user_id):
        logger.debug('Loading user with ID: %s', user_id)
        return User.query.get(int(user_id))

    @app.before_request
    def make_session_permanent():
        session.permanent = True
        session.modified = True  # Refresh session expiration time on each request
        g.user = current_user
        if current_user.is_authenticated:
            logger.debug('Session for user %s is active and authenticated', current_user.email)
        else:
            logger.debug('No active session found, user is not authenticated')

    @app.route('/auth/status')
    def status():
        if current_user.is_authenticated:
            logger.debug('Status check: user %s is authenticated', current_user.email)
            return jsonify(logged_in=True, user={'email': current_user.email})
        logger.debug('Status check: user is not authenticated')
        return jsonify(logged_in=False)

    # Register the main blueprint
    from routes import main as main_blueprint
    app.register_blueprint(main_blueprint)
    # Register the auth blueprint
    app.register_blueprint(auth, url_prefix='/auth')

    # Simple test endpoint
    @app.route('/test', methods=['GET'])
    def test():
        logging.info('Test endpoint hit')
        return jsonify({"message": "Test endpoint is working"}), 200

    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        
        logger.debug('After request, Origin: %s', origin)
        
        # Apply the Access-Control-Allow-Origin only once
        if origin and 'Access-Control-Allow-Origin' not in response.headers:
            response.headers['Access-Control-Allow-Origin'] = origin
        
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS,PATCH'
        
        return response

    return app

# Utility function for natural sorting
def natural_sort_key(s, _nsre=re.compile('([0-9]+)')):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(_nsre, s)]

# Function to concatenate chunks
def concatenate_chunks(recording_id):
    chunks_dir = 'uploads'  # Directory where chunks are stored

    # Get all chunk filenames for the given recording_id
    chunk_files = [os.path.join(chunks_dir, f) for f in os.listdir(chunks_dir) if recording_id in f and f.endswith('.webm')]

    # Sort the chunk filenames
    chunk_files.sort(key=natural_sort_key)

    # Write the sorted filenames to a file for FFmpeg
    list_file_path = os.path.join(chunks_dir, f'{recording_id}_file_list.txt')
    with open(list_file_path, 'w') as f:
        for chunk in chunk_files:
            f.write(f"file '{chunk}'\n")

    # Call FFmpeg to concatenate the chunks
    output_file = os.path.join(chunks_dir, f'{recording_id}.webm')
    os.system(f'ffmpeg -f concat -safe 0 -i {list_file_path} -c copy {output_file}')

    return output_file

# Route to handle chunk concatenation
    @app.route('/concatenate', methods=['POST'])
    def concatenate():
        data = request.get_json()
        recording_id = data['recording_id']
        
        # Call the concatenate_chunks function
        output_file = concatenate_chunks(recording_id)
        
        return jsonify({'file_url': output_file})

# The main entry point
if __name__ == '__main__':
    print(f"Starting Flask app from {__file__}")
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)