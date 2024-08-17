#routes.py
from flask import Blueprint, render_template, request, jsonify, current_app
import os
import uuid
from flask_cors import cross_origin
import ffmpeg
from werkzeug.security import generate_password_hash, check_password_hash
from .models import User, db, Recording
from .extensions import db  # Import from extensions.py
from flask_login import login_required, current_user
from datetime import datetime




main = Blueprint('main', __name__)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@main.route('/')
@login_required
def home():
    return render_template('index.html')

@main.route('/home_content')
@login_required
def home_content():
    return render_template('home_content.html')

@main.route('/settings_content')
@login_required
def settings_content():
    return render_template('settings_content.html')

@main.route('/api/recordings', methods=['POST'])
@login_required
@cross_origin()
def create_recording():
    try:
        data = request.json

        if not data:
            current_app.logger.error("No JSON data received")
            return jsonify({'status': 'error', 'message': 'No data provided'}), 400

        recording_id = data.get('recording_id')
        if not recording_id:
            current_app.logger.error("Recording ID not provided")
            return jsonify({'status': 'error', 'message': 'Recording ID is required'}), 400

        file_name = data.get('file_name')
        if not file_name:
            current_app.logger.error("File name not provided")
            return jsonify({'status': 'error', 'message': 'File name is required'}), 400

        concatenation_status = data.get('concatenation_status', 'pending')
        concatenation_file_name = data.get('concatenation_file_name')

        if not concatenation_file_name:
            current_app.logger.error("Concatenation file name not provided")
            return jsonify({'status': 'error', 'message': 'Concatenation file name is required'}), 400

        user_id = current_user.id  # Assuming you're using Flask-Login

        # Create a new recording entry
        new_recording = Recording(
            id=recording_id,
            user_id=user_id,
            file_name=file_name,
            concatenation_status=concatenation_status,
            concatenation_file_name=concatenation_file_name,
            timestamp=datetime.utcnow()
        )
        db.session.add(new_recording)
        db.session.commit()

        current_app.logger.info(f"Recording {recording_id} created for user {user_id}")

        return jsonify({'status': 'success', 'recording': recording_id}), 201
    except Exception as e:
        db.session.rollback()  # Rollback the session on error
        current_app.logger.error(f"Error creating recording: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

@main.route('/api/recordings', methods=['GET'])
@login_required
def get_user_recordings():
    try:
        # Fetch all recordings for the logged-in user
        user_id = current_user.id
        recordings = Recording.query.filter_by(user_id=user_id).all()

        # Serialize the recordings to return as JSON
        recordings_data = [
            {
                'id': str(rec.id),
                'file_name': rec.file_name,
                'timestamp': rec.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'concatenation_status': rec.concatenation_status,
                'file_url': f'/uploads/{rec.file_name}'  # Ensure this path matches your setup
            } for rec in recordings
        ]

        return jsonify({'status': 'success', 'recordings': recordings_data}), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching recordings: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

@main.route('/profile_content')
@login_required
def profile_content():
    return render_template('profile_content.html')

@main.route('/upload_chunk', methods=['POST'])
@login_required
@cross_origin()
def upload_chunk():
    chunk = request.files['chunk']
    chunk_number = request.form['chunk_number']
    recording_id = request.form['recording_id']
    chunk_filename = f"{recording_id}_chunk_{chunk_number}.webm"
    chunk_path = os.path.join(UPLOAD_FOLDER, chunk_filename)
    chunk.save(chunk_path)
    
    # Log the size of the saved chunk
    chunk_size = os.path.getsize(chunk_path)
    print(f"Chunk saved: {chunk_filename}, size: {chunk_size} bytes")
    
    # Update the list file
    list_file_path = os.path.join(UPLOAD_FOLDER, f"{recording_id}_list.txt")
    with open(list_file_path, 'a') as list_file:
        list_file.write(f"file '{os.path.abspath(chunk_path)}'\n")
    
    return jsonify({'status': 'success', 'chunk_key': chunk_filename})

def natural_sort_key(s):
    import re
    return [int(text) if text.isdigit() else text.lower() for text in re.split('([0-9]+)', s)]




@main.route('/concatenate', methods=['POST'])
@login_required
@cross_origin()
def concatenate():
    try:
        data = request.get_json()
        if not data or 'recording_id' not in data:
            current_app.logger.error("Missing recording_id in the request data")
            return jsonify({'status': 'error', 'message': 'Missing recording_id'}), 400

        recording_id = data['recording_id']
        current_app.logger.info(f"Received request to concatenate for recording_id: {recording_id}")

        chunk_files = sorted(
            [f for f in os.listdir(UPLOAD_FOLDER) if f.startswith(recording_id) and f.endswith('.webm')],
            key=natural_sort_key
        )

        if not chunk_files:
            current_app.logger.error(f"No chunks found for recording_id: {recording_id}")
            return jsonify({'status': 'error', 'message': 'No chunks found for the given recording_id'}), 400

        # Log chunk files to be concatenated
        current_app.logger.info(f"Chunk files to concatenate: {chunk_files}")

        list_file_path = os.path.join(UPLOAD_FOLDER, f"{recording_id}_list.txt")
        
        # Write chunk filenames to the list file
        with open(list_file_path, 'w') as f:
            for chunk in chunk_files:
                f.write(f"file '{chunk}'\n")

        final_output = os.path.join(UPLOAD_FOLDER, f"{recording_id}.webm")
        concatenation_status = 'success'
        try:
            (
                ffmpeg
                .input(list_file_path, format='concat', safe=0)
                .output(final_output, c='copy')
                .run()
            )
        except ffmpeg.Error as e:
            current_app.logger.error(f"Error concatenating files with ffmpeg: {e}")
            concatenation_status = 'failed'
            return jsonify({'status': 'error', 'message': f"Error concatenating files: {str(e)}"}), 500

        # Convert the concatenated file to mp3
        mp3_filepath = os.path.splitext(final_output)[0] + '.mp3'
        convert_to_mp3(final_output, mp3_filepath)

        current_app.logger.info(f"Concatenation successful: {mp3_filepath}")

        try:
            # Update the recording in the database
            recording = Recording.query.filter_by(id=recording_id).first()
            if recording:
                recording.file_name = os.path.basename(mp3_filepath)
                recording.concatenation_status = concatenation_status
                recording.concatenation_file_name = os.path.basename(list_file_path)
                db.session.commit()
                current_app.logger.info(f"Database updated successfully for recording_id: {recording_id}")
            else:
                current_app.logger.error(f"Recording not found in the database for recording_id: {recording_id}")
                return jsonify({'status': 'error', 'message': 'Recording not found in the database'}), 404
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating the database: {e}")
            return jsonify({'status': 'error', 'message': f"Error updating the database: {str(e)}"}), 500

        return jsonify({'status': 'success', 'file_url': mp3_filepath})
    except Exception as e:
        current_app.logger.error(f"Error during concatenation: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
    
def convert_to_mp3(webm_filepath, mp3_filepath):
    try:
        (
            ffmpeg
            .input(webm_filepath)
            .output(mp3_filepath, codec='libmp3lame', qscale=2)
            .run()
        )
        print(f"Conversion successful: {mp3_filepath}")
    except ffmpeg.Error as e:
        print(f"Error converting file: {e}")
# Ensure ffmpeg is installed and accessible
# You might need to install ffmpeg-python: pip install ffmpeg-python
# Also, ensure that ffmpeg is installed on your system and accessible from the command line.

# not being used below here
#@main.route('/upload', methods=['POST'])
#@cross_origin()  # Enable CORS for this specific route
#def upload_audio():
#    audio_file = request.files.get('audio_data')
#    file_type = request.form.get('type', 'webm')
#    if not audio_file:
#        return jsonify({'error': 'No audio file provided'}), 400#
#
#    filename = f"{uuid.uuid4()}.{file_type}"
#    filepath = os.path.join(UPLOAD_FOLDER, filename)
#    audio_file.save(filepath)

    # Convert webm to mp3
#   mp3_filepath = os.path.splitext(filepath)[0] + '.mp3'
#    convert_to_mp3(filepath, mp3_filepath)
#
 #   return jsonify({'message': 'File uploaded successfully', 'webm_filepath': filepath, 'mp3_filepath': mp3_filepath}), 200