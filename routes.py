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
from models import User, db, Recording, MeetingSession, MeetingHub, Company, Meeting
from extensions import db  # Import from extensions.py
from flask_login import login_required, current_user
from datetime import datetime, timedelta
import traceback
from app import credentials
from celery.result import AsyncResult
from celery_factory import celery_app  # Import the initialized Celery app

main = Blueprint('main', __name__)
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)
IS_LOCAL = os.getenv('FLASK_ENV') == 'development'


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
        file_key = secure_filename(f"audio_recordings/{file_key}")


        # Get the bucket
        bucket = storage_client.bucket(BUCKET_NAME)
        
        # Create a blob object from the file key
        blob = bucket.blob(file_key)
        
        # Upload the file to Google Cloud Storage
        blob.upload_from_file(file, content_type=file.content_type)
        
        # Make the file publicly accessible (optional)
        blob.make_public()
        
        # Generate the file URL
        file_url = blob.public_url
        return file_url

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
def home_content():
    return render_template('home_content.html')

@main.route('/settings_content')
@login_required
def settings_content():
    return render_template('settings_content.html')



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

            return jsonify({'status': 'success', 'file_url': f'/uploads/audio_recordings/{os.path.basename(mp3_filepath)}'})
        
        else:
            # Cloud processing using Celery
            task = concatenate_cloud.delay(recording_id)
            current_app.logger.info(f"Started Celery task {task.id} for cloud-based concatenation.")
            return jsonify({'status': 'pending', 'task_id': task.id})
    
    except Exception as e:
        current_app.logger.error(f"Error during concatenation: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

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
@celery_app.task(bind=True)
def concatenate_cloud(self, recording_id):
    from app import create_app  # Ensure app is created to push the context
    import requests
    app = create_app()  # This creates an application instance
    with app.app_context():  # Push the application context
        try:
            current_app.logger.info(f"Starting cloud concatenation task for recording_id: {recording_id}")

            # Cloud processing using GCS
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
            local_chunk_paths = []
            for idx, chunk in enumerate(chunk_files):
                blob = storage_client.bucket(BUCKET_NAME).blob(f"audio_recordings/{chunk}")
                signed_url = blob.generate_signed_url(expiration=timedelta(minutes=30))

                # Log signed URL for debugging
                current_app.logger.info(f"Generated signed URL for chunk {idx}: {signed_url}")

                # Download the file
                local_path = os.path.join(temp_dir, f"chunk_{idx}.webm")
                response = requests.get(signed_url)
                with open(local_path, 'wb') as f:
                    f.write(response.content)
                local_chunk_paths.append(local_path)
                current_app.logger.info(f"Downloaded chunk {idx} to {local_path}")

            # Log all local chunk paths
            current_app.logger.info(f"Downloaded chunk files: {local_chunk_paths}")

            # Create the list file for FFmpeg
            list_file_path = os.path.join(temp_dir, f"{recording_id}_list.txt")
            with open(list_file_path, 'w') as f:
                for local_path in local_chunk_paths:
                    f.write(f"file '{local_path}'\n")

            current_app.logger.info(f"Created FFmpeg list file at {list_file_path}")

            # Create a local output path for the concatenated file
            local_output_path = os.path.join(temp_dir, f"{recording_id}.webm")

            try:
                current_app.logger.info(f"Running FFmpeg concatenation for {recording_id}")
                # Use local files for FFmpeg
                (
                    ffmpeg
                    .input(list_file_path, format='concat', safe=0)
                    .output(local_output_path, c='copy')
                    .run()
                )
                current_app.logger.info(f"Cloud concatenation output saved at {local_output_path}")
            except ffmpeg.Error as e:
                stderr_output = e.stderr.decode('utf-8') if e.stderr else 'No error output'
                current_app.logger.error(f"Error concatenating files with ffmpeg: {stderr_output}")
                update_concatenation_status(recording_id, "error")
                return {'status': 'error', 'message': f"Error concatenating files: {stderr_output}"}

            # Upload the concatenated WebM file to GCS
            final_output_gcs = f"audio_recordings/{recording_id}.webm"
            try:
                current_app.logger.info(f"Uploading WebM file to GCS at {final_output_gcs}")
                upload_file_to_gcs(local_output_path, final_output_gcs)
                current_app.logger.info(f"WebM file uploaded to GCS at {final_output_gcs}")
            except Exception as e:
                current_app.logger.error(f"Error uploading the file to GCS: {e}")
                update_concatenation_status(recording_id, "error")
                return {'status': 'error', 'message': f"Error uploading the file to GCS: {str(e)}"}

            # Now convert the WebM file to MP3
            mp3_output_path = os.path.join(temp_dir, f"{recording_id}.mp3")
            try:
                current_app.logger.info(f"Converting {local_output_path} to MP3")
                # Convert to MP3 using FFmpeg
                (
                    ffmpeg
                    .input(local_output_path)
                    .output(mp3_output_path, format='mp3')
                    .run()
                )
                current_app.logger.info(f"MP3 conversion successful. File saved at {mp3_output_path}")
            except ffmpeg.Error as e:
                stderr_output = e.stderr.decode('utf-8') if e.stderr else 'No error output'
                current_app.logger.error(f"Error converting to MP3: {stderr_output}")
                update_concatenation_status(recording_id, "error")
                return {'status': 'error', 'message': f"Error converting to MP3: {stderr_output}"}

            # Upload the MP3 file to GCS
            final_mp3_output_gcs = f"audio_recordings/{recording_id}.mp3"
            try:
                current_app.logger.info(f"Uploading MP3 file to GCS at {final_mp3_output_gcs}")
                upload_file_to_gcs(mp3_output_path, final_mp3_output_gcs)
                current_app.logger.info(f"MP3 file uploaded to GCS at {final_mp3_output_gcs}")
            except Exception as e:
                current_app.logger.error(f"Error uploading the MP3 file to GCS: {e}")
                update_concatenation_status(recording_id, "error")
                return {'status': 'error', 'message': f"Error uploading the MP3 file to GCS: {str(e)}"}

            # Update concatenation status to success
            current_app.logger.info(f"Updating concatenation status to success for recording_id: {recording_id}")
            update_concatenation_status(recording_id, "success")
            current_app.logger.info(f"Concatenation status updated to success for recording_id: {recording_id}")

            return {
                'status': 'success',
                'webm_file_url': f"gs://{BUCKET_NAME}/{final_output_gcs}",
                'mp3_file_url': f"gs://{BUCKET_NAME}/{final_mp3_output_gcs}"
            }

        except Exception as e:
            current_app.logger.error(f"Error during cloud concatenation: {e}")
            update_concatenation_status(recording_id, "error")
            return {'status': 'error', 'message': str(e)}
        finally:
            # Clean up local files
            current_app.logger.info(f"Cleaning up local files for recording_id: {recording_id}")
            shutil.rmtree(temp_dir)
            current_app.logger.info(f"Cleanup completed for recording_id: {recording_id}")


@main.route('/api/meetingsessions', methods=['GET', 'POST'])
@login_required
@cross_origin()
def manage_meeting_sessions():
    if request.method == 'GET':
        try:
            hub_id = request.args.get('hub_id')
            if not hub_id:
                return jsonify({'status': 'error', 'message': 'Hub ID is required'}), 400

            # Fetch all meeting sessions for the specified hub_id
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
                    'meeting_name': session.meeting.name  # Assuming MeetingSession has a relationship to Meeting
                } for session in meeting_sessions
            ]
            return jsonify({'status': 'success', 'meeting_sessions': sessions_data}), 200
        except Exception as e:
            current_app.logger.error(f"Error fetching meeting sessions: {str(e)}")
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
        

@main.route('/api/meetings', methods=['GET', 'POST'])
@login_required
@cross_origin()
def manage_meetings():
    if request.method == 'GET':
        try:
            hub_id = request.args.get('hub_id')
            meeting_id = request.args.get('meeting_id')  # New parameter for meeting_id

            if meeting_id:
                # Fetch meeting sessions for the given meeting_id
                sessions = MeetingSession.query.filter_by(meeting_id=meeting_id).all()

                if not sessions:
                    return jsonify({'status': 'success', 'sessions': []}), 200  # Return empty list if no sessions found

                # Serialize the sessions to return as JSON
                sessions_data = [
                    {
                        'id': session.id,
                        'name': session.name,
                        'session_datetime': session.session_datetime.isoformat()
                    } for session in sessions
                ]

                return jsonify({'status': 'success', 'sessions': sessions_data}), 200

            elif hub_id:
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

                return jsonify({'status': 'success', 'meetings': meetings_data}), 200
            else:
                return jsonify({'status': 'error', 'message': 'Hub ID or Meeting ID is required'}), 400

        except Exception as e:
            current_app.logger.error(f"Error fetching meetings or sessions: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

    elif request.method == 'POST':
        # Existing POST logic
        try:
            data = request.json
            meeting_name = data.get('name')
            hub_id = data.get('hub_id')

            if not meeting_name or not hub_id:
                return jsonify({'status': 'error', 'message': 'Meeting name and hub ID are required'}), 400

            # Create the meeting
            new_meeting = Meeting(
                name=meeting_name,
                description=f"Meeting for {meeting_name}",
                meeting_hub_id=hub_id
            )
            db.session.add(new_meeting)
            db.session.commit()

            # Create the meeting session linked to the meeting
            session_name = f"{meeting_name} - {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"
            new_session = MeetingSession(
                name=session_name,
                session_datetime=datetime.utcnow(),
                meeting_id=new_meeting.id
            )
            db.session.add(new_session)
            db.session.commit()

            return jsonify({'status': 'success', 'meeting_session_id': new_session.id}), 201

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error creating meeting: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

@main.route('/api/sessions/<int:session_id>', methods=['GET'])
@login_required
@cross_origin()
def get_session(session_id):
    try:
        session = MeetingSession.query.get(session_id)
        if not session:
            return jsonify({'status': 'error', 'message': 'Session not found'}), 404

        session_data = {
            'id': session.id,
            'name': session.name,
            'session_datetime': session.session_datetime.isoformat(),
            'audio_url': session.audio_url  # Assuming you have a column for the audio URL
        }

        return jsonify({'status': 'success', 'session': session_data}), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching session: {str(e)}")
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
            # Serve the file from the local directory
            return send_from_directory(UPLOAD_FOLDER, filename)
        else:
            # Generate a signed URL to download the file from Google Cloud Storage
            bucket = storage_client.bucket(BUCKET_NAME)
            blob = bucket.blob(f"audio_recordings/{filename}")
            url = blob.generate_signed_url(expiration=timedelta(minutes=15))
            return redirect(url)
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