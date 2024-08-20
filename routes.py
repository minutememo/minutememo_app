#routes.py
from flask import Blueprint, render_template, request, jsonify, current_app
import os
import uuid
from flask_cors import cross_origin
import ffmpeg
from werkzeug.security import generate_password_hash, check_password_hash
from .models import User, db, Recording, MeetingSession, MeetingHub, Company, Meeting
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

@main.route('/api/meetingsessions', methods=['GET', 'POST'])
@login_required
@cross_origin()
def manage_meeting_sessions():
    if request.method == 'GET':
        try:
            # Fetch all meeting sessions
            meeting_sessions = MeetingSession.query.all()
            sessions_data = [
                {
                    'id': session.id,
                    'name': session.name,
                    'session_datetime': session.session_datetime.strftime('%Y-%m-%d %H:%M:%S'),
                    'meeting_id': session.meeting_id
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

            # Serialize the meeting hubs to return as JSON
            meeting_hubs_data = [
                {
                    'id': hub.id,
                    'name': hub.name,
                    'description': hub.description,
                    'users': [user.email for user in hub.users]  # Assuming User model has an email attribute
                } for hub in meeting_hubs
            ]

            return jsonify({'status': 'success', 'meeting_hubs': meeting_hubs_data}), 200
        except Exception as e:
            current_app.logger.error(f"Error fetching meeting hubs: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Internal Server Error'}), 500

    elif request.method == 'POST':
        try:
            data = request.json
            name = data.get('name')
            description = data.get('description', 'No description')

            if not name:
                return jsonify({'status': 'error', 'message': 'Name is required'}), 400

            # Get the company_id from the current user
            company_id = current_user.company_id
            if not company_id:
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
        

@main.route('/api/meetings', methods=['POST'])
@login_required
@cross_origin()
def create_meeting():
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
        