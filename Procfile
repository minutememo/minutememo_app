web: gunicorn wsgi:app
worker: celery -A celery_app.celery worker --loglevel=info