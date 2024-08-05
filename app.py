from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv
import os
import re

db = SQLAlchemy()
migrate = Migrate()

def create_app():
    app = Flask(__name__)
    CORS(app)

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
    from .routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

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

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)