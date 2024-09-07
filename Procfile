web: gunicorn wsgi:app
worker: celery -A celery_factory.celery_app worker --loglevel=info