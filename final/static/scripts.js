// Add this to the beginning of your script.js file
// Fix for Django static file loading
function getStaticUrl(path) {
    // This will work with Django's static template tag
    return path;
}

// Global variables
// Global variables
function euclid(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function angleToVertical(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angleRad = Math.atan2(dx, -dy); // -dy = vertical axis
  return Math.abs((angleRad * 180) / Math.PI);
}

// Simple moving average smoother
function smoothed(value, buffer, size = 5) {
  buffer.push(value);
  if (buffer.length > size) buffer.shift();
  return buffer.reduce((a, b) => a + b, 0) / buffer.length;
}

let neckBuf = [];
let torsoBuf = [];

// Thresholds
const NECK_THRESH = 32;
const TORSO_THRESH = 18;
const OFFSET_THRESH = 100;


let eyesClosed = false; // tracks current eye state
const BLINK_THRESHOLD = 0.2; // typical threshold for EAR

let blinkCount = 0;
let slouch = 0, notslouch = 0;
let happy = 0, neutral = 0, sad = 0;

let webcamStream = null;
let timerInterval = null;
let isFullscreenCamera = false;
let currentTimer = {
    minutes: 0,
    seconds: 0,
    totalSeconds: 0,
    isRunning: false,
    isPaused: false,
}
let pose, faceMesh;
if (typeof window.Pose !== 'undefined') {
    pose = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
}
if (typeof window.FaceMesh !== 'undefined') {
    faceMesh = new window.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    faceMesh.onResults(analyzeResults);
}
// DOM elements (will be initialized per page)
let allowCameraBtn, cameraIcon, webcamPreview, webcamText, aiDescription;
let sessionBtn, dropdownMenu, pomodoroOpts, startPomodoroBtn;
let timerModal, closeTimer, fullscreenTimerOption, cameraTimerOption;
let fullscreenTimerOverlay, cameraTimerOverlay, timerWebcam;
let timeLeft, timerLabel, pauseBtn, stopBtn, progressBar;
let overlayTime, overlayLabel, pauseBtnCamera, stopBtnCamera, progressBarCamera;

// Initialize the application
// Initialize the application
function initApp() {
    // Initialize DOM elements based on current page
    initializeDOMElements();
    
    setupNavigation();
    setupTodoList();
    
    // Only setup camera and timer on dashboard page
    if (isDashboardPage()) {
        setupCamera();
        setupPomodoro();
        setupTimerControls();
        createFullscreenCameraModal();
    }
    
    // Setup page-specific functionality
    if (isTasksPage()) {
        setupTasks();
    }

    if (isInsightsPage()) {
        setupInsights();
    }

    if (isLeaderboardPage()) {
        setupLeaderboard();
    }
}




function analyzeResults(results) {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        return;
    }

    const lm = results.multiFaceLandmarks[0];

    const leftEye = [33, 160, 158, 133, 153, 144, 163, 7];
    const rightEye = [263, 387, 385, 362, 380, 373, 390, 249];

    function eyeAspectRatio(eye) {
        const v1 = Math.hypot(lm[eye[1]].x - lm[eye[5]].x, lm[eye[1]].y - lm[eye[5]].y);
        const v2 = Math.hypot(lm[eye[2]].x - lm[eye[4]].x, lm[eye[2]].y - lm[eye[4]].y);
        const h = Math.hypot(lm[eye[0]].x - lm[eye[3]].x, lm[eye[0]].y - lm[eye[3]].y);
        return (v1 + v2) / (2.0 * h);
    }

    const leftEAR = eyeAspectRatio(leftEye);
    const rightEAR = eyeAspectRatio(rightEye);

    const avgEAR = (leftEAR + rightEAR) / 2;

    // Blink detection logic
    if (avgEAR < BLINK_THRESHOLD) {
        // Eyes are closed
        eyesClosed = true;
    } else if (avgEAR > BLINK_THRESHOLD && eyesClosed) {
        // Eyes were closed before and now opened → count blink
        const blinkEl = document.getElementById("blinkCounter");
        if (blinkEl) {
            blinkCount += 1;
            blinkEl.textContent = parseInt(blinkEl.textContent) + 1;
        }
        eyesClosed = false;

        // Save blink to database
        const csrfToken = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || '';
        fetch('/log_blink/', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
        }).catch(() => {});
    }
    

    
    const leftCorner = lm[61];
    const rightCorner = lm[291];
    const upperLip = lm[13];
    const lowerLip = lm[14];

    // Horizontal and vertical distances
    const horizontal = Math.hypot(rightCorner.x - leftCorner.x, rightCorner.y - leftCorner.y);
    const vertical = Math.hypot(upperLip.x - lowerLip.x, upperLip.y - lowerLip.y);

    // Mouth aspect ratio
    const mar = vertical / horizontal;

    // Mouth corner curvature
    const midMouthY = (upperLip.y + lowerLip.y) / 2;
    const leftDiff = leftCorner.y - midMouthY;
    const rightDiff = rightCorner.y - midMouthY;
    const curvature = (leftDiff + rightDiff) / 2;

    // Eyebrow landmarks
    const leftInner = lm[105];
    const leftOuter = lm[55];
    const rightInner = lm[334];
    const rightOuter = lm[285];

    // Eyebrow angles
    const leftAngle = Math.atan2(leftOuter.y - leftInner.y, leftOuter.x - leftInner.x) * 180 / Math.PI;
    const rightAngle = Math.atan2(rightOuter.y - rightInner.y, rightOuter.x - rightInner.x) * 180 / Math.PI;
    const browAngle = (leftAngle + rightAngle) / 2;
    
    // Mood heuristics thresholds
    let moodd = "Neutral 😐";
        neutral+=1;
    if (curvature < -0.01 && mar < 0.35) {
        moodd = "Happy 😄";
        happy +=1;
    } else if (curvature > 0.02 && mar > 0.4) {
        moodd = "Sad 😢";
        sad+=1;
        
    }


    console.log('Mood:', moodd);

}
    setInterval(() => {
    blinkCount = 0;
    happy = 0;
    sad = 0;
    neutral = 0;
    slouch = 0;
    notslouch = 0;
}, 10000);
// Check which page we're on
function isDashboardPage() {
    return window.location.pathname === '/' || window.location.pathname.includes('dashboard');
}

function isTasksPage() {
    return window.location.pathname.includes('tasks');
}

function isLeaderboardPage() {
    return window.location.pathname.includes('leaderboard');
}

function isInsightsPage() {
    return window.location.pathname.includes('insights');
}

// Initialize DOM elements safely
function initializeDOMElements() {
    // Camera elements (dashboard only)
    allowCameraBtn = document.querySelector('.allow-camera-btn');
    cameraIcon = document.getElementById('cameraIcon');
    webcamPreview = document.getElementById('webcamPreview');
    webcamText = document.querySelector('.webcam-text');
    aiDescription = document.querySelector('.ai-description');
    
    // Timer elements (dashboard only)
    sessionBtn = document.getElementById('startSessionBtn');
    dropdownMenu = document.getElementById('pomodoroDropdown');
    pomodoroOpts = document.querySelectorAll('.pomodoro-option');
    startPomodoroBtn = document.getElementById('startPomodoroBtn');
    
    // Timer modal elements
    timerModal = document.getElementById('timerModal');
    closeTimer = document.getElementById('closeTimer');
    fullscreenTimerOption = document.getElementById('fullscreenTimer');
    cameraTimerOption = document.getElementById('cameraTimer');
    
    // Timer overlay elements
    fullscreenTimerOverlay = document.getElementById('fullscreenTimerOverlay');
    cameraTimerOverlay = document.getElementById('cameraTimerOverlay');
    timerWebcam = document.getElementById('timerWebcam');
    
    // Timer control elements
    timeLeft = document.getElementById('timeLeft');
    timerLabel = document.getElementById('timerLabel');
    pauseBtn = document.getElementById('pauseBtn');
    stopBtn = document.getElementById('stopBtn');
    progressBar = document.getElementById('progressBar');
    
    overlayTime = document.getElementById('overlayTime');
    overlayLabel = document.getElementById('overlayLabel');
    pauseBtnCamera = document.getElementById('pauseBtnCamera');
    stopBtnCamera = document.getElementById('stopBtnCamera');
    progressBarCamera = document.getElementById('progressBarCamera');

}


// Set up navigation functionality
function setupNavigation() {

    // This will be handled by navigation.js
}




if (pose) {
  pose.onResults(function(results) {
    if (!results.poseLandmarks) return;
    const lm = results.poseLandmarks;

    const W = webcamPreview ? webcamPreview.videoWidth : 0;
    const H = webcamPreview ? webcamPreview.videoHeight : 0;

    const L_SH = lm[11], R_SH = lm[12];
    const shoulderMid = [(L_SH.x + R_SH.x) / 2 * W, (L_SH.y + R_SH.y) / 2 * H];

    const L_EAR = lm[7], R_EAR = lm[8];
    const earMid = [(L_EAR.x + R_EAR.x) / 2 * W, (L_EAR.y + R_EAR.y) / 2 * H];

    const dx = earMid[0] - shoulderMid[0];
    const dy = shoulderMid[1] - earMid[1];
    const forwardRatio = dx / dy;

    const FORWARD_THRESH = 0.03;
    let postureLabel = "Good ✅";
    if (forwardRatio > FORWARD_THRESH || forwardRatio < -FORWARD_THRESH) {
      postureLabel = "Slouching 😴";
      slouch += 1;
    } else {
      notslouch += 1;
    }

    const aiDescriptionEl = document.getElementById("aiDescription");
    if (aiDescriptionEl) {
      aiDescriptionEl.textContent = `Posture: ${postureLabel} (Forward ratio: ${forwardRatio.toFixed(2)})`;
    }
  });
}



function createFullscreenCameraModal() {
    // Only create if it doesn't exist
    if (document.getElementById('fullscreenCameraModal')) return;
    
    const fullscreenCameraModal = document.createElement('div');
    fullscreenCameraModal.id = 'fullscreenCameraModal';
    fullscreenCameraModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.9);
        z-index: 3000;
        display: none;
        align-items: center;
        justify-content: center;
    `;
    
    const fullscreenCameraContainer = document.createElement('div');
    fullscreenCameraContainer.style.cssText = `
        position: relative;
        width: 90%;
        height: 90%;
        max-width: 1200px;
        max-height: 800px;
    `;
    
    const fullscreenVideo = document.createElement('video');
    fullscreenVideo.id = 'fullscreenCameraVideo';
    fullscreenVideo.autoplay = true;
    fullscreenVideo.muted = true;
    fullscreenVideo.playsInline = true;
    fullscreenVideo.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 12px;
    `;
    
    const closeFullscreenBtn = document.createElement('button');
    closeFullscreenBtn.innerHTML = '×';
    closeFullscreenBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 30px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(10px);
    `;
    
    fullscreenCameraContainer.appendChild(fullscreenVideo);
    fullscreenCameraContainer.appendChild(closeFullscreenBtn);
    fullscreenCameraModal.appendChild(fullscreenCameraContainer);
    document.body.appendChild(fullscreenCameraModal);
    
    // Close fullscreen camera when clicking close button or outside
    closeFullscreenBtn.addEventListener('click', closeFullscreenCamera);
    fullscreenCameraModal.addEventListener('click', function(e) {
        if (e.target === fullscreenCameraModal) {
            closeFullscreenCamera();
        }
    });
    
    // ESC key to close fullscreen
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isFullscreenCamera) {
            closeFullscreenCamera();
        }
    });
}

// Open fullscreen camera view
function openFullscreenCamera() {
    if (!webcamStream) {
        alert('Please enable camera access first!');
        return;
    }
    
    const fullscreenCameraModal = document.getElementById('fullscreenCameraModal');
    const fullscreenVideo = document.getElementById('fullscreenCameraVideo');
    
    if (fullscreenCameraModal && fullscreenVideo) {
        fullscreenVideo.srcObject = webcamStream;
        fullscreenCameraModal.style.display = 'flex';
        isFullscreenCamera = true;
    }
}

// Close fullscreen camera view
function closeFullscreenCamera() {
    const fullscreenCameraModal = document.getElementById('fullscreenCameraModal');
    if (fullscreenCameraModal) {
        fullscreenCameraModal.style.display = 'none';
        isFullscreenCamera = false;
    }
}

// Set up todo list functionality
// Set up todo list functionality
function setupTodoList() {
    const todoCheckboxes = document.querySelectorAll('.todo-checkbox');
    
    // Set up initial states for any pre-checked items
    todoCheckboxes.forEach(function(checkbox) {
        if (checkbox.checked) {
            const todoText = checkbox.nextElementSibling;
            if (todoText) {
                todoText.style.textDecoration = 'line-through';
                todoText.style.color = '#9ca3af';
            }
        }
        
        // Add change listener
        checkbox.addEventListener('change', function() {
            const todoText = this.nextElementSibling;
            if (todoText) {
                if (this.checked) {
                    todoText.style.textDecoration = 'line-through';
                    todoText.style.color = '#9ca3af';
                } else {
                    todoText.style.textDecoration = 'none';
                    todoText.style.color = '#374151';
                }
            }
        });
    });
}

// Set up camera functionality
function setupCamera() {
    if (allowCameraBtn) {
        allowCameraBtn.addEventListener('click', async function() {
            try {
                // Request webcam access
                webcamStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 640, height: 480 }, 
                    audio: false 
                });
               

                
                // Hide camera icon and button, show video
                if (cameraIcon) cameraIcon.style.display = 'none';
                if (webcamPreview) {
                    webcamPreview.style.display = 'block';
                    webcamPreview.srcObject = webcamStream;
                }
                if (allowCameraBtn) allowCameraBtn.style.display = 'none';
                
                // Remove the CSS transform to fix inverted camera
                if (webcamPreview) webcamPreview.style.transform = 'none';
                
                // Update text and AI description
                if (webcamText) webcamText.textContent = 'Camera active - Analyzing your study habits';
                if (aiDescription) aiDescription.textContent = 'Camera is now active! I can see you\'re ready to study. Your posture looks good and you seem focused. Let\'s start a productive session!';
                
                // Add click event to camera preview for fullscreen
                if (webcamPreview) {
                    webcamPreview.addEventListener('click', openFullscreenCamera);
                    webcamPreview.style.cursor = 'pointer';
                }
                  webcamPreview.onloadeddata = () => {
                    // Run every 200ms
                    setInterval(async () => {
                        try {
                            // Face detections
                            await faceMesh.send({ image: webcamPreview });
                               
                                } catch (err) {
                                    console.error('Error processing frame:', err);
                                }
                            }, 100);
                     setInterval(async () => {
                        try {
                            // Posture detections
                            await pose.send({ image: webcamPreview });
                               
                                } catch (err) {
                                    console.error('Error processing frame:', err);
                                }
                            }, 1000);
                        };
                
            
            
                
            } catch (error) {
                console.error('Error accessing webcam:', error);
                alert('Could not access camera. Please make sure you have given permission and no other application is using the camera.');
            }
        });
    }
}

// Set up pomodoro functionality
function setupPomodoro() {
    // Toggle dropdown when clicking start session button
    if (sessionBtn) {
        sessionBtn.addEventListener('click', function() {
            if (dropdownMenu) dropdownMenu.classList.toggle('show');
        });
    }
    
    // Close dropdown if user clicks elsewhere
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.header-buttons')) {
            if (dropdownMenu) {
                dropdownMenu.classList.remove('show');
            }
        }
    });
    
    // Handle pomodoro option selection
    if (pomodoroOpts && pomodoroOpts.length > 0) {
        pomodoroOpts.forEach(function(option) {
            option.addEventListener('click', function() {
                // Clear all active states first
                pomodoroOpts.forEach(function(opt) {
                    opt.classList.remove('active');
                });
                // Set this one as active
                this.classList.add('active');
            });
        });
    }
    
    // Start the pomodoro session - show timer mode selection
    if (startPomodoroBtn) {
        startPomodoroBtn.addEventListener('click', function() {
            const activeOption = document.querySelector('.pomodoro-option.active');
            if (activeOption) {
                const studyMins = parseInt(activeOption.getAttribute('data-study'));
                const breakMins = parseInt(activeOption.getAttribute('data-break'));
                
                // Set up timer
                currentTimer.minutes = studyMins;
                currentTimer.totalSeconds = studyMins * 60;
                
                // Hide dropdown and show timer modal
                if (dropdownMenu) dropdownMenu.classList.remove('show');
                if (timerModal) timerModal.style.display = 'block';
            } else {
                alert('Please select a session type first!');
            }
        });
    }
}

// Set up timer controls
function setupTimerControls() {
    // Timer modal controls
    if (closeTimer) {
        closeTimer.addEventListener('click', function() {
            if (timerModal) timerModal.style.display = 'none';
        });
    }
    
    // Fullscreen timer option
    if (fullscreenTimerOption) {
        fullscreenTimerOption.addEventListener('click', function() {
            if (timerModal) timerModal.style.display = 'none';
            startFullscreenTimer();
        });
    }
    
    // Camera timer option
    if (cameraTimerOption) {
        cameraTimerOption.addEventListener('click', async function() {
            if (timerModal) timerModal.style.display = 'none';
            await startCameraTimer();
        });
    }
    
    // Timer control event listeners
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => pauseTimer('fullscreen'));
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', () => stopTimer('fullscreen'));
    }
    
    if (pauseBtnCamera) {
        pauseBtnCamera.addEventListener('click', () => pauseTimer('camera'));
    }
    
    if (stopBtnCamera) {
        stopBtnCamera.addEventListener('click', () => stopTimer('camera'));
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', function(e) {
        if (timerModal && e.target === timerModal) {
            timerModal.style.display = 'none';
        }
    });
    
    // Keyboard shortcuts for timer
    document.addEventListener('keydown', function(e) {
        if (currentTimer.isRunning) {
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    if (fullscreenTimerOverlay && fullscreenTimerOverlay.style.display === 'block') {
                        pauseTimer('fullscreen');
                    } else if (cameraTimerOverlay && cameraTimerOverlay.style.display === 'block') {
                        pauseTimer('camera');
                    }
                    break;
                case 'Escape':
                    if (fullscreenTimerOverlay && fullscreenTimerOverlay.style.display === 'block') {
                        stopTimer('fullscreen');
                    } else if (cameraTimerOverlay && cameraTimerOverlay.style.display === 'block') {
                        stopTimer('camera');
                    }
                    break;
            }
        }
    });
}
// Timer functions
function startFullscreenTimer() {
    if (fullscreenTimerOverlay) {
        fullscreenTimerOverlay.style.display = 'flex';
        initializeTimer('fullscreen');
    }
}

async function startCameraTimer() {
    try {
        // If we don't have webcam access, request it
        if (!webcamStream) {
            webcamStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 1280, height: 720 }, 
                audio: false 
            });
        }
        
        if (timerWebcam) {
            timerWebcam.srcObject = webcamStream;
            // Remove the CSS transform to fix inverted camera in timer view
            timerWebcam.style.transform = 'none';
        }
        if (cameraTimerOverlay) {
            cameraTimerOverlay.style.display = 'block';
        }
        initializeTimer('camera');
    } catch (error) {
        console.error('Error accessing webcam for timer:', error);
        alert('Could not access camera for timer view. Using fullscreen timer instead.');
        startFullscreenTimer();
    }
}

function initializeTimer(mode) {
    currentTimer.seconds = currentTimer.totalSeconds;
    currentTimer.isRunning = true;
    currentTimer.isPaused = false;
    
    updateTimerDisplay(mode);
    
    timerInterval = setInterval(function() {
        if (!currentTimer.isPaused && currentTimer.isRunning) {
            currentTimer.seconds--;
            updateTimerDisplay(mode);
            
            if (currentTimer.seconds <= 0) {
                finishTimer(mode);
            }
        }
    }, 1000);
}

function updateTimerDisplay(mode) {
    const minutes = Math.floor(currentTimer.seconds / 60);
    const seconds = currentTimer.seconds % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const progress = ((currentTimer.totalSeconds - currentTimer.seconds) / currentTimer.totalSeconds) * 100;
    
    if (mode === 'fullscreen') {
        if (timeLeft) timeLeft.textContent = timeString;
        if (timerLabel) timerLabel.textContent = 'Study Session';
        if (progressBar) progressBar.style.width = progress + '%';
    } else {
        if (overlayTime) overlayTime.textContent = timeString;
        if (overlayLabel) overlayLabel.textContent = 'Study Session';
        if (progressBarCamera) progressBarCamera.style.width = progress + '%';
    }
}

function pauseTimer(mode) {
    currentTimer.isPaused = !currentTimer.isPaused;
    const pauseButton = mode === 'fullscreen' ? pauseBtn : pauseBtnCamera;
    
    if (pauseButton) {
        pauseButton.textContent = currentTimer.isPaused ? '▶️ Resume' : '⏸️ Pause';
    }
}

function stopTimer(mode) {
    clearInterval(timerInterval);
    currentTimer.isRunning = false;
    currentTimer.isPaused = false;
    
    if (mode === 'fullscreen' && fullscreenTimerOverlay) {
        fullscreenTimerOverlay.style.display = 'none';
    } else if (mode === 'camera' && cameraTimerOverlay) {
        cameraTimerOverlay.style.display = 'none';
    }
    
    alert('Timer stopped! Great work on your study session.');
}

function finishTimer(mode) {
    clearInterval(timerInterval);
    currentTimer.isRunning = false;
    
    if (mode === 'fullscreen' && fullscreenTimerOverlay) {
        fullscreenTimerOverlay.style.display = 'none';
    } else if (mode === 'camera' && cameraTimerOverlay) {
        cameraTimerOverlay.style.display = 'none';
    }
    
    alert('🎉 Study session completed! Time for a well-deserved break.');
}

// Clean up webcam when page unloads
window.addEventListener('beforeunload', function() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
    }
});

// Initialize tasks functionality
// Initialize tasks functionality
function setupTasks() {
    const taskCheckboxes = document.querySelectorAll('.task-checkbox');
    
    taskCheckboxes.forEach(function(checkbox) {
        // Set initial state
        updateTaskItemState(checkbox);
        
        // Add change listener
        checkbox.addEventListener('change', function() {
            updateTaskItemState(this);
        });
    });
    
    // Setup filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            // Filter functionality would go here
        });
    });
    
    // Setup add task modal
    const addTaskBtn = document.getElementById('addTaskBtn');
    const addTaskModal = document.getElementById('addTaskModal');
    const closeAddTask = document.getElementById('closeAddTask');
    const cancelTask = document.getElementById('cancelTask');
    
    if (addTaskBtn && addTaskModal) {
        addTaskBtn.addEventListener('click', function() {
            addTaskModal.style.display = 'block';
        });
        
        if (closeAddTask) {
            closeAddTask.addEventListener('click', function() {
                addTaskModal.style.display = 'none';
            });
        }
        
        if (cancelTask) {
            cancelTask.addEventListener('click', function() {
                addTaskModal.style.display = 'none';
            });
        }
        
        // Close modal when clicking outside
        window.addEventListener('click', function(e) {
            if (e.target === addTaskModal) {
                addTaskModal.style.display = 'none';
            }
        });
    }
}

function updateTaskItemState(checkbox) {
    const taskItem = checkbox.closest('.task-item');
    if (!taskItem) return;
    
    if (checkbox.checked) {
        taskItem.classList.add('completed');
    } else {
        taskItem.classList.remove('completed');
    }
}

// Initialize leaderboard functionality
function setupLeaderboard() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            // Filter functionality would go here
        });
    });
}

// Initialize insights functionality
function setupInsights() {
    const generateReportBtn = document.getElementById('generateReportBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateReport);
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettings);
    }
}

async function generateReport() {
    try {
        const response = await fetch('/api/insights/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || ''
            }
        });

        const insights = await response.json();
        if (insights && insights.results && insights.results.length > 0) {
            const reportData = insights.results.map(insight => ({
                title: insight.title || 'Insight',
                description: insight.description || 'No description',
                created_at: insight.created_at || new Date().toISOString()
            }));

            downloadReport(reportData);
        } else {
            alert('No insights available to generate report. Keep studying to generate insights!');
        }
    } catch (error) {
        console.error('Error generating report:', error);
        alert('Failed to generate report. Please try again.');
    }
}

function downloadReport(reportData) {
    const timestamp = new Date().toISOString().split('T')[0];
    const reportContent = `
STUDY BUDDY INSIGHTS REPORT
Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}

====================================

${reportData.map((insight, idx) => `
${idx + 1}. ${insight.title}
   ${insight.description}
   Date: ${new Date(insight.created_at).toLocaleString()}
`).join('\n')}

====================================
End of Report
    `.trim();

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(reportContent));
    element.setAttribute('download', `study-buddy-report-${timestamp}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function openSettings() {
    alert('Settings page coming soon! Here you can customize:\n- Report format (PDF, CSV, TXT)\n- Data retention period\n- Insight preferences\n- Notification settings');
}

// ── Dark mode ────────────────────────────────────────────────
function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    const label = btn.querySelector('span');
    if (label) label.textContent = dark ? 'Light mode' : 'Dark mode';
    // Lucide replaces <i> with <svg>, so we swap back to a fresh <i> and re-render
    const existing = btn.querySelector('i[data-lucide], svg');
    if (existing) {
        const newIcon = document.createElement('i');
        newIcon.setAttribute('data-lucide', dark ? 'sun' : 'moon');
        btn.insertBefore(newIcon, existing);
        existing.remove();
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function setupDarkMode() {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    const isDark = localStorage.getItem('theme') === 'dark';
    applyTheme(isDark);
    btn.addEventListener('click', function () {
        const nowDark = document.documentElement.getAttribute('data-theme') !== 'dark';
        localStorage.setItem('theme', nowDark ? 'dark' : 'light');
        applyTheme(nowDark);
    });
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize once
    if (typeof initApp === 'function') {
        initApp();
    }
    setupDarkMode();
});

document.getElementById('testCoach')?.addEventListener('click', async () => {
  const resp = await fetch('/api/coach/', {
    method: 'POST',
    headers: {'Content-Type':'application/json','X-CSRFToken': (document.cookie.match(/csrftoken=([^;]+)/)||[])[1]||''},
    body: JSON.stringify({blinkRate:blinkCount, slouch:slouch, notslouch:notslouch, happy:happy, neutral:neutral, sad:sad})
  });
  const data = await resp.json();
  document.getElementById('coachOut').textContent = JSON.stringify(data, null, 2);
});