from celery import Celery
import os

def make_celery(app):
    # Get the Redis URL from the environment variable set by Heroku
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')  # Fallback to local Redis

    # Create the Celery application with the Flask app's name
    celery = Celery(app.import_name, broker=redis_url)

    # Update Celery config from the Flask app's config
    celery.conf.update(app.config)

    # Set result backend and other Celery configurations
    celery.conf.update(
        result_backend=redis_url,  # Redis will be used as the result backend
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='UTC',
        enable_utc=True,
    )

    # Enable the Flask app context in the Celery task
    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery