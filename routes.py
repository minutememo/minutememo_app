from flask import Blueprint, request, jsonify
import os
import uuid
from flask_cors import cross_origin
import ffmpeg

main = Blueprint('main', __name__)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@main.route('/')
def home():
    return render_template('index.html')

@main.route('/home_content')
def home_content():
    return render_template('home_content.html')

@main.route('/settings_content')
def settings_content():
    return render_template('settings_content.html')

@main.route('/profile_content')
def profile_content():
    return render_template('profile_content.html')

@main.route('/upload_chunk', methods=['POST'])
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
    
    return jsonify({'status': 'success', 'chunk_key': chunk_filename})

def natural_sort_key(s):
    import re
    return [int(text) if text.isdigit() else text.lower() for text in re.split('([0-9]+)', s)]

@main.route('/concatenate', methods=['POST'])
@cross_origin()
def concatenate():
    try:
        data = request.get_json()
        if not data or 'recording_id' not in data:
            return jsonify({'status': 'error', 'message': 'Missing recording_id'}), 400

        recording_id = data['recording_id']
        print(f"Received request to concatenate for recording_id: {recording_id}")
        chunk_files = sorted(
            [f for f in os.listdir(UPLOAD_FOLDER) if f.startswith(recording_id) and f.endswith('.webm')],
            key=natural_sort_key
        )

        if not chunk_files:
            return jsonify({'status': 'error', 'message': 'No chunks found for the given recording_id'}), 400

        # Log chunk files to be concatenated
        print(f"Chunk files to concatenate: {chunk_files}")

        list_file_path = os.path.join(UPLOAD_FOLDER, f"{recording_id}_list.txt")
        with open(list_file_path, 'w') as f:
            for chunk_file in chunk_files:
                chunk_path = os.path.abspath(os.path.join(UPLOAD_FOLDER, chunk_file))
                
                # Check if the file exists and is not empty
                if os.path.exists(chunk_path) and os.path.getsize(chunk_path) > 0:
                    print(f"Adding chunk to list file: {chunk_path}, size: {os.path.getsize(chunk_path)} bytes")
                    f.write(f"file '{chunk_path}'\n")
                else:
                    print(f"Skipping chunk (file not found or empty): {chunk_path}")

        # Log the contents of the list file
        with open(list_file_path, 'r') as f:
            print("List file contents:")
            print(f.read())

        final_output = os.path.join(UPLOAD_FOLDER, f"{recording_id}.webm")
        try:
            (
                ffmpeg
                .input(list_file_path, format='concat', safe=0)
                .output(final_output, c='copy')
                .run()
            )
        except ffmpeg.Error as e:
            print(f"Error concatenating files with ffmpeg: {e}")
            return jsonify({'status': 'error', 'message': f"Error concatenating files: {str(e)}"}), 500

        # Convert the concatenated file to mp3
        mp3_filepath = os.path.splitext(final_output)[0] + '.mp3'
        convert_to_mp3(final_output, mp3_filepath)

        print(f"Concatenation successful: {mp3_filepath}")
        return jsonify({'status': 'success', 'file_url': mp3_filepath})
    except Exception as e:
        print(f"Error during concatenation: {e}")
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