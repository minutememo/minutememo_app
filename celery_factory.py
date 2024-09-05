from celery import Celery
import os

def make_celery(app):
    # Get the Redis URL from the environment variable or use the one provided directly
    redis_url = os.getenv('REDIS_URL', 'rediss://:your_password@your_host:8710')

    # Create the Celery application with the Flask app's name
    celery = Celery(app.import_name, broker=redis_url)

    # Update Celery config from the Flask app's config
    celery.conf.update(app.config)

    # Set result backend and other Celery configurations
    celery.conf.update(
        broker_use_ssl={'ssl_cert_reqs': 'CERT_NONE'},  # To support SSL Redis
        result_backend=redis_url,
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='UTC',
        enable_utc=True,
    )

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery