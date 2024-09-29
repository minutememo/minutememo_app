#routes.py
from flask import Blueprint, render_template, request, jsonify, current_app, send_from_directory, redirect, url_for
import os
import tempfile
from google.cloud import storage
from google.oauth2 import service_account
from dotenv import load_dotenv
import boto3
from botocore.client import Config
import logging
import shutil
from botocore.exceptions import ClientError
import uuid
from flask_cors import cross_origin
import ffmpeg
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from decorators import subscription_required
from models import User, db, Recording, MeetingSession, MeetingHub, Company, Meeting, Subscription, ActionItem
from extensions import db  # Import from extensions.py
from flask_login import login_required, current_user
from datetime import datetime, timedelta
from pydantic import BaseModel, ValidationError
import traceback
from typing import List
#from app import credentials
from celery.result import AsyncResult
from celery_factory import celery_app  # Import the initialized Celery app
from openai import OpenAI
import openai
import requests
import json
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional


logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)
main = Blueprint('main', __name__)
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)
IS_LOCAL = os.getenv('FLASK_ENV') == 'development'
logger.debug

class ActionPoint(BaseModel):
    summary: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = None

class ActionPointsSchema(BaseModel):
    action_items: List[ActionPoint]


# Load environment settings
# Load environment settings
ENVIRONMENT = os.getenv('FLASK_ENV', 'development')
BUCKET_NAME = 'staging-minutememo-audiofiles'
UPLOAD_FOLDER = os.path.join('uploads', 'audio_recordings')

if ENVIRONMENT != 'development':
    # Use environment variables for Google Cloud credentials
    credentials_info = {
        "type": os.getenv('GOOGLE_CLOUD_TYPE'),
        "project_id": os.getenv('GOOGLE_CLOUD_PROJECT_ID'),
        "private_key_id": os.getenv('GOOGLE_CLOUD_PRIVATE_KEY_ID'),
        "private_key": os.getenv('GOOGLE_CLOUD_PRIVATE_KEY').replace("\\n", "\n"),
        "client_email": os.getenv('GOOGLE_CLOUD_CLIENT_EMAIL'),
        "client_id": os.getenv('GOOGLE_CLOUD_CLIENT_ID'),
        "auth_uri": os.getenv('GOOGLE_CLOUD_AUTH_URI'),
        "token_uri": os.getenv('GOOGLE_CLOUD_TOKEN_URI'),
        "auth_provider_x509_cert_url": os.getenv('GOOGLE_CLOUD_AUTH_PROVIDER_X509_CERT_URL'),
        "client_x509_cert_url": os.getenv('GOOGLE_CLOUD_CLIENT_X509_CERT_URL')
    }
    # Initialize Google Cloud Storage client with credentials
    credentials = service_account.Credentials.from_service_account_info(credentials_info)
    storage_client = storage.Client(credentials=credentials)
else:
    # For development environment, set storage_client to None
    storage_client = None

def upload_file_to_gcs(local_path, gcs_path):
    """Uploads a file to Google Cloud Storage."""
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(f"audio_recordings/{gcs_path}")  # Always use this path structure
    blob.upload_from_filename(local_path)

def download_chunks_from_gcs(bucket_name, chunk_files):
    """Downloads chunk files from GCS and returns their local paths."""
    temp_dir = os.path.join(UPLOAD_FOLDER)
    os.makedirs(temp_dir, exist_ok=True)
    
    local_paths = []
    for chunk in chunk_files:
        local_path = os.path.join(temp_dir, secure_filename(chunk))
        blob = storage_client.bucket(bucket_name).blob(f'audio_recordings/{chunk}')
        blob.download_to_filename(local_path)
        local_paths.append(local_path)

    return local_paths, temp_dir

def list_gcs_chunks(bucket_name, recording_id):
    """Lists chunk files for a recording ID in GCS."""
    chunks = []
    bucket = storage_client.bucket(bucket_name)
    blobs = bucket.list_blobs(prefix=f'audio_recordings/{recording_id}_chunk')
    for blob in blobs:
        chunks.append(blob.name.split('/')[-1])  # Get only the filename
    return chunks

@main.route('/generate-presigned-url', methods=['GET'])
@cross_origin()  # Enable CORS for this route
def generate_presigned_url_route():
    try:
        logging.info("Request received to generate presigned URL.")
        logging.debug(f"Request headers: {request.headers}")
        logging.debug(f"Request args: {request.args}")

        # Retrieve fileName and fileType from the request arguments
        file_name = request.args.get('fileName')
        file_type = request.args.get('fileType')

        if not file_name or not file_type:
            logging.error("File name or file type is missing.")
            return jsonify({"error": "File name and file type are required."}), 400

        logging.info(f"Generating presigned URL for file: {file_name} with type: {file_type}")

        # Generate the presigned URL
        url = generate_presigned_url(file_name, file_type)
        logging.info(f"Presigned URL generated: {url}")

        return jsonify({'url': url})

    except Exception as e:
        logging.error("An error occurred while generating the presigned URL.")
        logging.error(f"Error: {e}")
        logging.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


def generate_presigned_url(file_name, file_type):
    # Ensure BUCKET_NAME is fetched from environment variables
    bucket_name = os.getenv('BUCKET_NAME')
    
    if not bucket_name:
        raise ValueError("Bucket name not set in environment variables.")

    # Initialize the Google Cloud Storage client with credentials


def upload_file(file, file_key):
    try:
        # Ensure the file_key is secure and within the desired folder
        file_key = secure_filename(f"audio_recordings/{file_key}")

        # Get the bucket
        bucket = storage_client.bucket(BUCKET_NAME)
        
        # Create a blob object from the file key
        blob = bucket.blob(file_key)
        
        # Upload the file to Google Cloud Storage
        blob.upload_from_file(file, content_type=file.content_type)
        
        # Do NOT make the blob public
        # blob.make_public()  # Remove or comment out this line
        
        # Return the relative file path to store in the database
        file_path = file_key  # e.g., 'audio_recordings/533de960-89ce-4b16-a809-7d502715d761.mp3'
        return file_path

    except Exception as e:
        current_app.logger.error(f"Error uploading file to Google Cloud Storage: {str(e)}")
        raise

def natural_sort_key(s):
    import re
    return [int(text) if text.isdigit() else text.lower() for text in re.split('([0-9]+)', s)]

@main.route('/')
@login_required
def home():
    return render_template('index.html') 

@main.route('/home_content')
@login_required
@subscription_required
def home_content():
    return render_template('home_content.html')

@main.route('/settings_content')
@subscription_required
@login_required
def settings_content():
    return render_template('settings_content.html')

def update_concatenation_status(recording_id, status):
    try:
        # Fetch the recording by the given recording_id from the Recording table
        recording = db.session.query(Recording).filter_by(id=recording_id).first()

        if recording:
            # Update the status field
            recording.concatenation_status = status  # Assuming 'concatenation_status' is the correct field
            db.session.commit()
            current_app.logger.info(f"Concatenation status for {recording_id} updated to {status}")
        else:
            # Log if the recording was not found
            current_app.logger.error(f"Recording with ID {recording_id} not found")
    except Exception as e:
        # Rollback any changes if an error occurs
        db.session.rollback()
        current_app.logger.error(f"Failed to update status for recording {recording_id}: {str(e)}")

@main.route('/api/recordings/<string:recording_id>', methods=['PATCH'])
@login_required
@cross_origin()
def update_recording(recording_id):
    try:
        # Log entry into the function
        current_app.logger.info(f"Entering update_recording function for recording_id: {recording_id}")

        data = request.json
        current_app.logger.info(f"Received data for updating recording {recording_id}: {data}")

        audio_url = data.get('audio_url')
        if not audio_url:
            current_app.logger.error("Audio URL is null or not provided")
            return jsonify({'status': 'error', 'message': 'Audio URL is required'}), 400

        # Log before fetching the recording
        current_app.logger.info(f"Fetching Recording with ID: {recording_id}")
        recording = Recording.query.get_or_404(recording_id)

        # Log the current state of the recording before updating
        current_app.logger.info(f"Current recording before update: {recording}")

        # Log before fetching the associated meeting session
        current_app.logger.info(f"Fetching associated MeetingSession with ID: {recording.meeting_session_id}")
        meeting_session = MeetingSession.query.get_or_404(recording.meeting_session_id)

        # Log the current state of the meeting session before updating
        current_app.logger.info(f"Current MeetingSession before update: {meeting_session}")

        # Update the audio_url in the meeting session
        current_app.logger.info(f"Updating audio_url for MeetingSession ID: {meeting_session.id}")
        meeting_session.audio_url = audio_url
        db.session.commit()

        # Log the updated state of the meeting session
        current_app.logger.info(f"MeetingSession after update: {meeting_session}")

        return jsonify({'status': 'success', 'message': 'Meeting session updated successfully with audio URL'}), 200
    except Exception as e:
        # Log the error and rollback
        db.session.rollback()
        current_app.logger.error(f"Error updating meeting session for recording_id {recording_id}: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
    finally:
        # Log exiting the function
        current_app.logger.info(f"Exiting update_recording function for recording_id: {recording_id}")

@main.route('/api/recordings', methods=['GET'])
@login_required
def get_user_recordings():
    try:
        # Fetch all recordings for the logged-in user, filtered by meeting hub if provided
        user_id = current_user.id
        hub_id = request.args.get('hub_id')

        query = Recording.query.filter_by(user_id=user_id)
        if hub_id:
            query = query.join(MeetingSession).filter(MeetingSession.meeting_hub_id == hub_id)

        recordings = query.all()

        # Serialize the recordings to return as JSON
        recordings_data = [
            {
                'id': str(rec.id),
                'file_name': rec.file_name,
                'timestamp': rec.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'concatenation_status': rec.concatenation_status,
                'file_url': f'/uploads/audio_recordings/{rec.file_name}'  # Ensure this path matches your setup
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
    
    
@main.route('/concatenate', methods=['POST'])
@login_required
@cross_origin()
def concatenate():
    try:
        running_locally = os.getenv('FLASK_ENV', 'development') == 'development'

        data = request.get_json()
        if not data or 'recording_id' not in data:
            current_app.logger.error("Missing recording_id in the request data")
            return jsonify({'status': 'error', 'message': 'Missing recording_id'}), 400

        recording_id = data['recording_id']
        current_app.logger.info(f"Received request to concatenate for recording_id: {recording_id}")

        if running_locally:
            # Local processing
            chunk_files = sorted(
                [f for f in os.listdir(UPLOAD_FOLDER) if f.startswith(recording_id) and f.endswith('.webm')],
                key=natural_sort_key
            )

            if not chunk_files:
                current_app.logger.error(f"No chunks found for recording_id: {recording_id}")
                return jsonify({'status': 'error', 'message': 'No chunks found for the given recording_id'}), 400

            # Log the chunk files found
            current_app.logger.info(f"Local chunk files for recording_id {recording_id}: {chunk_files}")

            list_file_path = os.path.join(UPLOAD_FOLDER, f"{recording_id}_list.txt")
            with open(list_file_path, 'w') as f:
                for chunk in chunk_files:
                    f.write(f"file '{os.path.abspath(os.path.join(UPLOAD_FOLDER, chunk))}'\n")

            # Log the path of the final list file
            current_app.logger.info(f"List file created at: {list_file_path}")
            
            final_output = os.path.join(UPLOAD_FOLDER, f"{recording_id}.webm")

            try:
                # Run FFmpeg locally
                current_app.logger.info(f"Running FFmpeg locally with list file {list_file_path}")
                (
                    ffmpeg
                    .input(list_file_path, format='concat', safe=0)
                    .output(final_output, c='copy')
                    .run()
                )
                current_app.logger.info(f"Local concatenation output at {final_output}")
            except ffmpeg.Error as e:
                current_app.logger.error(f"Error concatenating files with ffmpeg: {e.stderr.decode('utf-8')}")
                return jsonify({'status': 'error', 'message': f"Error concatenating files: {str(e)}"}), 500

            # Convert to MP3 locally
            mp3_filepath = os.path.splitext(final_output)[0] + '.mp3'
            convert_to_mp3(final_output, mp3_filepath)
            current_app.logger.info(f"MP3 conversion successful. File saved at {mp3_filepath}")

            # Update the database to reflect successful concatenation
            update_concatenation_status(recording_id, 'success')
            current_app.logger.info(f"Concatenation status updated to 'success' in the database for recording_id: {recording_id}")

            return jsonify({'status': 'success', 'file_url': f'/uploads/audio_recordings/{os.path.basename(mp3_filepath)}'})
        
        else:
            # Cloud processing using Celery
            task = concatenate_cloud.delay(recording_id)
            current_app.logger.info(f"Started Celery task {task.id} for cloud-based concatenation.")
            return jsonify({'status': 'pending', 'task_id': task.id})
    
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
    


# Check Celery task status route
@main.route('/concatenate-status/<task_id>', methods=['GET'])
@login_required
@cross_origin()
def concatenate_status(task_id):
    task_result = AsyncResult(task_id, app=celery_app)
    if task_result.state == 'PENDING':
        response = {'state': task_result.state, 'status': 'Pending...'}
    elif task_result.state == 'SUCCESS':
        response = {'state': task_result.state, 'result': task_result.result}
    else:
        response = {'state': task_result.state, 'status': task_result.info}

    return jsonify(response)



# Celery task for cloud-based concatenation
# Celery task for cloud-based concatenation
@celery_app.task(bind=True)
def concatenate_cloud(self, recording_id):
    from app import create_app  # Ensure app is created to push the context
    import requests
    app = create_app()  # This creates an application instance
    with app.app_context():  # Push the application context
        try:
            current_app.logger.info(f"Starting cloud concatenation task for recording_id: {recording_id}")

            # Log that GCS chunk listing starts
            current_app.logger.info(f"Listing chunks in GCS for recording_id: {recording_id}")
            chunk_files = sorted(
                list_gcs_chunks(BUCKET_NAME, recording_id),
                key=natural_sort_key
            )

            if not chunk_files:
                current_app.logger.error(f"No chunks found for recording_id: {recording_id}")
                update_concatenation_status(recording_id, "error")
                return {'status': 'error', 'message': 'No chunks found for the given recording_id'}

            current_app.logger.info(f"Chunk files found in GCS for recording_id {recording_id}: {chunk_files}")

            # Download chunk files locally
            temp_dir = tempfile.mkdtemp()
            current_app.logger.info(f"Temporary directory created at {temp_dir}")

            local_chunk_paths = []
            for idx, chunk in enumerate(chunk_files):
                blob = storage_client.bucket(BUCKET_NAME).blob(f"audio_recordings/{chunk}")
                signed_url = blob.generate_signed_url(expiration=timedelta(minutes=30))
                current_app.logger.info(f"Generated signed URL for chunk {idx}: {signed_url}")

                # Download the file
                local_path = os.path.join(temp_dir, f"chunk_{idx}.webm")
                response = requests.get(signed_url)
                current_app.logger.info(f"Downloading chunk {idx} from GCS, response status: {response.status_code}")
                if response.status_code == 200:
                    with open(local_path, 'wb') as f:
                        f.write(response.content)
                    local_chunk_paths.append(local_path)
                    current_app.logger.info(f"Downloaded chunk {idx} to {local_path}")
                else:
                    current_app.logger.error(f"Failed to download chunk {idx}: {response.status_code} - {response.text}")
                    return {'status': 'error', 'message': 'Error downloading chunk files'}

            current_app.logger.info(f"Downloaded all chunk files: {local_chunk_paths}")

            # Create the list file for FFmpeg
            list_file_path = os.path.join(temp_dir, f"{recording_id}_list.txt")
            with open(list_file_path, 'w') as f:
                for local_path in local_chunk_paths:
                    f.write(f"file '{local_path}'\n")
            current_app.logger.info(f"FFmpeg list file created at {list_file_path}")

            # Run FFmpeg for concatenation
            local_output_path = os.path.join(temp_dir, f"{recording_id}.webm")
            try:
                current_app.logger.info(f"Running FFmpeg concatenation for recording_id: {recording_id}")
                (
                    ffmpeg
                    .input(list_file_path, format='concat', safe=0)
                    .output(local_output_path, c='copy')
                    .run()
                )
                current_app.logger.info(f"FFmpeg concatenation successful. Output at {local_output_path}")
            except ffmpeg.Error as e:
                stderr_output = e.stderr.decode('utf-8') if e.stderr else 'No error output'
                current_app.logger.error(f"Error during FFmpeg concatenation: {stderr_output}")
                update_concatenation_status(recording_id, "error")
                return {'status': 'error', 'message': f"Error concatenating files: {stderr_output}"}

            # Upload the concatenated WebM file to GCS
            final_output_gcs = f"audio_recordings/{recording_id}.webm"
            try:
                current_app.logger.info(f"Uploading concatenated WebM file to GCS: {final_output_gcs}")
                upload_file_to_gcs(local_output_path, final_output_gcs)
                current_app.logger.info(f"WebM file successfully uploaded to GCS at {final_output_gcs}")
            except Exception as e:
                current_app.logger.error(f"Error uploading WebM file to GCS: {e}")
                update_concatenation_status(recording_id, "error")
                return {'status': 'error', 'message': f"Error uploading WebM file: {str(e)}"}

            # Convert WebM to MP3
            mp3_output_path = os.path.join(temp_dir, f"{recording_id}.mp3")
            try:
                current_app.logger.info(f"Converting WebM to MP3 for recording_id: {recording_id}")
                (
                    ffmpeg
                    .input(local_output_path)
                    .output(mp3_output_path, format='mp3')
                    .run()
                )
                current_app.logger.info(f"MP3 conversion successful. Output at {mp3_output_path}")
            except ffmpeg.Error as e:
                stderr_output = e.stderr.decode('utf-8') if e.stderr else 'No error output'
                current_app.logger.error(f"Error converting to MP3: {stderr_output}")
                update_concatenation_status(recording_id, "error")
                return {'status': 'error', 'message': f"Error converting to MP3: {stderr_output}"}

            # Upload the MP3 file to GCS
            final_mp3_output_gcs = f"{recording_id}.mp3"
# Inside concatenate_cloud task, after uploading MP3 to GCS
            try:
                current_app.logger.info(f"Uploading MP3 file to GCS at {final_mp3_output_gcs}")
                upload_file_to_gcs(mp3_output_path, final_mp3_output_gcs)
                current_app.logger.info(f"MP3 file successfully uploaded to GCS at {final_mp3_output_gcs}")

                # Update the recording with the MP3 URL
                current_app.logger.info(f"Updating database with MP3 URL for recording_id: {recording_id}")
                recording = db.session.query(Recording).filter_by(id=recording_id).first()
                if recording:
                    recording.audio_url = f"audio_recordings/{final_mp3_output_gcs}"  # Updated line
                    current_app.logger.info(f"MP3 URL to be stored in DB: audio_recordings/{final_mp3_output_gcs}")
                    db.session.commit()
                    current_app.logger.info(f"MP3 URL successfully updated in the database for recording_id: {recording_id}")

                    # Update the related meeting session with the MP3 URL
                    current_app.logger.info(f"Updating MeetingSession with MP3 URL for recording_id: {recording_id}")
                    meeting_session = db.session.query(MeetingSession).filter_by(id=recording.meeting_session_id).first()
                    if meeting_session:
                        meeting_session.audio_url = f"audio_recordings/{final_mp3_output_gcs}"  # Updated line
                        db.session.commit()
                        current_app.logger.info(f"MP3 URL successfully updated in the MeetingSession for recording_id: {recording_id}")
                    else:
                        current_app.logger.error(f"MeetingSession not found for recording_id: {recording_id}")
                        return {'status': 'error', 'message': f"MeetingSession not found for recording_id: {recording_id}"}
                else:
                    current_app.logger.error(f"Recording not found for recording_id: {recording_id}")
                    return {'status': 'error', 'message': f"Recording not found for recording_id: {recording_id}"}

            except Exception as e:
                current_app.logger.error(f"Error uploading MP3 file to GCS: {e}")
                update_concatenation_status(recording_id, "error")
                return {'status': 'error', 'message': f"Error uploading MP3 file: {str(e)}"}

            # Update concatenation status to success
            current_app.logger.info(f"Updating concatenation status to success for recording_id: {recording_id}")
            update_concatenation_status(recording_id, "success")
            current_app.logger.info(f"Concatenation status successfully updated to 'success' for recording_id: {recording_id}")

            return {
                'status': 'success',
                'webm_file_url': f"gs://{BUCKET_NAME}/{final_output_gcs}",
                'mp3_file_url': f"gs://{BUCKET_NAME}/{final_mp3_output_gcs}"
            }

        except Exception as e:
            current_app.logger.error(f"Unexpected error during cloud concatenation for recording_id {recording_id}: {str(e)}")
            update_concatenation_status(recording_id, "error")
            return {'status': 'error', 'message': str(e)}
        finally:
            # Clean up local files
            current_app.logger.info(f"Cleaning up local files for recording_id: {recording_id}")
            shutil.rmtree(temp_dir)
            current_app.logger.info(f"Cleanup completed for recording_id: {recording_id}")


@main.route('/api/meetingsessions', methods=['GET', 'POST', 'PATCH'])
@login_required
@cross_origin()
def manage_meeting_sessions():
    if request.method == 'GET':
        try:
            hub_id = request.args.get('hub_id')
            if not hub_id:
                return jsonify({'status': 'error', 'message': 'Hub ID is required'}), 400

            current_app.logger.info(f"Fetching meeting sessions for hub ID: {hub_id}")
            
            meeting_sessions = (
                MeetingSession.query.join(Meeting)
                .filter(Meeting.meeting_hub_id == hub_id)
                .all()
            )

            sessions_data = [
                {
                    'id': session.id,
                    'name': session.name,
                    'session_datetime': session.session_datetime.strftime('%Y-%m-%d %H:%M:%S'),
                    'meeting_name': session.meeting.name,
                    'transcription': session.transcription,
                    'audio_url': session.audio_url  # Include audio URL if it exists
                }
                for session in meeting_sessions
            ]
            return jsonify({'status': 'success', 'meeting_sessions': sessions_data}), 200
        except Exception as e:
            current_app.logger.error(f"Error fetching meeting sessions: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

    elif request.method == 'PATCH':
        try:
            data = request.get_json()
            recording_id = data.get('recording_id')
            audio_url = data.get('audio_url')

            if not recording_id or not audio_url:
                return jsonify({'status': 'error', 'message': 'Recording ID and audio URL are required'}), 400

            # Fetch the meeting session by recording_id
            session = MeetingSession.query.filter_by(id=recording_id).first()

            if not session:
                return jsonify({'status': 'error', 'message': 'Meeting session not found'}), 404

            # Update the audio URL in the session
            session.audio_url = audio_url
            db.session.commit()

            current_app.logger.info(f"Updated audio URL for recording_id {recording_id}: {audio_url}")

            return jsonify({'status': 'success', 'message': 'Audio URL updated successfully'}), 200
        except Exception as e:
            current_app.logger.error(f"Error updating audio URL: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

    elif request.method == 'POST':
        try:
            data = request.json
            session_name = data.get('name', f"New Meeting Session {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")
            meeting_id = data.get('meeting_id')

            if not meeting_id:
                return jsonify({'status': 'error', 'message': 'Meeting ID is required'}), 400

            new_session = MeetingSession(
                name=session_name,
                session_datetime=datetime.utcnow(),
                meeting_id=meeting_id
            )
            db.session.add(new_session)
            db.session.commit()

            # Logging the creation of a new meeting session
            current_app.logger.info(f"New meeting session created: {new_session.id} - {new_session.name}")
            return jsonify({'status': 'success', 'meeting_session_id': new_session.id}), 201
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error creating meeting session: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500
        
@main.route('/api/meetinghubs', methods=['GET', 'POST'])
@login_required
def manage_meeting_hubs():
    if request.method == 'GET':
        try:
            # Fetch all meeting hubs for the logged-in user
            user_id = current_user.id
            meeting_hubs = MeetingHub.query.filter(MeetingHub.users.any(id=user_id)).all()

            # Fetch the active hub for the user
            active_hub_id = current_user.active_meeting_hub_id  # Assuming you have an active_meeting_hub_id column in the User model

            # Serialize the meeting hubs to return as JSON
            meeting_hubs_data = [
                {
                    'id': hub.id,
                    'name': hub.name,
                    'description': hub.description,
                    'users': [user.email for user in hub.users]  # Assuming User model has an email attribute
                } for hub in meeting_hubs
            ]

            return jsonify({
                'status': 'success',
                'meeting_hubs': meeting_hubs_data,
                'active_hub_id': active_hub_id  # Include the active hub ID in the response
            }), 200
        except Exception as e:
            current_app.logger.error(f"Error fetching meeting hubs: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

    elif request.method == 'POST':
        try:
            data = request.get_json()

            if not data:
                current_app.logger.error("No JSON payload provided in the request.")
                return jsonify({'status': 'error', 'message': 'No data provided'}), 400

            name = data.get('name')
            description = data.get('description', 'No description')

            if not name:
                current_app.logger.error("Hub name is missing in the request.")
                return jsonify({'status': 'error', 'message': 'Name is required'}), 400

            # Get the company_id from the current user
            company_id = current_user.company_id
            if not company_id:
                current_app.logger.error(f"User {current_user.id} does not belong to any company.")
                return jsonify({'status': 'error', 'message': 'User does not belong to any company'}), 400

            # Create a new meeting hub
            new_hub = MeetingHub(
                name=name,
                description=description,
                company_id=company_id  # Ensure the company_id is set
            )
            new_hub.users.append(current_user)  # Add the current user to the meeting hub
            db.session.add(new_hub)
            db.session.commit()

            # Log the successful creation of a new hub
            current_app.logger.info(f"Meeting hub created with ID {new_hub.id} for user {current_user.id}.")

            # Return the new hub ID
            return jsonify({'status': 'success', 'meeting_hub_id': new_hub.id}), 201
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error creating meeting hub: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500
        



@main.route('/api/company', methods=['GET', 'POST'])
@login_required 
def manage_company():
    if request.method == 'GET':
        try:
            logger.debug("Fetching company details for the current user")
            company = current_user.company
            if company:
                company_data = {
                    'name': company.name,
                    'address': company.address,
                    'city': company.city,
                    'state': company.state,
                    'zip_code': company.zip_code,
                    'country': company.country,
                    'phone_number': company.phone_number,
                }
                logger.info(f"Company details fetched successfully for user {current_user.email}")
                return jsonify({'status': 'success', 'company': company_data}), 200
            else:
                logger.warning(f"No company found for user {current_user.email}")
                return jsonify({'status': 'error', 'message': 'Company not found'}), 404
        except Exception as e:
            current_app.logger.error(f"Error fetching company details for user {current_user.email}: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

    elif request.method == 'POST':
        try:
            data = request.json
            logger.debug(f"Received data to update company: {data}")
            company = current_user.company

            if company:
                logger.debug(f"Updating existing company details for user {current_user.email}")
                company.name = data.get('name', company.name)
                company.address = data.get('address', company.address)
                company.city = data.get('city', company.city)
                company.state = data.get('state', company.state)
                company.zip_code = data.get('zip_code', company.zip_code)
                company.country = data.get('country', company.country)
                company.phone_number = data.get('phone_number', company.phone_number)
            else:
                logger.info(f"Creating a new company for user {current_user.email}")
                company = Company(
                    name=data.get('name'),
                    address=data.get('address'),
                    city=data.get('city'),
                    state=data.get('state'),
                    zip_code=data.get('zip_code'),
                    country=data.get('country'),
                    phone_number=data.get('phone_number')
                )
                db.session.add(company)
                current_user.company = company  # Link the company to the current user

            db.session.commit()
            logger.info(f"Company details updated successfully for user {current_user.email}")
            return jsonify({'status': 'success', 'message': 'Company details updated successfully'}), 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating company details for user {current_user.email}: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500


# Add this new route for fetching all companies
# Add this new route for fetching all companies with subscription details
@main.route('/api/companies', methods=['GET'])
@login_required
def get_all_companies():
    if current_user.internal_user_role != 'super_admin':
        logger.warning(f"Unauthorized access attempt by {current_user.email}")
        return jsonify({'status': 'error', 'message': 'Unauthorized access'}), 403

    try:
        companies = Company.query.all()
        companies_data = []
        for company in companies:
            # Fetch the first subscription for the company, if it exists
            subscription = Subscription.query.filter_by(company_id=company.id).first()

            subscription_data = {
                'plan_name': subscription.plan_name if subscription else 'No Subscription',
                'status': subscription.status if subscription else 'None',
                'price': subscription.price if subscription else 0,
                'start_date': subscription.start_date.strftime('%Y-%m-%d') if subscription else None,
                'end_date': subscription.end_date.strftime('%Y-%m-%d') if subscription and subscription.end_date else 'Ongoing'
            } if subscription else {}

            company_data = {
                'id': company.id,
                'name': company.name,
                'address': company.address,
                'city': company.city,
                'state': company.state,
                'zip_code': company.zip_code,
                'country': company.country,
                'phone_number': company.phone_number,
                'subscription': subscription_data  # Add the subscription data
            }
            companies_data.append(company_data)

        logger.info(f"Super admin {current_user.email} fetched all companies successfully")
        return jsonify({'status': 'success', 'companies': companies_data}), 200

    except Exception as e:
        logger.error(f"Error fetching all companies for super admin {current_user.email}: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500
        
@main.route('/api/companies/<int:company_id>/users', methods=['GET'])
@login_required
def get_company_users(company_id):
    if current_user.internal_user_role != 'super_admin':
        return jsonify({'status': 'error', 'message': 'Unauthorized access'}), 403

    try:
        company = Company.query.get(company_id)
        if not company:
            return jsonify({'status': 'error', 'message': 'Company not found'}), 404

        users = User.query.filter_by(company_id=company.id).all()
        subscriptions = Subscription.query.filter_by(company_id=company.id).all()  # Fetch subscriptions

        # Serialize user data
        users_data = [
            {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'user_type': user.user_type,
                'internal_user_role': user.internal_user_role
            } for user in users
        ]

        # Serialize subscription data
        subscription_data = [
            {
                'plan_name': sub.plan_name,
                'status': sub.status,
                'price': sub.price,
                'billing_cycle': sub.billing_cycle,
                'start_date': sub.start_date.strftime('%Y-%m-%d'),
                'end_date': sub.end_date.strftime('%Y-%m-%d') if sub.end_date else 'Ongoing',
                'is_active': sub.is_active
            } for sub in subscriptions
        ]

        return jsonify({
            'status': 'success',
            'users': users_data,
            'subscriptions': subscription_data
        }), 200
    except Exception as e:
        logger.error(f"Error fetching users and subscriptions for company {company_id}: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500      

@main.route('/api/meetings', methods=['GET', 'POST'])
@login_required
@cross_origin()
def manage_meetings():
    if request.method == 'GET':
        try:
            hub_id = request.args.get('hub_id')
            meeting_id = request.args.get('meeting_id')  # New parameter for meeting_id

            current_app.logger.info(f"GET /api/meetings called with hub_id: {hub_id}, meeting_id: {meeting_id}")

            if meeting_id:
                current_app.logger.info(f"Fetching meeting sessions for meeting_id: {meeting_id}")
                
                # Fetch meeting sessions for the given meeting_id
                sessions = MeetingSession.query.filter_by(meeting_id=meeting_id).all()

                if not sessions:
                    current_app.logger.warning(f"No sessions found for meeting_id: {meeting_id}")
                    return jsonify({'status': 'success', 'sessions': []}), 200  # Return empty list if no sessions found

                # Serialize the sessions to return as JSON
                sessions_data = [
                    {
                        'id': session.id,
                        'name': session.name,
                        'session_datetime': session.session_datetime.isoformat()
                    } for session in sessions
                ]

                current_app.logger.info(f"Successfully fetched {len(sessions_data)} sessions for meeting_id: {meeting_id}")
                return jsonify({'status': 'success', 'sessions': sessions_data}), 200

            elif hub_id:
                current_app.logger.info(f"Fetching meetings for hub_id: {hub_id}")

                # Fetch meetings for the given hub_id
                meetings = Meeting.query.filter_by(meeting_hub_id=hub_id).all()

                if not meetings:
                    current_app.logger.warning(f"No meetings found for hub_id: {hub_id}")
                    return jsonify({'status': 'success', 'meetings': []}), 200  # Return empty list if no meetings found

                # Serialize the meetings to return as JSON
                meetings_data = [
                    {
                        'id': meeting.id,
                        'name': meeting.name,
                        'description': meeting.description,
                        'is_recurring': meeting.is_recurring  # Assuming the Meeting model has an is_recurring attribute
                    } for meeting in meetings
                ]

                current_app.logger.info(f"Successfully fetched {len(meetings_data)} meetings for hub_id: {hub_id}")
                return jsonify({'status': 'success', 'meetings': meetings_data}), 200
            else:
                current_app.logger.error("Hub ID or Meeting ID not provided")
                # Return an error if neither hub_id nor meeting_id is provided
                return jsonify({'status': 'error', 'message': 'Hub ID or Meeting ID is required'}), 400

        except Exception as e:
            current_app.logger.error(f"Error fetching meetings or sessions: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

    elif request.method == 'POST':
        # POST logic to create a new meeting, optionally create a session if requested
        try:
            data = request.json
            meeting_name = data.get('name')
            hub_id = data.get('hub_id')
            create_session_flag = data.get('create_session', False)  # Add a flag for session creation

            current_app.logger.info(f"POST /api/meetings called with meeting_name: {meeting_name}, hub_id: {hub_id}, create_session: {create_session_flag}")

            if not meeting_name or not hub_id:
                current_app.logger.error("Meeting name or hub ID is missing")
                return jsonify({'status': 'error', 'message': 'Meeting name and hub ID are required'}), 400

            # Create the meeting
            new_meeting = Meeting(
                name=meeting_name,
                description=f"Meeting for {meeting_name}",
                meeting_hub_id=hub_id
            )
            db.session.add(new_meeting)
            db.session.commit()

            current_app.logger.info(f"Created new meeting with id: {new_meeting.id}")

            if create_session_flag:
                # If the flag is true, create the first meeting session linked to the new meeting
                session_name = f"{meeting_name} - {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"
                new_session = MeetingSession(
                    name=session_name,
                    session_datetime=datetime.utcnow(),
                    meeting_id=new_meeting.id
                )
                db.session.add(new_session)
                db.session.commit()

                current_app.logger.info(f"Created new meeting session with id: {new_session.id}")
                return jsonify({'status': 'success', 'meeting_id': new_meeting.id, 'meeting_session_id': new_session.id}), 201
            else:
                # Only create the meeting, no session
                return jsonify({'status': 'success', 'meeting_id': new_meeting.id}), 201

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error creating meeting: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

@main.route('/api/sessions/<int:session_id>', methods=['GET'])
@login_required
@cross_origin()
def get_session(session_id):
    try:
        # Fetch the MeetingSession by ID
        session = MeetingSession.query.get(session_id)
        if not session:
            return jsonify({'status': 'error', 'message': 'Session not found'}), 404

        # Prepare the session data
        session_data = {
            'id': session.id,
            'name': session.name,
            'session_datetime': session.session_datetime.isoformat(),
            'audio_url': None,
            'transcription': session.transcription
        }

        # Handle audio URL
        if session.audio_url:
            if ENVIRONMENT != 'development':
                # Production: Generate signed URL from GCS
                bucket = storage_client.bucket(BUCKET_NAME)
                # Assuming session.audio_url stores relative path (e.g., 'audio_recordings/...')
                blob = bucket.blob(session.audio_url)

                current_app.logger.info(f"Generating signed URL for audio: {session.audio_url}")
                signed_url = blob.generate_signed_url(expiration=timedelta(minutes=15))

                current_app.logger.info(f"Signed URL generated: {signed_url}")
                session_data['audio_url'] = signed_url
            else:
                # Development: Serve the audio file locally
                filename = os.path.basename(session.audio_url)
                local_audio_url = url_for('main.download_file', filename=filename, _external=True)
                current_app.logger.info(f"Local audio URL for session ID {session_id}: {local_audio_url}")
                session_data['audio_url'] = local_audio_url

        # Return the session data as JSON
        return jsonify({'status': 'success', 'session': session_data}), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching session: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

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

        meeting_session_id = data.get('meeting_session_id')
        if not meeting_session_id:
            # Create a new meeting session if not provided
            session_name = f"New Meeting Session {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"
            new_session = MeetingSession(
                name=session_name,
                session_datetime=datetime.utcnow(),
                meeting_id=None  # Update as needed to link to a meeting if required
            )
            db.session.add(new_session)
            db.session.commit()
            meeting_session_id = new_session.id
            current_app.logger.info(f"Created new meeting session {meeting_session_id} with name '{session_name}'")

        user_id = current_user.id  # Assuming you're using Flask-Login

        # Create a new recording entry
        new_recording = Recording(
            id=recording_id,
            user_id=user_id,
            file_name=file_name,
            concatenation_status=concatenation_status,
            concatenation_file_name=concatenation_file_name,
            timestamp=datetime.utcnow(),
            meeting_session_id=meeting_session_id
        )
        db.session.add(new_recording)
        db.session.commit()

        current_app.logger.info(f"Recording {recording_id} created for user {user_id} in session {meeting_session_id}")

        return jsonify({'status': 'success', 'recording': recording_id}), 201
    except Exception as e:
        db.session.rollback()  # Rollback the session on error
        current_app.logger.error(f"Error creating recording: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

@main.route('/upload_chunk', methods=['POST'])
@login_required
@cross_origin()
def upload_chunk():
    try:
        chunk = request.files['chunk']
        chunk_number = request.form['chunk_number']
        recording_id = request.form['recording_id']
        chunk_filename = f"{recording_id}_chunk_{chunk_number}.webm"
        
        if ENVIRONMENT in ['staging', 'production'] and storage_client:
            # Upload chunk to Google Cloud Storage
            file_key = f"{recording_id}_chunk_{chunk_number}.webm"
            bucket = storage_client.bucket(BUCKET_NAME)
            blob = bucket.blob(f"audio_recordings/{file_key}")
            blob.upload_from_file(chunk)
            
            # Now, update the list file in the cloud
            list_file_key = f"audio_recordings/{recording_id}_list.txt"
            list_blob = bucket.blob(list_file_key)
            if list_blob.exists():
                list_blob_content = list_blob.download_as_text()
                list_blob_content += f"file '{file_key}'\n"
            else:
                list_blob_content = f"file '{file_key}'\n"
            list_blob.upload_from_string(list_blob_content)
            
            return jsonify({'status': 'success', 'chunk_key': file_key})
        else:
            # Save chunk locally
            chunk_path = os.path.join(UPLOAD_FOLDER, chunk_filename)
            chunk.save(chunk_path)
            
            # Update the list file locally
            list_file_path = os.path.join(UPLOAD_FOLDER, f"{recording_id}_list.txt")
            with open(list_file_path, 'a') as list_file:
                list_file.write(f"file '{os.path.abspath(chunk_path)}'\n")
            
            return jsonify({'status': 'success', 'chunk_key': chunk_filename})
    except Exception as e:
        current_app.logger.error(f"Error uploading chunk: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@main.route('/uploads/audio_recordings/<path:filename>')
def download_file(filename):
    try:
        if ENVIRONMENT == 'development':
            # Serve the file from the local directory in development
            return send_from_directory(UPLOAD_FOLDER, filename)
        else:
            # **Production Environment:** Generate a signed URL for GCS

            # Create a blob object using the relative path directly
            blob = storage_client.bucket(BUCKET_NAME).blob(f"audio_recordings/{filename}")

            if not blob.exists():
                logger.error(f"File {filename} does not exist in GCS.")
                return jsonify({'status': 'error', 'message': 'File not found'}), 404

            # Generate the signed URL
            signed_url = blob.generate_signed_url(expiration=timedelta(minutes=15))
            logger.info(f"Signed URL for downloading file {filename}: {signed_url}")

            # Redirect to the signed URL
            return redirect(signed_url)

    except Exception as e:
        logger.error(f"Error serving file {filename}: {str(e)}")
        return jsonify({'status': 'error', 'message': 'File not found'}), 404
    

@main.route('/api/set_active_hub', methods=['POST'])
@login_required
def set_active_hub():
    try:
        # Get hub_id from the request
        hub_id = request.json.get('hub_id')
        logger.debug(f"Received request to set active hub with hub_id: {hub_id}")

        # Check if hub_id is provided
        if not hub_id:
            logger.error("hub_id is missing in the request")
            return jsonify({"status": "error", "message": "hub_id is required"}), 400

        # Check if the hub exists in the database
        logger.debug(f"Querying database for hub_id: {hub_id}")
        hub = MeetingHub.query.get(hub_id)
        if not hub:
            logger.error(f"Invalid hub_id: {hub_id}")
            return jsonify({"status": "error", "message": "Invalid hub_id"}), 404

        # Update the active hub for the current user
        logger.debug(f"Setting active hub to {hub_id} for user {current_user.email}")
        current_user.active_meeting_hub_id = hub_id
        db.session.commit()

        logger.info(f"Successfully set active hub to {hub_id} for user {current_user.email}")
        return jsonify({"status": "success"}), 200
    except Exception as e:
        # Rollback the session in case of an error
        db.session.rollback()
        logger.error(f"Error occurred while setting active hub: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500
        

@main.route('/check_update')
def check_update():
        print(">>> ffmpeg installed op heroku <<<")
        return jsonify({"message": "ffmpeg installed op heroku4"}), 200

@main.route('/api/subscription-status', methods=['GET'])
@login_required
def check_subscription_status():
    try:
        company = current_user.company
        if not company:
            return jsonify({'is_active': False, 'is_empty': True}), 404

        active_subscription = Subscription.query.filter_by(company_id=company.id, status='active').first()

        if active_subscription:
            return jsonify({'is_active': True, 'is_empty': False}), 200
        else:
            return jsonify({'is_active': False, 'is_empty': False}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@main.route('/api/subscription-plans', methods=['GET'])
@login_required
def get_subscription_plans():
    # Assuming you have predefined subscription plans
    subscription_plans = [
        {'plan_name': 'Basic Plan', 'price': 50.00, 'billing_cycle': 'monthly', 'max_users': 10},
        {'plan_name': 'Pro Plan', 'price': 100.00, 'billing_cycle': 'yearly', 'max_users': 50},
        {'plan_name': 'Enterprise Plan', 'price': 250.00, 'billing_cycle': 'yearly', 'max_users': 100},
    ]
    
    return jsonify({'status': 'success', 'plans': subscription_plans}), 200

@main.route('/api/subscriptions/<int:subscription_id>', methods=['PATCH'])
@login_required
def update_subscription(subscription_id):
    if current_user.internal_user_role != 'super_admin':
        return jsonify({'status': 'error', 'message': 'Unauthorized access'}), 403

    try:
        subscription = Subscription.query.get(subscription_id)
        if not subscription:
            return jsonify({'status': 'error', 'message': 'Subscription not found'}), 404

        data = request.json
        subscription.status = data.get('status', subscription.status)
        db.session.commit()

        return jsonify({'status': 'success', 'subscription': subscription.status}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


@main.route('/api/transcribe/<int:session_id>', methods=['POST'])
@login_required
def transcribe(session_id):
    try:
        current_app.logger.info(f"Received transcription request for session ID: {session_id}")

        # Log the current user making the request
        current_app.logger.info(f"User {current_user.email} is requesting transcription for session ID: {session_id}")

        # Fetch the audio URL from the database
        session = MeetingSession.query.get_or_404(session_id)
        current_app.logger.info(f"Fetched session for session ID {session_id}: {session}")

        if not session or not session.audio_url:
            current_app.logger.error(f"No audio URL found for session ID: {session_id}")
            return jsonify({'error': 'No audio file found for this session'}), 404

        # Generate the full audio URL using url_for
        filename = session.audio_url.split('/')[-1]
        audio_url = url_for('main.download_file', filename=filename, _external=True)
        current_app.logger.info(f"Audio URL for session ID {session_id}: {audio_url}")

        # Begin the transcription process
        current_app.logger.info(f"Starting transcription process for session ID {session_id} with audio URL {audio_url}")
        transcription_result = transcribe_audio(session_id, audio_url)

        if not transcription_result:
            current_app.logger.error(f"Transcription failed for session ID {session_id}")
            return jsonify({'error': 'Failed to transcribe audio'}), 500

        # Store transcription in the database
        session.transcription = transcription_result
        db.session.commit()
        current_app.logger.info(f"Transcription saved successfully for session ID {session_id}")

        return jsonify({'transcription': transcription_result}), 200

    except Exception as e:
        # Log any exception that occurred during the transcription process
        current_app.logger.exception(f"An error occurred during transcription for session ID {session_id}: {str(e)}")
        return jsonify({'error': 'An error occurred during transcription'}), 500

def transcribe_audio(session_id, audio_url):
    try:
        import os
        import tempfile
        import requests
        from flask import current_app
        from openai import OpenAI
        import json  # Import json to handle JSON responses if necessary
        
        # Initialize the OpenAI client
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # Log the audio URL and session ID
        current_app.logger.info(f"Transcribing audio for session ID {session_id} from URL: {audio_url}")

        # Download the audio file
        audio_response = requests.get(audio_url)
        if audio_response.status_code != 200:
            current_app.logger.error(f"Failed to download audio file from {audio_url}. Status code: {audio_response.status_code}")
            return None

        audio_data = audio_response.content

        # Save the audio data to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_audio_file:
            temp_audio_file.write(audio_data)
            temp_audio_file_path = temp_audio_file.name

        current_app.logger.info(f"Temporary audio file created at {temp_audio_file_path}")

        # Use the OpenAI Whisper API to transcribe the audio, requesting plain text output
        with open(temp_audio_file_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="nl",
                response_format='text'  # Ask for plain text response
            )

        # transcription is now a string since we set `response_format='text'`
        current_app.logger.info(f"Transcription result for session ID {session_id}: {transcription}")

        # Clean up the temporary file
        os.remove(temp_audio_file_path)
        current_app.logger.info(f"Temporary audio file deleted: {temp_audio_file_path}")

        return transcription  # Return the plain text transcription

    except Exception as e:
        current_app.logger.error(f"Error during transcription process for session ID {session_id}: {str(e)}")
        return None


@main.route('/api/extract_action_points/<int:session_id>', methods=['POST'])
def extract_action_points(session_id):
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    logger.debug(f"Starting action point extraction for session_id: {session_id}")

    # Fetch the MeetingSession by ID
    session = MeetingSession.query.get(session_id)
    if not session:
        logger.error(f"Session not found for session_id: {session_id}")
        return jsonify({'status': 'error', 'message': 'Session not found'}), 404

    # Ensure transcription exists
    if not session.transcription:
        logger.error(f"No transcription found for session_id: {session_id}")
        return jsonify({'status': 'error', 'message': 'No transcription available'}), 400

    try:
        logger.debug(f"Sending transcription to OpenAI for action item extraction with structured output, session_id: {session_id}")

        # Define the structured response schema for action points
        action_item_schema = {
            "name": "action_item_schema",
            "schema": {
                "type": "object",
                "properties": {
                    "action_items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "summary": {"type": "string", "description": "Summary of the action item"},
                                "details": {"type": "string", "description": "Detailed explanation of the action item"},
                                "assigned_to": {"type": "string", "description": "Person assigned to the action item"},
                                "due_date": {"type": ["string", "null"], "description": "Due date of the action item in ISO format"},
                                "completed": {"type": "boolean", "description": "Completion status of the action item"}
                            },
                            "required": ["summary", "details"]
                        }
                    }
                },
                "required": ["action_items"]
            }
        }

        # Define the messages with system instructions and the transcription content
        messages = [
            {"role": "system", "content": "You are an AI that extracts action items from meeting transcriptions."},
            {"role": "user", "content": session.transcription}
        ]

        # Call the OpenAI API with the structured response format
        response = client.chat.completions.create(
            model="gpt-4o-2024-08-06",
            messages=messages,
            response_format={
                "type": "json_schema",
                "json_schema": action_item_schema
            }
        )

        # Log the full OpenAI response
        logger.debug(f"Full OpenAI response: {response}")

        # Extract the action points from the content of the message
        response_content = response.choices[0].message.content
        logger.debug(f"Response content: {response_content}")

        # Parse the content into a dictionary
        action_points_data = json.loads(response_content)
        action_items = action_points_data.get('action_items', [])
        if not action_items:
            logger.error("No action items found in the response")
            return jsonify({'status': 'error', 'message': 'No action items found'}), 500

        # Clear existing action points if any
        existing_action_points = ActionItem.query.filter_by(meeting_session_id=session_id).all()
        if existing_action_points:
            logger.info(f"Deleting {len(existing_action_points)} existing action points for session {session_id}")
            for action_item in existing_action_points:
                db.session.delete(action_item)
            db.session.commit()
            logger.info(f"Existing action points deleted successfully for session {session_id}")

        # Process and store the new action points
        new_action_items = []
        sorting_id = 1  # Initialize sorting_id for ordering

        for action in action_items:
            title = action.get('summary', 'No summary provided')
            details = action.get('details', 'No details provided')
            assigned_to = action.get('assigned_to', 'Unassigned')
            due_date = action.get('due_date')  # Due date might be parsed from the action items
            completed = action.get('completed', False)

            # Convert due_date if present
            due_date_obj = None
            if due_date:
                try:
                    due_date_obj = datetime.fromisoformat(due_date)
                except ValueError:
                    logger.error(f"Invalid date format for due_date: {due_date}")

            # Ensure required fields are present
            if not title or not details:
                logger.error(f"Missing fields in action item: {action}")
                return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400

            # Store action points in the database
            action_item = ActionItem(
                title=title,
                description=details,
                assigned_to=assigned_to,
                due_date=due_date_obj,
                completed=completed,
                status='explicit',  # Assuming all are explicit; you can modify if needed
                meeting_session_id=session.id,
                sorting_id=sorting_id
            )
            new_action_items.append(action_item)
            db.session.add(action_item)
            sorting_id += 1

        # Commit to the database
        db.session.commit()
        logger.info(f"Action points saved successfully for session_id: {session_id}")

        # Return the saved action items as a JSON response
        return jsonify({
            'status': 'success',
            'action_items': [ap.to_dict() for ap in new_action_items]
        }), 200

    except Exception as e:
        logger.error(f"Error extracting action points: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Error extracting action points'}), 500


@main.route('/api/update_action_point_title/<int:action_item_id>', methods=['PUT'])
def update_action_point_title(action_item_id):
    data = request.get_json()  # Get the data from the request
    new_title = data.get('title')  # Extract the new title from the data

    if not new_title:
        return jsonify({'status': 'error', 'message': 'Title is required'}), 400

    # Fetch the action item by ID
    action_item = ActionItem.query.get(action_item_id)
    if not action_item:
        return jsonify({'status': 'error', 'message': 'Action item not found'}), 404

    # Update the title
    action_item.title = new_title

    # Commit the changes to the database
    try:
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Action item title updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': 'Failed to update title'}), 500       

@main.route('/api/sessions/<int:session_id>/action_points', methods=['GET'])
def get_action_points(session_id):
    logger.debug(f"Fetching action points for session_id: {session_id}")
    
    session = MeetingSession.query.get(session_id)
    if not session:
        logger.error(f"Session not found for session_id: {session_id}")
        return jsonify({'status': 'error', 'message': 'Session not found'}), 404

    action_items = ActionItem.query.filter_by(meeting_session_id=session_id).all()

    if not action_items:
        logger.info(f"No action items found for session_id: {session_id}")
        return jsonify({'status': 'success', 'action_items': []}), 200  # Return an empty list with success status

    # Serialize the action items with sorting_id
    action_items_list = [
        {
            'id': item.id,
            'title': item.title,
            'description': item.description,
            'assigned_to': item.assigned_to,
            'due_date': item.due_date.strftime('%Y-%m-%d') if item.due_date else None,
            'completed': item.completed,
            'sorting_id': item.sorting_id  # Use sorting_id instead of sort_id
        }
        for item in action_items
    ]

    logger.debug(f"Returning action points for session_id: {session_id}")
    return jsonify({'status': 'success', 'action_items': action_items_list}), 200


from openai import OpenAI

@main.route('/api/sessions/<int:session_id>/summarize', methods=['POST'])
def summarize_session(session_id):
    session = MeetingSession.query.get(session_id)
    if not session or not session.transcription:
        return jsonify({'status': 'error', 'message': 'Session not found or transcription is missing'}), 404

    transcription_text = session.transcription

    # Short summary prompt
    short_summary_prompt = f"""
    Summarize the core topics in a maximum of 5 bullet points. Sentences should be short and capture only the core ideas.

    Use HTML for formatting:
    <strong>This meeting was about:</strong>
    <ul>
        <li>.......</li>
        <li>.......</li>
        <li>.......</li>
    </ul>

    <strong>Action points:</strong>
    <ul>
        <li>.......</li>
        <li>.......</li>
        <li>.......</li>
    </ul>
    """

    # Long summary prompt
    long_summary_prompt = f"""
    Summarize the meeting in detail, including sections and action points.

    Use HTML for formatting:
    <strong>Summary of this meeting:</strong>

    <strong>Relevant topic:</strong>
    <ul>
        <li>.......</li>
        <li>.......</li>
        <li>.......</li>
    </ul>

    <strong>Action points:</strong>
    <ul>
        <li>.......</li>
        <li>.......</li>
        <li>.......</li>
    </ul>
    """


    client = OpenAI()

    # Short summary API call
    short_summary_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": short_summary_prompt + transcription_text}
        ]
    )

    # Long summary API call
    long_summary_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": long_summary_prompt + transcription_text}
        ]
    )

    # Extract summaries from responses correctly
    short_summary = short_summary_response.choices[0].message.content
    long_summary = long_summary_response.choices[0].message.content

    # Save summaries to the session
    session.short_summary = short_summary
    session.long_summary = long_summary
    db.session.commit()

    return jsonify({
        'status': 'success',
        'short_summary': session.short_summary,
        'long_summary': session.long_summary
    }), 200



@main.route('/api/sessions/<int:session_id>/action_points', methods=['POST'])
@login_required
def add_action_point(session_id):
    data = request.get_json()
    title = data.get('title')

    if not title:
        return jsonify({'status': 'error', 'message': 'Title is required'}), 400

    # Create new action item
    action_item = ActionItem(
        title=title,
        meeting_session_id=session_id,
        description='',
        assigned_to='',
        sorting_id=1,  # Adjust this accordingly
    )

    db.session.add(action_item)
    db.session.commit()

    return jsonify({'status': 'success', 'action_item': action_item.to_dict()}), 201

@main.route('/api/sessions/<int:session_id>/short_summary', methods=['GET'])
@login_required
def get_short_summary(session_id):
    session = MeetingSession.query.get(session_id)
    if not session:
        return jsonify({'status': 'error', 'message': 'Session not found'}), 404
    
    if not session.short_summary:
        return jsonify({'status': 'error', 'message': 'No short summary available'}), 404

    return jsonify({'status': 'success', 'short_summary': session.short_summary}), 200

@main.route('/api/sessions/<int:session_id>/long_summary', methods=['GET'])
@login_required
def get_long_summary(session_id):
    session = MeetingSession.query.get(session_id)
    if not session:
        return jsonify({'status': 'error', 'message': 'Session not found'}), 404
    
    if not session.long_summary:
        return jsonify({'status': 'error', 'message': 'No long summary available'}), 404

    return jsonify({'status': 'success', 'long_summary': session.long_summary}), 200 

@main.route('/api/sessions/<int:session_id>/summaries', methods=['GET'])
@login_required
def get_summaries(session_id):
    session = MeetingSession.query.get(session_id)
    if not session:
        return jsonify({'status': 'error', 'message': 'Session not found'}), 404
    
    return jsonify({
        'status': 'success',
        'short_summary': session.short_summary or 'No short summary available',
        'long_summary': session.long_summary or 'No long summary available',
    }), 200


@main.route('/api/action_item/<int:id>/complete', methods=['PUT'])
def update_action_item_status(action_item_id):
    data = request.get_json()
    completed = data.get('completed')

    # Fetch the action item by ID
    action_item = ActionItem.query.get(action_item_id)
    if not action_item:
        return jsonify({'status': 'error', 'message': 'Action item not found'}), 404

    # Update the completion status
    action_item.completed = completed

    try:
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Action item updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@main.route('/api/sessions', methods=['POST'])
def create_session():
    try:
        # Parse the request data
        data = request.json
        meeting_id = data.get('meeting_id')
        
        # Validate meeting_id
        if not meeting_id:
            return jsonify({'error': 'Meeting ID is required'}), 400

        # Fetch the meeting from the database to verify it exists
        meeting = Meeting.query.get(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404

        # Create a new meeting session
        new_session = MeetingSession(
            name=f'Session for {meeting.name}',  # Example naming convention
            session_datetime=datetime.utcnow(),
            meeting_id=meeting_id
        )

        # Add the new session to the database
        db.session.add(new_session)
        db.session.commit()

        # Return the created session ID
        return jsonify({'session_id': new_session.id}), 201

    except Exception as e:
        # Handle any errors and return a 500 error
        return jsonify({'error': str(e)}), 500