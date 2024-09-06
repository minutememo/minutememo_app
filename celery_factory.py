from celery import Celery
import os

# Set Redis URL from environment variables
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

def init_celery():
    """
    Initialize a basic Celery instance using Redis as the broker and backend.
    
    This is a standalone instance without Flask context.
    """
    celery = Celery('minutememo', broker=redis_url, backend=redis_url)
    celery.conf.update(
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='UTC',
        enable_utc=True,
    )
    return celery

# Call the init_celery function to create the app-level Celery instance
celery_app = init_celery()

def make_celery(flask_app):
    """
    Creates and configures a Celery application using Flask's application context.
    
    Args:
        flask_app: The Flask application instance.

    Returns:
        A Celery instance configured with the Flask app context.
    """
    # Use the Redis URL for both broker and backend
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

    # Create a new Celery instance with Redis as the broker and backend
    celery = Celery(flask_app.import_name, broker=redis_url, backend=redis_url)

    # Update the Celery configuration using the Flask app's config
    celery.conf.update(flask_app.config)

    class ContextTask(celery.Task):
        """
        Custom Task class that ensures the Flask app context is available 
        during task execution.
        """
        def __call__(self, *args, **kwargs):
            with flask_app.app_context():  # Push Flask app context
                return self.run(*args, **kwargs)

    # Set the custom task class for Celery
    celery.Task = ContextTask

    return celery

# Example Celery task for concatenation
@celery_app.task(bind=True)
def process_concatenation(self, recording_id, signed_urls, output_file):
    """
    This task handles cloud-based audio concatenation using FFmpeg.

    Args:
        recording_id (str): The ID of the recording being concatenated.
        signed_urls (list): A list of signed URLs for the chunks.
        output_file (str): The path for the concatenated output in GCS.

    Returns:
        dict: Status of the concatenation process.
    """

    try:
        # Placeholder for actual concatenation logic using FFmpeg
        print(f"Processing concatenation for recording ID: {recording_id}")
        
        # Run the concatenation logic (update this with actual code)
        result = run_concatenation_cloud(signed_urls, output_file)

        # Once done, return result or success status
        return {'status': 'success', 'result': result}
    except Exception as e:
        # Handle exceptions and retry up to 3 times
        self.retry(exc=e, countdown=60, max_retries=3)
        return {'status': 'failed', 'error': str(e)}