from flask import Flask, g, request, session, abort, render_template, jsonify
from flask_login import LoginManager, current_user
from flask_migrate import Migrate
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
from sqlalchemy import func
from authlib.integrations.flask_client import OAuth
import os
from datetime import timedelta
import logging
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv

# Import your models and extensions
from models import User, Company
from extensions import db, migrate
from auth import auth as auth_blueprint
from routes import main as main_blueprint

# Load environment variables
load_dotenv()

def create_app(config_name=None):
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1)
    
    # Set logging level based on environment
    env = os.getenv('FLASK_ENV', 'development')
    logger = logging.getLogger(__name__)
    if env == 'production':
        logger.setLevel(logging.WARNING)
    else:
        logger.setLevel(logging.DEBUG)

    # CORS configuration
    if env == 'development':
        CORS(app, supports_credentials=True, origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5000"
        ])
    else:
        CORS(app, supports_credentials=True, origins=[
            "https://*.minutememo.io",
            "https://minutememo.io"
        ])

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)

    # OAuth setup
    oauth = OAuth(app)
    
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
            jwks_uri='https://www.googleapis.com/oauth2/v3/certs'
        )
        logger.debug('Google OAuth client registered successfully')
    except Exception as e:
        logger.error(f"Error during Google OAuth registration: {e}")

    # Microsoft OAuth configuration
    try:
        logger.debug('Registering Microsoft OAuth client')
        oauth.register(
            name='microsoft',
            client_id=os.getenv('MICROSOFT_CLIENT_ID'),
            client_secret=os.getenv('MICROSOFT_CLIENT_SECRET'),
            access_token_url='https://login.microsoftonline.com/common/oauth2/v2.0/token',
            authorize_url='https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            client_kwargs={
                'scope': 'openid email profile offline_access User.Read Calendars.Read Calendars.ReadWrite',
                'response_type': 'code',
            },
            api_base_url='https://graph.microsoft.com/v1.0/',
            jwks_uri='https://login.microsoftonline.com/common/discovery/v2.0/keys'
        )
        logger.debug('Microsoft OAuth client registered successfully')
    except Exception as e:
        logger.error(f"Error during Microsoft OAuth registration: {e}")

    # Configure login manager
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # Add proxy middleware for proper subdomain handling
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

    # Helper functions
    def get_subdomain(host):
        """Extract subdomain from host"""
        parts = host.split('.')
        if len(parts) > 2:
            return parts[0]
        return None

    def validate_subdomain(subdomain):
        """Validate subdomain format"""
        import re
        if subdomain:
            return bool(re.match('^[a-zA-Z0-9-]+$', subdomain))
        return False

    # Workspace middleware
    @app.before_request
    def workspace_middleware():
        # Skip for static files and certain endpoints
        if request.endpoint and (
            request.endpoint.startswith('static') or
            request.endpoint.startswith('auth.') or
            request.endpoint == 'main.health_check'
        ):
            return

        # Get and validate subdomain
        subdomain = get_subdomain(request.host)
        g.workspace = None
        g.workspace_id = None

        if subdomain and subdomain not in ['www', 'api']:
            # Validate subdomain format
            if not validate_subdomain(subdomain):
                app.logger.warning(f"Invalid subdomain format: {subdomain}")
                return handle_invalid_subdomain()

            # Find company by subdomain
            company = Company.query.filter(
                func.lower(func.replace(Company.name, ' ', '-')) == 
                func.lower(subdomain)
            ).first()

            if not company:
                app.logger.warning(f"Company not found for subdomain: {subdomain}")
                return handle_invalid_subdomain()

            # Set workspace context
            g.workspace = company
            g.workspace_id = company.id

            # Verify user access if authenticated
            if current_user.is_authenticated:
                has_access = (
                    current_user.company_id == company.id or
                    current_user.additional_companies.filter_by(id=company.id).first()
                )

                if not has_access:
                    app.logger.warning(
                        f"User {current_user.id} attempted to access unauthorized workspace: {subdomain}"
                    )
                    return handle_unauthorized_access()

    def handle_invalid_subdomain():
        """Handle invalid subdomain requests"""
        if request.is_json:
            return jsonify({'error': 'Invalid workspace'}), 404
        return render_template('404.html'), 404

    def handle_unauthorized_access():
        """Handle unauthorized workspace access"""
        if request.is_json:
            return jsonify({'error': 'Unauthorized access'}), 403
        return render_template('403.html'), 403

    # Error handlers
    @app.errorhandler(404)
    def not_found_error(error):
        app.logger.info(f"404 error for path: {request.path}")
        if request.is_json:
            return jsonify({'error': 'Not found'}), 404
        return render_template('404.html'), 404

    @app.errorhandler(403)
    def forbidden_error(error):
        app.logger.warning(f"403 error for path: {request.path}")
        if request.is_json:
            return jsonify({'error': 'Forbidden'}), 403
        return render_template('403.html'), 403

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        app.logger.error(f"500 error: {str(error)}")
        if request.is_json:
            return jsonify({'error': 'Internal server error'}), 500
        return render_template('500.html'), 500

    # Context processors
    @app.context_processor
    def utility_processor():
        def get_current_workspace():
            return getattr(g, 'workspace', None)
        
        return dict(
            current_workspace=get_current_workspace,
            is_workspace=bool(getattr(g, 'workspace', None))
        )

    # Setup logging
    if not app.debug and not app.testing:
        if not os.path.exists('logs'):
            os.mkdir('logs')
        
        file_handler = RotatingFileHandler(
            'logs/minutememo.log',
            maxBytes=10240,
            backupCount=10
        )
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s '
            '[in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)

        app.logger.setLevel(logging.INFO)
        app.logger.info('MinuteMemo startup')

    # Register blueprints
    app.register_blueprint(auth_blueprint, url_prefix='/auth')
    app.register_blueprint(main_blueprint)

    # Health check endpoint
    @app.route('/health')
    def health_check():
        return jsonify({'status': 'healthy'}), 200

    return app

# Create the application instance
app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)))