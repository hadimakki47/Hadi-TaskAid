from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StudyUserViewSet, TaskViewSet, StudySessionViewSet, HydrationLogViewSet, 
    ReminderViewSet, PostureLogViewSet, BlinkViewSet, StreakViewSet, InsightViewSet,
    dashboard, tasks_page, add_task, insights, tasks, leaderboard,
    add_task_ajax, toggle_task, delete_task, set_task_status, start_session, end_session,
    log_hydration, log_posture, log_blink, coach_view
)

router = DefaultRouter()
router.register(r'users', StudyUserViewSet, basename='studyuser')
router.register(r'api/tasks', TaskViewSet, basename='task')
router.register(r'api/sessions', StudySessionViewSet, basename='session')
router.register(r'api/hydration', HydrationLogViewSet, basename='hydration')
router.register(r'api/reminders', ReminderViewSet, basename='reminder')
router.register(r'api/postures', PostureLogViewSet, basename='posture')
router.register(r'api/blinks', BlinkViewSet, basename='blink')
router.register(r'api/streaks', StreakViewSet, basename='streak')
router.register(r'api/insights', InsightViewSet, basename='insight')

urlpatterns = [
    # Main pages
    path('', dashboard, name='dashboard'),
    path('tasks/', tasks_page, name='tasks_page'),
    path('add-task/', add_task, name='add_task'),
    path('insights/', insights, name='insights'),
    path('leaderboard/', leaderboard, name='leaderboard'),
    path("api/coach/", coach_view, name="coach"),
    # AJAX endpoints
    path('add_task/', add_task_ajax, name='add_task_ajax'),
    path('toggle_task/', toggle_task, name='toggle_task'),
    path('delete_task/', delete_task, name='delete_task'),
    path('set_task_status/', set_task_status, name='set_task_status'),
    path('start_session/', start_session, name='start_session'),
    path('end_session/', end_session, name='end_session'),
    path('log_hydration/', log_hydration, name='log_hydration'),
    path('log_posture/', log_posture, name='log_posture'),
    path('log_blink/', log_blink, name='log_blink'),
    
    # API endpoints
    path('api/', include(router.urls)),
]