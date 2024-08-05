# __init__.py

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os
from .models import db, migrate
from .routes import main as main_blueprint

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes

    # Load environment variables
    env = os.getenv('FLASK_ENV', 'development')
    if env == 'production':
        load_dotenv('.env.production')
    else:
        load_dotenv('.env.development')

    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL').replace("postgres://", "postgresql://")
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Print the database URL for verification
    print(f"Database URL: {app.config['SQLALCHEMY_DATABASE_URI']}")

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)

    # Register blueprints
    app.register_blueprint(main_blueprint)

    return app