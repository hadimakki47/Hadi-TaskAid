
from django.apps import AppConfig

class TaskaidConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'taskaid'

    def ready(self):
        from . import signals  # noqa
