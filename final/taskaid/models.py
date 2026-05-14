from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator

class StudyUser(models.Model):
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('prefer_not', 'Prefer not to say'),
    ]

    name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    age = models.PositiveIntegerField(null=True, blank=True, validators=[MinValueValidator(0)])
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, null=True, blank=True)
    streak = models.IntegerField(default=0)
    tasks_done_total = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.name} ({self.email})"


class Task(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_INPROG = 'in-progress'
    STATUS_DONE = 'done'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_INPROG, 'In Progress'),
        (STATUS_DONE, 'Done'),
    ]

    SUBJECT_CHOICES = [
        ('math', 'Mathematics'),
        ('science', 'Science'),
        ('history', 'History'),
        ('language', 'Language Arts'),
        ('other', 'Other'),
    ]

    user = models.ForeignKey(StudyUser, on_delete=models.CASCADE, related_name="tasks", null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    subject = models.CharField(max_length=20, choices=SUBJECT_CHOICES, null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    completed = models.BooleanField(default=False)  # Added for template compatibility
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def mark_done(self):
        if self.status != self.STATUS_DONE:
            self.status = self.STATUS_DONE
            self.completed = True
            self.completed_at = timezone.now()
            self.save(update_fields=['status', 'completed', 'completed_at', 'updated_at'])

    def toggle_completion(self):
        self.completed = not self.completed
        if self.completed:
            self.status = self.STATUS_DONE
            self.completed_at = timezone.now()
        else:
            self.status = self.STATUS_PENDING
            self.completed_at = None
        self.save()

    def __str__(self):
        return f"{self.title}"


class StudySession(models.Model):
    user = models.ForeignKey(StudyUser, on_delete=models.CASCADE, related_name="sessions", null=True, blank=True)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    breaks_taken = models.IntegerField(default=0)
    blinks = models.IntegerField(default=0)
    liters_drank = models.FloatField(default=0.0)
    emotions = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    @property
    def duration(self):
        if self.end_time:
            delta = self.end_time - self.start_time
            return int(delta.total_seconds() / 60)  # Return minutes
        else:
            delta = timezone.now() - self.start_time
            return int(delta.total_seconds() / 60)

    def end(self, end_time=None):
        self.end_time = end_time or timezone.now()
        self.is_active = False
        self.save(update_fields=['end_time', 'is_active'])

    def __str__(self):
        return f"Session {self.id} - {self.start_time.date()}"


class HydrationLog(models.Model):
    user = models.ForeignKey(StudyUser, on_delete=models.CASCADE, related_name="hydration_logs", null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    amount = models.PositiveIntegerField()  # Changed from amount_ml for consistency

    def __str__(self):
        return f"{self.amount} ml @ {self.timestamp.strftime('%H:%M')}"


class Reminder(models.Model):
    TYPE_CHOICES = [
        ('hydration', 'Hydration'),
        ('stretch', 'Stretch'),
        ('eye_break', 'Eye Break'),
        ('nap', 'Nap'),
        ('task', 'Task'),
        ('custom', 'Custom'),
    ]
    STATUS_SENT = 'sent'
    STATUS_SNOOZED = 'snoozed'
    STATUS_COMPLETED = 'completed'
    STATUS_CHOICES = [
        (STATUS_SENT, 'Sent'),
        (STATUS_SNOOZED, 'Snoozed'),
        (STATUS_COMPLETED, 'Completed'),
    ]

    user = models.ForeignKey(StudyUser, on_delete=models.CASCADE, related_name="reminders")
    type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    message = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SENT)
    scheduled_for = models.DateTimeField(null=True, blank=True)

    def mark_completed(self):
        self.status = self.STATUS_COMPLETED
        self.save(update_fields=['status'])

    def __str__(self):
        return f"{self.type} @ {self.scheduled_for or self.timestamp}"


class Posture(models.Model):
    session = models.ForeignKey(StudySession, on_delete=models.CASCADE, related_name="postures", null=True, blank=True)
    status = models.CharField(max_length=50)  # e.g. "good" / "slouching"
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.status} @ {self.timestamp.strftime('%H:%M')}"


class Blink(models.Model):
    session = models.ForeignKey(StudySession, on_delete=models.CASCADE, related_name="blink_events", null=True, blank=True)
    count = models.IntegerField(default=1)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Blink @ {self.timestamp.strftime('%H:%M:%S')}"


class Streak(models.Model):
    user = models.ForeignKey(StudyUser, on_delete=models.CASCADE, related_name="streaks", null=True, blank=True)
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    last_study_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Streak: {self.current_streak} (Best: {self.longest_streak})"


class Insight(models.Model):
    user = models.ForeignKey(StudyUser, on_delete=models.CASCADE, related_name="insights", null=True, blank=True)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Insight: {self.text[:50]}..."