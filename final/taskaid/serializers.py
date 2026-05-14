from rest_framework import serializers
from .models import StudyUser, Task, StudySession, HydrationLog, Reminder, Posture, Blink, Streak, Insight

class StudyUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyUser
        fields = ['id', 'name', 'email', 'age', 'gender', 'streak', 'tasks_done_total']

class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ['id', 'user', 'title', 'description', 'deadline', 'status', 'completed', 'created_at', 'updated_at', 'completed_at']

class StudySessionSerializer(serializers.ModelSerializer):
    duration = serializers.ReadOnlyField()
    
    class Meta:
        model = StudySession
        fields = ['id', 'user', 'start_time', 'end_time', 'duration', 'breaks_taken', 'blinks', 'liters_drank', 'emotions', 'is_active']

class HydrationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = HydrationLog
        fields = ['id', 'user', 'timestamp', 'amount']

class ReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reminder
        fields = ['id', 'user', 'type', 'message', 'timestamp', 'status', 'scheduled_for']

class PostureLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = Posture
        fields = ['id', 'session', 'status', 'timestamp']

class BlinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Blink
        fields = ['id', 'session', 'count', 'timestamp']

class StreakSerializer(serializers.ModelSerializer):
    class Meta:
        model = Streak
        fields = ['id', 'user', 'current_streak', 'longest_streak', 'last_study_date']

class InsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = Insight
        fields = ['id', 'user', 'text', 'created_at']