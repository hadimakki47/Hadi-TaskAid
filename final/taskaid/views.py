from rest_framework import viewsets, filters
from .models import StudyUser, Task, StudySession, HydrationLog, Reminder, Posture, Blink, Streak, Insight
from .serializers import (
    StudyUserSerializer, TaskSerializer, StudySessionSerializer,
    HydrationLogSerializer, ReminderSerializer, PostureLogSerializer, BlinkSerializer, StreakSerializer, InsightSerializer
)
from django.http import JsonResponse
from django.conf import settings
import traceback
from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from datetime import datetime, date, timedelta
from django.db.models import Sum, Count, Q
import json
import pytz
from google import genai
from google.genai import types
def get_user_timezone():
    """Get user timezone - you can make this dynamic based on user preferences later"""
    return pytz.timezone('Asia/Beirut')  # Change to your timezone

def get_today_in_user_tz():
    """Get today's date in user timezone"""
    user_tz = get_user_timezone()
    now_user_tz = timezone.now().astimezone(user_tz)
    return now_user_tz.date()

def dashboard(request):
    # Get all data
    tasks = Task.objects.all().order_by("-created_at")
    sessions = StudySession.objects.all().order_by("-start_time")[:5]
    hydration_logs = HydrationLog.objects.all().order_by("-timestamp")
    
    # Use user timezone for filtering today's data
    today = get_today_in_user_tz()
    
    # Get timezone-aware start and end of today
    user_tz = get_user_timezone()
    today_start = user_tz.localize(datetime.combine(today, datetime.min.time()))
    today_end = user_tz.localize(datetime.combine(today, datetime.max.time()))
    
    blink_logs = Blink.objects.filter(timestamp__range=[today_start, today_end]).order_by("-timestamp")
    posture_logs = Posture.objects.all().order_by("-timestamp")[:10]
    streaks = Streak.objects.all().order_by("-current_streak")
    insights = Insight.objects.all().order_by("-created_at")
    
    # Calculate metrics
    completed_tasks = tasks.filter(completed=True).count()
    total_tasks = tasks.count()
    
    # Calculate total study time (in minutes for today)
    today_sessions = StudySession.objects.filter(start_time__range=[today_start, today_end])
    total_study_time = 0
    for session in today_sessions:
        total_study_time += session.duration
    
    # Calculate hydration (today)
    today_hydration = HydrationLog.objects.filter(timestamp__range=[today_start, today_end]).order_by("-timestamp")
    total_hydration = today_hydration.aggregate(total=Sum('amount'))['total'] or 0
    
    # Get current active session
    current_session = StudySession.objects.filter(is_active=True).first()

    context = {
        "tasks": tasks,
        "sessions": sessions,
        "hydration_logs": today_hydration[:5],
        "blink_logs": blink_logs,
        "posture_logs": posture_logs,
        "streaks": streaks,
        "insights": insights,
        "completed_tasks": completed_tasks,
        "total_tasks": total_tasks,
        "total_study_time": total_study_time,
        "total_hydration": total_hydration,
        "current_session": current_session,
    }
    return render(request, "dashboard.html", context)

def tasks_page(request):
    tasks = Task.objects.all().order_by("-created_at")
    total_tasks = tasks.count()
    completed_tasks = tasks.filter(completed=True).count()
    in_progress_tasks = tasks.filter(status=Task.STATUS_INPROG).count()
    pending_tasks = tasks.filter(status=Task.STATUS_PENDING, completed=False).count()
    return render(request, "tasks.html", {
        "tasks": tasks,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "in_progress_tasks": in_progress_tasks,
        "pending_tasks": pending_tasks,
    })

def add_task(request):
    if request.method == "POST":
        Task.objects.create(
            title=request.POST.get("title"),
            description=request.POST.get("description"),
            deadline=request.POST.get("deadline") or None
        )
        return redirect("tasks_page")
    return render(request, "add_task.html")

# AJAX Views
@require_POST
@csrf_exempt
def add_task_ajax(request):
    try:
        title = request.POST.get('title')
        description = request.POST.get('description', '')
        deadline_str = request.POST.get('deadline')
        
        deadline = None
        if deadline_str:
            deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
        
        subject = request.POST.get('subject') or None
        task = Task.objects.create(
            title=title,
            description=description,
            deadline=deadline,
            subject=subject,
        )
        
        return JsonResponse({
            'success': True,
            'task_id': task.id,
            'message': 'Task added successfully!'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

@require_POST
@csrf_exempt
def toggle_task(request):
    try:
        task_id = request.POST.get('task_id')
        task = Task.objects.get(id=task_id)
        task.toggle_completion()
        
        return JsonResponse({
            'success': True,
            'completed': task.completed,
            'message': 'Task updated successfully!'
        })
    except Task.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Task not found'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

@require_POST
@csrf_exempt
def delete_task(request):
    try:
        task_id = request.POST.get('task_id')
        task = Task.objects.get(id=task_id)
        task.delete()
        
        return JsonResponse({
            'success': True,
            'message': 'Task deleted successfully!'
        })
    except Task.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Task not found'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

@require_POST
@csrf_exempt
def set_task_status(request):
    try:
        task_id = request.POST.get('task_id')
        new_status = request.POST.get('status')
        valid = [Task.STATUS_PENDING, Task.STATUS_INPROG, Task.STATUS_DONE]
        if new_status not in valid:
            return JsonResponse({'success': False, 'error': 'Invalid status'})
        task = Task.objects.get(id=task_id)
        if new_status == Task.STATUS_DONE:
            task.mark_done()
        else:
            task.status = new_status
            task.completed = False
            task.completed_at = None
            task.save(update_fields=['status', 'completed', 'completed_at', 'updated_at'])
        return JsonResponse({'success': True, 'status': task.status})
    except Task.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Task not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@require_POST
@csrf_exempt
def start_session(request):
    try:
        # Check if there's already an active session
        existing_session = StudySession.objects.filter(is_active=True).first()
        
        if existing_session:
            return JsonResponse({
                'success': True,
                'session_id': existing_session.id,
                'message': 'Session already active!',
                'already_active': True
            })
        
        # Create new session only if none exists
        session = StudySession.objects.create(is_active=True)
        
        return JsonResponse({
            'success': True,
            'session_id': session.id,
            'message': 'Study session started!',
            'already_active': False
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

@require_POST
@csrf_exempt
def end_session(request):
    try:
        session_id = request.POST.get('session_id')
        if session_id:
            session = StudySession.objects.get(id=session_id)
        else:
            session = StudySession.objects.filter(is_active=True).first()
        
        if session:
            session.end()
            return JsonResponse({
                'success': True,
                'duration': session.duration,
                'message': f'Session ended! Duration: {session.duration} minutes'
            })
        else:
            return JsonResponse({
                'success': False,
                'error': 'No active session found'
            })
    except StudySession.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Session not found'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

@require_POST
@csrf_exempt
def log_hydration(request):
    try:
        amount = int(request.POST.get('amount'))
        
        hydration_log = HydrationLog.objects.create(amount=amount)
        
        return JsonResponse({
            'success': True,
            'amount': amount,
            'message': f'Logged {amount}ml of water!'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

@require_POST
@csrf_exempt
def log_posture(request):
    try:
        status = request.POST.get('status')
        
        # Get current active session
        session = StudySession.objects.filter(is_active=True).first()
        
        posture_log = Posture.objects.create(
            session=session,
            status=status
        )
        
        return JsonResponse({
            'success': True,
            'status': status,
            'message': f'Posture logged as: {status}'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

@require_POST
@csrf_exempt
def log_blink(request):
    try:
        session_id = request.POST.get('session_id')
        session = None
        
        if session_id:
            session = StudySession.objects.get(id=session_id)
        else:
            session = StudySession.objects.filter(is_active=True).first()
        
        blink_log = Blink.objects.create(session=session)
        
        return JsonResponse({
            'success': True,
            'message': 'Blink recorded!'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        })

def insights(request):
    user_tz = get_user_timezone()
    today = get_today_in_user_tz()
    week_start = today - timedelta(days=6)
    week_start_dt = user_tz.localize(datetime.combine(week_start, datetime.min.time()))

    # Sessions completed this week
    week_sessions = [s for s in StudySession.objects.filter(start_time__gte=week_start_dt, end_time__isnull=False)]
    total_minutes_week = sum(s.duration for s in week_sessions)
    total_hours_week = round(total_minutes_week / 60, 1)

    # Daily bar chart data (last 7 days)
    days = []
    for i in range(7):
        day = week_start + timedelta(days=i)
        day_start = user_tz.localize(datetime.combine(day, datetime.min.time()))
        day_end   = user_tz.localize(datetime.combine(day, datetime.max.time()))
        day_mins  = sum(s.duration for s in week_sessions if day_start <= s.start_time.astimezone(user_tz) <= day_end)
        days.append({'name': day.strftime('%a'), 'minutes': day_mins, 'hours': round(day_mins / 60, 1)})
    max_day = max(d['minutes'] for d in days) or 1
    for d in days:
        d['pct'] = round(d['minutes'] / max_day * 100)

    # Focus heatmap: Mon–Sun × 4 time slots (6AM–12PM, 12PM–6PM, 6PM–12AM, 12AM–6AM)
    all_sessions = [s for s in StudySession.objects.filter(end_time__isnull=False)]
    heatmap_days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    slot_ranges  = [(6, 12), (12, 18), (18, 24), (0, 6)]
    slot_labels  = ['6 AM – 12 PM', '12 PM – 6 PM', '6 PM – 12 AM', '12 AM – 6 AM']
    heatmap = []
    for day_name in heatmap_days:
        slots = []
        for (sh, eh) in slot_ranges:
            mins = sum(
                s.duration for s in all_sessions
                if s.start_time.astimezone(user_tz).strftime('%a') == day_name
                and sh <= s.start_time.astimezone(user_tz).hour < eh
            )
            slots.append(mins)
        heatmap.append({'day': day_name, 'slots': slots})

    all_vals = [v for row in heatmap for v in row['slots']]
    max_slot  = max(all_vals) or 1
    def intensity(v):
        if v == 0: return ''
        p = v / max_slot
        if p < 0.25: return 'low'
        if p < 0.5:  return 'medium'
        if p < 0.75: return 'high'
        return 'very-high'
    for row in heatmap:
        row['intensities'] = [intensity(v) for v in row['slots']]

    # Peak productivity window
    slot_totals = [sum(row['slots'][i] for row in heatmap) for i in range(4)]
    peak_idx    = slot_totals.index(max(slot_totals)) if any(slot_totals) else 1
    peak_window = slot_labels[peak_idx]

    # Focus score: % of posture readings that are good/excellent
    total_posture = Posture.objects.count()
    good_posture  = Posture.objects.filter(
        Q(status__icontains='good') | Q(status__icontains='excellent')
    ).count()
    focus_score = round(good_posture / total_posture * 100) if total_posture else 0

    # Subject breakdown from tasks
    subject_meta = {
        'math':     {'label': 'Mathematics', 'color': '#4285f4'},
        'science':  {'label': 'Science',     'color': '#34a853'},
        'history':  {'label': 'History',     'color': '#fbbc05'},
        'language': {'label': 'Language Arts','color': '#9c27b0'},
        'other':    {'label': 'Other',        'color': '#9e9e9e'},
    }
    subject_breakdown = []
    for key, meta in subject_meta.items():
        total = Task.objects.filter(subject=key).count()
        if total == 0:
            continue
        done = Task.objects.filter(subject=key, completed=True).count()
        subject_breakdown.append({
            'key':   key,
            'label': meta['label'],
            'color': meta['color'],
            'total': total,
            'done':  done,
            'pct':   round(done / total * 100),
        })

    tasks_done_week = Task.objects.filter(completed=True, completed_at__gte=week_start_dt).count()
    insights_qs = Insight.objects.all().order_by('-created_at')

    return render(request, "insights.html", {
        'insights':          insights_qs,
        'total_hours_week':  total_hours_week,
        'tasks_done_week':   tasks_done_week,
        'focus_score':       focus_score,
        'peak_window':       peak_window if any(slot_totals) else 'No data yet',
        'days':              days,
        'heatmap':           heatmap,
        'subject_breakdown': subject_breakdown,
        'has_data':          total_minutes_week > 0,
    })

def leaderboard(request):
    users = StudyUser.objects.all().order_by('-tasks_done_total')
    return render(request, "leaderboard.html", {"users": users})

def tasks(request):
    tasks = Task.objects.all().order_by('-created_at')
    return render(request, "tasks.html", {"tasks": tasks})

# DRF ViewSets
class StudyUserViewSet(viewsets.ModelViewSet):
    queryset = StudyUser.objects.all().order_by('-tasks_done_total')
    serializer_class = StudyUserSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'email']

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all().order_by('-created_at')
    serializer_class = TaskSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description']

class StudySessionViewSet(viewsets.ModelViewSet):
    queryset = StudySession.objects.all().order_by('-start_time')
    serializer_class = StudySessionSerializer

class HydrationLogViewSet(viewsets.ModelViewSet):
    queryset = HydrationLog.objects.all().order_by('-timestamp')
    serializer_class = HydrationLogSerializer

class ReminderViewSet(viewsets.ModelViewSet):
    queryset = Reminder.objects.all().order_by('-timestamp')
    serializer_class = ReminderSerializer

class PostureLogViewSet(viewsets.ModelViewSet):
    queryset = Posture.objects.all().order_by('-timestamp')
    serializer_class = PostureLogSerializer

class BlinkViewSet(viewsets.ModelViewSet):
    queryset = Blink.objects.all().order_by('-timestamp')
    serializer_class = BlinkSerializer

class StreakViewSet(viewsets.ModelViewSet):
    queryset = Streak.objects.all().order_by('-current_streak')
    serializer_class = StreakSerializer

class InsightViewSet(viewsets.ModelViewSet):
    queryset = Insight.objects.all().order_by('-created_at')
    serializer_class = InsightSerializer

def get_gemini_client():
    key = getattr(settings, "GEMINI_API_KEY", "")
    if not key:
        # Fail clearly instead of crashing with AttributeError
        raise RuntimeError("GEMINI_API_KEY is not set in settings (env/.env).")
    return genai.Client(api_key=key)


@csrf_exempt                  # keep while testing; add CSRF later
@require_POST
def coach_view(request):
    # 1) Parse JSON safely
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError as e:
        return JsonResponse({"error": "invalid_json", "detail": str(e)}, status=400)

    # 2) Quick echo mode to test the route without Gemini
    if payload.get("debug") == "echo":
        return JsonResponse({"ok": True, "echo": payload})

    # 3) Build the prompt
    prompt = f"""
You are StudyBuddy. Summarize and coach based on these frames taken in the last minute the frames are the user mood,posture and how many blinks he made:

Blinks: {payload.get('blinkRate')}
Posture/slouch score (Frames spent in bad posture: {payload.get('slouch')}, Frames spent in good posture: {payload.get('notslouch')})
Mood(Frames shown sad): {payload.get('sad')}, Frames shown neutral: {payload.get('neutral')}, Frames shown happy: {payload.get('happy')}

Return strict JSON with keys: advice (string, 1–2 sentences), priority (1–5), actions (array of short verbs).
"""

    # 4) Call Gemini with robust error handling
    try:
        client = get_gemini_client()
        cfg = types.GenerateContentConfig(response_mime_type="application/json")
        res = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[types.Content(
                role="user",
                parts=[types.Part(text=prompt)]
            )],
            config=cfg
        )

        text = getattr(res, "text", None) or getattr(res, "output_text", "")
        try:
            data = json.loads(text) if text else {}
        except Exception:
            data = {"advice": (text or "").strip()[:400], "priority": 3, "actions": []}
        return JsonResponse(data or {"advice": "", "priority": 3, "actions": []})

    except Exception as e:
        traceback.print_exc()  # full traceback in runserver console
        return JsonResponse({"error": "llm_call_failed", "detail": str(e)[:1000]}, status=502)