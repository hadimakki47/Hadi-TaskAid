from django.contrib import admin
from .models import StudyUser, Task, StudySession, HydrationLog, Reminder, Posture, Blink, Streak, Insight

@admin.register(StudyUser)
class StudyUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'email', 'age', 'streak', 'tasks_done_total')
    search_fields = ('name', 'email')

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'user', 'status', 'completed', 'deadline', 'created_at')
    list_filter = ('status', 'completed')
    search_fields = ('title', 'description', 'user__name')

@admin.register(StudySession)
class StudySessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'start_time', 'end_time', 'duration', 'is_active', 'breaks_taken', 'blinks', 'liters_drank')
    list_filter = ('is_active',)

@admin.register(HydrationLog)
class HydrationLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'amount', 'timestamp')
    search_fields = ('user__name',)
    list_filter = ('timestamp',)

@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'type', 'status', 'scheduled_for', 'timestamp')
    list_filter = ('type', 'status')

@admin.register(Posture)
class PostureAdmin(admin.ModelAdmin):
    list_display = ('id', 'session', 'status', 'timestamp')
    list_filter = ('status', 'timestamp')

@admin.register(Blink)
class BlinkAdmin(admin.ModelAdmin):
    list_display = ('id', 'session', 'count', 'timestamp')
    list_filter = ('timestamp',)

@admin.register(Streak)
class StreakAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'current_streak', 'longest_streak', 'last_study_date')

@admin.register(Insight)
class InsightAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'text_preview', 'created_at')
    list_filter = ('created_at',)
    
    def text_preview(self, obj):
        return obj.text[:50] + "..." if len(obj.text) > 50 else obj.text
    text_preview.short_description = 'Preview'