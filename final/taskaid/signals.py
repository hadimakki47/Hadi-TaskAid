
from django.db.models.signals import post_save, pre_save, post_delete
from django.dispatch import receiver
from django.db import models
from .models import Task, StudyUser

@receiver(pre_save, sender=Task)
def task_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            prev = Task.objects.get(pk=instance.pk)
            instance._previous_status = prev.status
        except Task.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None

@receiver(post_save, sender=Task)
def task_post_save(sender, instance, created, **kwargs):
    user = instance.user
    prev = getattr(instance, '_previous_status', None)
    if (prev != Task.STATUS_DONE) and (instance.status == Task.STATUS_DONE):
        StudyUser.objects.filter(pk=user.pk).update(tasks_done_total=models.F('tasks_done_total') + 1)
    if (prev == Task.STATUS_DONE) and (instance.status != Task.STATUS_DONE):
        StudyUser.objects.filter(pk=user.pk).update(tasks_done_total=models.F('tasks_done_total') - 1)

@receiver(post_delete, sender=Task)
def task_post_delete(sender, instance, **kwargs):
    if instance.status == Task.STATUS_DONE:
        user = instance.user
        StudyUser.objects.filter(pk=user.pk).update(tasks_done_total=models.F('tasks_done_total') - 1)
