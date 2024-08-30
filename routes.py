#routes.py
from flask import Blueprint, render_template, request, jsonify, current_app, send_from_directory, redirect, url_for
import os
import boto3
import logging
from botocore.exceptions import NoCredentialsError, ClientError
import uuid
from flask_cors import cross_origin
import ffmpeg
from werkzeug.security import generate_password_hash, check_password_hash
from models import User, db, Recording, MeetingSession, MeetingHub, Company, Meeting
from extensions import db  # Import from extensions.py
from flask_login import login_required, current_user
from datetime import datetime


main = Blueprint('main', __name__)
logger = logging.getLogger(__name__)

# Load environment settings
ENVIRONMENT = os.getenv('FLASK_ENV', 'development')
UPLOAD_FOLDER = os.path.join('uploads', 'audio_recordings')
USE_SPACES = os.getenv('USE_SPACES', 'false').lower() == 'true'

# DigitalOcean Spaces configuration (only used if USE_SPACES is true)
if USE_SPACES:
    DO_SPACE_NAME = os.getenv('DO_SPACE_NAME')
    DO_REGION = os.getenv('DO_REGION', 'nyc3')
    DO_ENDPOINT_URL = f"https://{DO_REGION}.digitaloceanspaces.com"
    DO_ACCESS_KEY = os.getenv('DO_ACCESS_KEY')
    DO_SECRET_KEY = os.getenv('DO_SECRET_KEY')

    # Initialize the boto3 client for DigitalOcean Spaces
    s3_client = boto3.client('s3',
                             region_name=DO_REGION,
                             endpoint_url=DO_ENDPOINT_URL,
                             aws_access_key_id=DO_ACCESS_KEY,
                             aws_secret_access_key=DO_SECRET_KEY)

if not USE_SPACES and not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def upload_file(file, file_key):
    if USE_SPACES:
        try:
            file_key = f"audio_recordings/{file_key}"
            s3_client.upload_fileobj(file, DO_SPACE_NAME, file_key)
            file_url = f"{DO_ENDPOINT_URL}/{DO_SPACE_NAME}/{file_key}"
            return file_url
        except NoCredentialsError:
            current_app.logger.error("Credentials not available for DigitalOcean Spaces")
            raise
        except ClientError as e:
            current_app.logger.error(f"Error uploading file to DigitalOcean Spaces: {str(e)}")
            raise
    else:
        # Save locally in the audio_recordings folder
        file_path = os.path.join(UPLOAD_FOLDER, file_key)
        file.save(file_path)
        file_url = f"{file_key}"
        return file_url

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
        data = request.json

        # Log the incoming data to see what is being received
        current_app.logger.info(f"Received data for updating recording {recording_id}: {data}")

        audio_url = data.get('audio_url')
        if not audio_url:
            current_app.logger.error("Audio URL is null or not provided")
            return jsonify({'status': 'error', 'message': 'Audio URL is required'}), 400

        # Find the recording by ID
        recording = Recording.query.get_or_404(recording_id)
        
        # Log the current state of the recording before updating
        current_app.logger.info(f"Current recording before update: {recording}")

        # Find the associated meeting session by the recording's meeting_session_id
        meeting_session = MeetingSession.query.get_or_404(recording.meeting_session_id)
        
        # Update the audio_url in the meeting session
        meeting_session.audio_url = audio_url
        db.session.commit()

        # Log the updated state of the meeting session
        current_app.logger.info(f"Meeting session after update: {meeting_session}")

        return jsonify({'status': 'success', 'message': 'Meeting session updated successfully with audio URL'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating meeting session: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

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
        data = request.get_json()
        if not data or 'recording_id' not in data:
            current_app.logger.error("Missing recording_id in the request data")
            return jsonify({'status': 'error', 'message': 'Missing recording_id'}), 400

        recording_id = data['recording_id']
        current_app.logger.info(f"Received request to concatenate for recording_id: {recording_id}")

        # Get a list of chunk files
        chunk_files = sorted(
            [f for f in os.listdir(UPLOAD_FOLDER) if f.startswith(recording_id) and f.endswith('.webm')],
            key=natural_sort_key
        )

        if not chunk_files:
            current_app.logger.error(f"No chunks found for recording_id: {recording_id}")
            return jsonify({'status': 'error', 'message': 'No chunks found for the given recording_id'}), 400

        # Log chunk files to be concatenated
        current_app.logger.info(f"Chunk files to concatenate: {chunk_files}")

        # Create the list file with paths of the chunks
        list_file_path = os.path.join(UPLOAD_FOLDER, f"{recording_id}_list.txt")
        
        with open(list_file_path, 'w') as f:
            for chunk in chunk_files:
                # Write the correct path to the list file
                f.write(f"file '{os.path.abspath(os.path.join(UPLOAD_FOLDER, chunk))}'\n")

        # Define the final output file path
        final_output = os.path.join(UPLOAD_FOLDER, f"{recording_id}.webm")
        concatenation_status = 'success'

        # Attempt to concatenate using FFmpeg
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

        return jsonify({'status': 'success', 'file_url': f'/uploads/audio_recordings/{os.path.basename(mp3_filepath)}'})
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
                return jsonify({'status': 'success', 'company': company_data}), 200
            else:
                return jsonify({'status': 'error', 'message': 'Company not found'}), 404
        except Exception as e:
            current_app.logger.error(f"Error fetching company: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

    elif request.method == 'POST':
        try:
            data = request.json
            company = current_user.company

            if company:
                company.name = data.get('name', company.name)
                company.address = data.get('address', company.address)
                company.city = data.get('city', company.city)
                company.state = data.get('state', company.state)
                company.zip_code = data.get('zip_code', company.zip_code)
                company.country = data.get('country', company.country)
                company.phone_number = data.get('phone_number', company.phone_number)
            else:
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
            return jsonify({'status': 'success', 'message': 'Company details updated successfully'}), 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating company: {str(e)}")
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
                    return jsonify({'status': 'error', 'message': 'No sessions found for this meeting ID'}), 404

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
                    return jsonify({'status': 'error', 'message': 'No meetings found for this hub ID'}), 404

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


@main.route('/uploads/audio_recordings/<path:filename>')
def download_file(filename):
    if USE_SPACES:
        try:
            url = s3_client.generate_presigned_url('get_object',
                                                   Params={'Bucket': DO_SPACE_NAME, 'Key': f"audio_recordings/{filename}"},
                                                   ExpiresIn=3600)
            current_app.logger.info(f"Generated presigned URL for {filename}")
            return redirect(url)
        except ClientError as e:
            current_app.logger.error(f"Error generating presigned URL for {filename}: {str(e)}")
            return jsonify({'status': 'error', 'message': 'File not found'}), 404
    else:
        try:
            return send_from_directory(UPLOAD_FOLDER, filename)
        except Exception as e:
            current_app.logger.error(f"Error serving file {filename} from local storage: {str(e)}")
            return jsonify({'status': 'error', 'message': 'File not found'}), 404
    chunk = request.files['chunk']
    chunk_number = request.form['chunk_number']
    recording_id = request.form['recording_id']
    chunk_filename = f"{recording_id}_chunk_{chunk_number}.webm"

    try:
        file_url = upload_file(chunk, chunk_filename)
        return jsonify({'status': 'success', 'chunk_key': chunk_filename, 'file_url': file_url})
    except Exception as e:
        current_app.logger.error(f"Error uploading chunk: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

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
        hub = MeetingHub.query.get(hub_id)
        if not hub:
            logger.error(f"Invalid hub_id: {hub_id}")
            return jsonify({"status": "error", "message": "Invalid hub_id"}), 404

        # Update the active hub for the current user
        current_user.active_meeting_hub_id = hub_id
        db.session.commit()

        logger.info(f"Successfully set active hub to {hub_id} for user {current_user.email}")
        return jsonify({"status": "success"}), 200
    except Exception as e:
        # Rollback the session in case of an error
        db.session.rollback()
        logger.error(f"Error occurred while setting active hub: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500