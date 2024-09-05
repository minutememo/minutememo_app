# celery_worker.py
from app import create_app
from celery_factory import make_celery

app = create_app()
celery = make_celery(app)