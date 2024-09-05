from celery import Celery
import os

def make_celery(app):
    # Get the Redis URL from the environment variable
    redis_url = os.getenv('REDIS_URL')

    # Create the Celery application with Redis as the broker and result backend
    celery = Celery(app.import_name, broker=redis_url, backend=redis_url)

    # Update Celery config from the Flask app's config
    celery.conf.update(app.config)

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery