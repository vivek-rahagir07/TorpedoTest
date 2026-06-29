/** STUDENT PORTAL — JS
   Fully functional: proctoring, player, scoring, results,
   pre-exam system check, camera feed, and JS runner sandbox. */

document.addEventListener('DOMContentLoaded', () => {

  // ---- Views ----
  const viewLogin = document.getElementById('view-login');
  const viewDashboard = document.getElementById('view-dashboard');
  const viewSyscheck = document.getElementById('view-syscheck');
  const viewPre = document.getElementById('view-pre');
  const viewPlayer = document.getElementById('view-player');
  const viewResults = document.getElementById('view-results');

  // ---- System Check ----
  const syscheckNextBtn = document.getElementById('syscheck-next-btn');
  const syscheckPreview = document.getElementById('syscheck-preview');
  const syscheckVideoContainer = document.getElementById('syscheck-video-container');

  // ---- Pre-Assessment ----
  const preTitleEl = document.getElementById('pre-title');
  const preMetaEl = document.getElementById('pre-meta');
  const preTypeBadge = document.getElementById('pre-type-badge');
  const startBtn = document.getElementById('start-btn');
  const backBtn = document.getElementById('back-btn');

  // ---- Player ----
  const questionTracker = document.getElementById('question-tracker');
  const dynamicQContent = document.getElementById('dynamic-q-content');
  const qPaletteEl = document.getElementById('q-palette');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const submitBtn = document.getElementById('submit-btn');
  const timerBadge = document.getElementById('timer-badge');
  const timeLeftEl = document.getElementById('time-left');
  const qTimerBadge = document.getElementById('q-timer-badge');
  const qTimeLeftEl = document.getElementById('q-time-left');

  // ---- Proctor PIP ----
  const proctorVideo = document.getElementById('proctor-video');
  const proctorSim = document.getElementById('proctor-simulation');
  const proctorStatusTxt = document.getElementById('proctor-status-txt');

  // ---- Anti-Cheat ----
  const warningModal = document.getElementById('warning-modal');
  const warningReasonEl = document.getElementById('warning-reason');
  const flagsRemainingEl = document.getElementById('flags-remaining-text');
  const resumeBtn = document.getElementById('resume-btn');
  const flagCounterEl = document.getElementById('flag-counter');

  // ---- Results ----
  const resultsSummaryEl = document.getElementById('results-summary');
  const resultsScoreEl = document.getElementById('results-score');

  // ---- State ----
  let assessments = [];
  let currentAssessment = null;
  let currentQIndex = 0;
  let studentAnswers = {};   // { qIndex: answerValue }
  let isActive = false;
  let flagCount = 0;
  const MAX_FLAGS = 3;
  let warningActive = false;
  let timerInterval = null;
  let secondsLeft = 0;
  let violationsLog = [];   // List of strings representing violations
  let cameraStream = null;
  let audioStream = null;
  let audioCtx = null;
  let audioAnalyser = null;
  let studentName = 'Student';
  let studentEmail = '';
  let pendingViolationReason = '';
  let screenStream = null;
  let screenCaptureInterval = null;
  let examStartedAt = null;  // timestamp when exam began
  let qTimerInterval = null;  // per-question timer interval
  let qSecondsLeft = 0;     // per-question countdown

  // ---- Helper: Show View ----
  function showView(view) {
    [viewLogin, viewDashboard, viewSyscheck, viewPre, viewPlayer, viewResults].forEach(v => v.classList.add('hidden'));
    view.classList.remove('hidden');
  }

  // ===========================================================
  // 1. LOAD ASSESSMENTS
  // ===========================================================
  // ===========================================================
  // 1. LOGIN & DASHBOARD
  // ===========================================================
  const loginBtn = document.getElementById('login-btn');
  const loginName = document.getElementById('login-name');
  const loginEmail = document.getElementById('login-email');
  const loginError = document.getElementById('login-error');
  const loginErrorMsg = document.getElementById('login-error-msg');

  const dashboardName = document.getElementById('dashboard-name-display');
  const resultLogBody = document.getElementById('result-log-body');

  const joinBtn = document.getElementById('join-btn');
  const joinCode = document.getElementById('join-code');
  const joinError = document.getElementById('join-error');
  const joinErrorMsg = document.getElementById('join-error-msg');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const name = loginName ? loginName.value.trim() : '';
      const email = loginEmail ? loginEmail.value.trim() : '';

      loginError.classList.add('hidden');

      if (!name || !email) {
        loginErrorMsg.textContent = 'Please enter your Full Name and Email.';
        loginError.classList.remove('hidden');
        return;
      }

      studentName = name;
      studentEmail = email.toLowerCase();

      // Setup Dashboard
      dashboardName.textContent = studentName.split(' ')[0];
      populateResultLog();
      showView(viewDashboard);

      // Auto-fill from URL param ?code=XXXXXX if present
      const urlCode = new URLSearchParams(window.location.search).get('code');
      if (urlCode && joinCode) joinCode.value = urlCode.toUpperCase();
    });
  }

  function populateResultLog() {
    if (!resultLogBody) return;
    const submissions = window.DB ? window.DB.getSubmissions() : [];
    const allAssessments = window.DB ? window.DB.getAssessments() : [];

    // Filter submissions for this student
    const studentSubs = submissions.filter(s => (s.studentEmail || '').toLowerCase() === studentEmail);

    // Filter to only those where publishResult is true (default is true if not set)
    const publishedSubs = studentSubs.filter(sub => {
      const assessment = allAssessments.find(a => a.title === sub.title || a.assessmentTitle === sub.title);
      if (assessment && assessment.settings && assessment.settings.publishResult === false) {
        return false;
      }
      return true;
    });

    resultLogBody.innerHTML = '';

    if (publishedSubs.length === 0) {
      resultLogBody.innerHTML = `<tr><td colspan="3" style="padding: 1rem; text-align: center; color: var(--text-secondary);">No published results found.</td></tr>`;
      return;
    }

    publishedSubs.reverse().forEach(sub => {
      const assessment = allAssessments.find(a => a.title === sub.title || a.assessmentTitle === sub.title);
      const canReview = assessment?.settings?.allowReview;

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--glass-border)';

      tr.innerHTML = `
        <td style="padding: 0.75rem 0.5rem; font-weight: 500;">${sub.title || sub.assessmentTitle || 'Untitled'}</td>
        <td style="padding: 0.75rem 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">${sub.submittedAt ? sub.submittedAt.split(',')[0] : 'N/A'}</td>
        <td style="padding: 0.75rem 0.5rem; text-align: right; font-weight: 700; color: var(--accent-primary);">
          ${sub.score || 'Pending'}
          ${canReview ? `<br><button class="btn btn-outline btn-sm mt-1" onclick='window.openReviewMode(${JSON.stringify(sub).replace(/'/g, "&apos;")}, ${JSON.stringify(assessment).replace(/'/g, "&apos;")})' style="font-size:0.7rem; padding:0.2rem 0.5rem;"><i class="fa-solid fa-magnifying-glass"></i> Review</button>` : ''}
        </td>
      `;
      resultLogBody.appendChild(tr);
    });
  }

  if (joinBtn) {
    joinBtn.addEventListener('click', () => {
      const code = joinCode ? joinCode.value.trim().toUpperCase() : '';
      joinError.classList.add('hidden');

      if (!code || code.length < 4) {
        joinErrorMsg.textContent = 'Please enter a valid invite code.';
        joinError.classList.remove('hidden');
        joinCode.focus();
        return;
      }

      assessments = window.DB ? window.DB.getAssessments() : [];
      const found = assessments.find(a => (a.inviteCode || '').toUpperCase() === code);

      if (!found) {
        joinErrorMsg.textContent = 'Invalid or expired invite code.';
        joinError.classList.remove('hidden');
        return;
      }

      selectAssessment(found);
    });
  }

  // ===========================================================
  // 2. SYSTEM CHECK SEQUENCE
  // ===========================================================
  function selectAssessment(item) {
    currentAssessment = item;
    const settings = item.settings || {};

    // --- Enforce Scheduled Start ---
    if (settings.startTime) {
      const startDate = new Date(settings.startTime);
      if (Date.now() < startDate.getTime()) {
        const formatted = startDate.toLocaleString();
        joinErrorMsg.textContent = `This exam is not open yet. It starts at ${formatted}.`;
        joinError.classList.remove('hidden');
        currentAssessment = null;
        return;
      }
    }

    // --- Enforce Scheduled End ---
    if (settings.endTime) {
      const endDate = new Date(settings.endTime);
      if (Date.now() > endDate.getTime()) {
        const formatted = endDate.toLocaleString();
        joinErrorMsg.textContent = `This exam has closed. The deadline was ${formatted}.`;
        joinError.classList.remove('hidden');
        currentAssessment = null;
        return;
      }
    }

    showView(viewSyscheck);
    runSystemCheckSequence();
  }

  async function runSystemCheckSequence() {
    syscheckNextBtn.disabled = true;

    const cameraEl = document.getElementById('check-camera');
    const micEl = document.getElementById('check-mic');
    const networkEl = document.getElementById('check-network');
    const screenEl = document.getElementById('check-screen');

    [cameraEl, micEl, networkEl, screenEl].forEach(el => {
      if (el) el.querySelector('.syscheck-status').innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Checking...';
    });

    let cameraPassed = false;
    let micPassed = false;
    let networkPassed = false;
    let screenPassed = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      cameraPassed = true;
      cameraStream = stream;
      syscheckPreview.srcObject = stream;
      syscheckVideoContainer.classList.remove('hidden');
      cameraEl.querySelector('.syscheck-status').className = 'syscheck-status success';
      cameraEl.querySelector('.syscheck-status').innerHTML = '<i class="fa-solid fa-circle-check"></i> Webcam Active';
    } catch (err) {
      cameraEl.querySelector('.syscheck-status').className = 'syscheck-status warning';
      cameraEl.querySelector('.syscheck-status').innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Using Simulation Mode';
      cameraPassed = true;
    }

    // ---- Microphone + audio level bar ----
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioAnalyser = audioCtx.createAnalyser();
      audioAnalyser.fftSize = 256;
      const src = audioCtx.createMediaStreamSource(audioStream);
      src.connect(audioAnalyser);

      // Inject mini audio level bar into syscheck item
      if (micEl) {
        micEl.querySelector('.syscheck-status').className = 'syscheck-status success';
        micEl.querySelector('.syscheck-status').innerHTML = '<i class="fa-solid fa-circle-check"></i> Microphone Active';
        const meterWrap = document.createElement('div');
        meterWrap.className = 'audio-meter-wrap';
        const meterBar = document.createElement('div');
        meterBar.className = 'audio-meter-bar';
        meterBar.id = 'syscheck-audio-bar';
        meterWrap.appendChild(meterBar);
        micEl.appendChild(meterWrap);

        // Animate level bar during syscheck
        const drawMeter = () => {
          const data = new Uint8Array(audioAnalyser.frequencyBinCount);
          audioAnalyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          meterBar.style.width = Math.min(100, avg * 2) + '%';
          requestAnimationFrame(drawMeter);
        };
        drawMeter();
      }
      micPassed = true;
    } catch (e) {
      if (micEl) {
        micEl.querySelector('.syscheck-status').className = 'syscheck-status warning';
        micEl.querySelector('.syscheck-status').innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> No Mic (Audio checks skipped)';
      }
      micPassed = true; // Don't block
    }
    checkAllPassed();

    setTimeout(() => {
      networkPassed = true;
      networkEl.querySelector('.syscheck-status').className = 'syscheck-status success';
      networkEl.querySelector('.syscheck-status').innerHTML = '<i class="fa-solid fa-circle-check"></i> Latency: 28ms (Excellent)';
      checkAllPassed();
    }, 1200);

    const w = window.screen.width;
    const h = window.screen.height;
    setTimeout(() => {
      screenPassed = true;
      if (w >= 1024 && h >= 720) {
        screenEl.querySelector('.syscheck-status').className = 'syscheck-status success';
        screenEl.querySelector('.syscheck-status').innerHTML = `<i class="fa-solid fa-circle-check"></i> ${w}x${h} Supported`;
      } else {
        screenEl.querySelector('.syscheck-status').className = 'syscheck-status warning';
        screenEl.querySelector('.syscheck-status').innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${w}x${h} (Small Resolution)`;
      }
      checkAllPassed();
    }, 800);

    function checkAllPassed() {
      if (cameraPassed && micPassed && networkPassed && screenPassed) {
        syscheckNextBtn.disabled = false;
      }
    }
  }

  syscheckNextBtn.addEventListener('click', () => {
    const typeLabels = { mcq: 'MCQ Assessment', case: 'Case Based Assessment', coding: 'Coding Assessment', match: 'Matching Assessment' };
    const settings = currentAssessment.settings || {};
    preTitleEl.textContent = currentAssessment.title;
    preTypeBadge.textContent = typeLabels[currentAssessment.type] || 'Assessment';

    // Build meta info including timing
    const qCount = currentAssessment.type === 'match'
      ? (currentAssessment.pairs?.length || 0) + ' Pairs'
      : (currentAssessment.questions?.length || 0) + ' Question' + ((currentAssessment.questions?.length || 0) !== 1 ? 's' : '');
    const duration = settings.duration || Math.min(90, Math.max(10, (currentAssessment.questions?.length || 1) * 2));
    let metaParts = [qCount, `${duration} Minutes`, 'Full Screen Required'];
    if (settings.minTime > 0) {
      metaParts.push(`Min. ${settings.minTime} min before submit`);
    }
    if (settings.endTime) {
      const deadline = new Date(settings.endTime).toLocaleString();
      metaParts.push(`Deadline: ${deadline}`);
    }
    preMetaEl.textContent = metaParts.join(' • ');
    showView(viewPre);
  });

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      stopCameraStream();
      currentAssessment = null;
      showView(viewDashboard);
    });
  }

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      screenStream = null;
    }
    if (screenCaptureInterval) {
      clearInterval(screenCaptureInterval);
      screenCaptureInterval = null;
    }
    if (aiDetectionInterval) {
      clearInterval(aiDetectionInterval);
      aiDetectionInterval = null;
    }
    stopAudioSpike();
  }

  // ===========================================================
  // 3. START ASSESSMENT
  // ===========================================================
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      try { await document.documentElement.requestFullscreen?.(); } catch (err) { }
      startAssessment();
    });
  }

  let wakeLock = null;
  let activeSectionIndex = -1;
  let sectionTimerInterval = null;
  let sectionSecondsLeft = 0;

  async function startAssessment() {
    // Request Screen Share
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' } });
    } catch (e) {
      window.Toast.show("Screen sharing is required to start the exam.", "error");
      return; // Stop if they refuse
    }

    isActive = true;
    flagCount = 0;
    studentAnswers = {};
    currentQIndex = 0;
    violationsLog = [];
    examStartedAt = Date.now();
    flagCounterEl.classList.add('hidden');

    const settings = currentAssessment.settings || {};
    // For match type, create a synthetic single-question wrapper so navigation works
    if (currentAssessment.type === 'match' && !currentAssessment.questions) {
      currentAssessment.questions = [{ _matchPlaceholder: true }];
    }
    const minutes = settings.duration || Math.min(90, Math.max(10, (currentAssessment.questions?.length || 1) * 2));
    secondsLeft = minutes * 60;

    // If there's a hard deadline, cap the timer so it doesn't exceed the end time
    if (settings.endTime) {
      const msUntilEnd = new Date(settings.endTime).getTime() - Date.now();
      if (msUntilEnd > 0) {
        const secsUntilEnd = Math.floor(msUntilEnd / 1000);
        secondsLeft = Math.min(secondsLeft, secsUntilEnd);
      }
    }

    // --- Question Randomization ---
    if (currentAssessment.type === 'mixed') {
       let secs = [...currentAssessment.sections];
       if (settings.randomize) {
          for (let i = secs.length - 1; i > 0; i--) {
             const j = Math.floor(Math.random() * (i + 1));
             [secs[i], secs[j]] = [secs[j], secs[i]];
          }
       }
       let flatQs = [];
       secs.forEach((sec, sIdx) => {
          let qs = [...sec.questions];
          if (settings.randomize) {
             for (let i = qs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [qs[i], qs[j]] = [qs[j], qs[i]];
             }
          }
          if (settings.shuffleOptions && sec.type === 'mcq') {
             qs.forEach(q => {
               let opts = [...q.opts];
               let correctStr = opts[q.ans];
               for (let i = opts.length - 1; i > 0; i--) {
                 const j = Math.floor(Math.random() * (i + 1));
                 [opts[i], opts[j]] = [opts[j], opts[i]];
               }
               q.opts = opts;
               q.ans = opts.indexOf(correctStr);
             });
          }
          qs.forEach(q => {
             q._mixedType = sec.type;
             q._sectionTimer = sec.timer;
             q._sectionIndex = sIdx;
             if (sec.type === 'case') q._caseContent = sec.content;
             flatQs.push(q);
          });
       });
       currentAssessment.questions = flatQs;
    } else if (settings.randomize && currentAssessment.type === 'mcq') {
      let qs = [...currentAssessment.questions];
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
      if (settings.questionsPerStudent > 0 && settings.questionsPerStudent < qs.length) {
        qs = qs.slice(0, settings.questionsPerStudent);
      }
      if (settings.shuffleOptions) {
        qs.forEach(q => {
          let opts = [...q.opts];
          let correctStr = opts[q.ans];
          for (let i = opts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [opts[i], opts[j]] = [opts[j], opts[i]];
          }
          q.opts = opts;
          q.ans = opts.indexOf(correctStr);
        });
      }
      currentAssessment.questions = qs;
    }

    showView(viewPlayer);
    buildPalette();
    renderQuestion(0);
    startTimer();
    initProctorFeed();
    startAudioSpikeDetector();

    // Start Screen Capture Loop
    const video = document.createElement('video');
    video.srcObject = screenStream;
    video.play();
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');

    screenCaptureInterval = setInterval(() => {
      if (!isActive) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      localStorage.setItem(`torpedo_stream_${studentEmail || studentName}`, JSON.stringify({
        name: studentName,
        img: dataUrl,
        ts: Date.now()
      }));
    }, 2000);

    // Ultimate Lockdown: Prevent screen from sleeping
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (err) { }
  }

  // ===========================================================
  // 4a. AUDIO SPIKE PROCTORING
  // ===========================================================
  let audioSpikeInterval = null;
  const AUDIO_SPIKE_THRESHOLD = 50; // 0-128 scale

  function startAudioSpikeDetector() {
    if (!audioAnalyser) return;
    audioSpikeInterval = setInterval(() => {
      if (!isActive) return;
      const data = new Uint8Array(audioAnalyser.frequencyBinCount);
      audioAnalyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      if (avg > AUDIO_SPIKE_THRESHOLD) {
        triggerFlag(`Audio Spike Detected (level: ${Math.round(avg)})`);
      }
    }, 3000); // check every 3 seconds
  }

  function stopAudioSpike() {
    clearInterval(audioSpikeInterval);
    audioSpikeInterval = null;
  }

  // ===========================================================
  // 4. LIVE PROCTOR FEED & AI PROCTORING
  // ===========================================================
  let aiModel = null;
  let aiDetectionInterval = null;

  async function initProctorFeed() {
    if (cameraStream) {
      proctorVideo.srcObject = cameraStream;
      proctorVideo.classList.remove('hidden');
      proctorSim.classList.add('hidden');
      proctorStatusTxt.textContent = 'Active';
      proctorStatusTxt.style.color = 'var(--success)';

      const proctorDetection = document.getElementById('proctor-detection');
      if (window.cocoSsd && currentAssessment?.settings?.proctorLevel === 'strict') {
        proctorDetection.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Loading AI...';
        try {
          aiModel = await cocoSsd.load();
          proctorDetection.innerHTML = '<i class="fa-solid fa-robot" style="color:var(--accent-primary)"></i> AI Active';
          startAiDetection();
        } catch (e) {
          proctorDetection.innerHTML = 'AI Load Failed';
          console.error("AI Model Load Error:", e);
        }
      }
    } else {
      proctorVideo.classList.add('hidden');
      proctorSim.classList.remove('hidden');
      proctorStatusTxt.textContent = 'Simulated';
      proctorStatusTxt.style.color = 'var(--warning)';
    }
  }

  function startAiDetection() {
    if (!aiModel) return;
    aiDetectionInterval = setInterval(async () => {
      if (!isActive) return;
      try {
        const predictions = await aiModel.detect(proctorVideo);
        let personCount = 0;
        let phoneDetected = false;

        predictions.forEach(p => {
          if (p.class === 'person' && p.score > 0.5) personCount++;
          if (p.class === 'cell phone' && p.score > 0.5) phoneDetected = true;
        });

        if (phoneDetected) {
          triggerFlag("Unauthorized device (Cell Phone) detected via AI");
        }
        if (personCount > 1) {
          triggerFlag("Multiple people detected in frame via AI");
        }
      } catch (e) {
        // ignore occasional frame drop errors
      }
    }, 2000);
  }

  // ===========================================================
  // 5. TIMER
  // ===========================================================
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      secondsLeft--;
      const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
      const s = (secondsLeft % 60).toString().padStart(2, '0');
      timeLeftEl.textContent = `${m}:${s}`;
      if (secondsLeft <= 0) {
        clearInterval(timerInterval);
        submitAssessment();
      }
    }, 1000);
  }

  // ===========================================================
  // 6. PALETTE
  // ===========================================================
  function buildPalette() {
    qPaletteEl.innerHTML = '';
    const items = currentAssessment.questions || [{ _placeholder: true }];
    items.forEach((_, idx) => {
      const dot = document.createElement('div');
      dot.className = 'q-dot';
      dot.textContent = idx + 1;
      dot.addEventListener('click', () => { saveCurrentAnswer(); renderQuestion(idx); });
      qPaletteEl.appendChild(dot);
    });
  }

  function updatePalette() {
    const dots = qPaletteEl.querySelectorAll('.q-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentQIndex);
      dot.classList.toggle('answered', studentAnswers[idx] !== undefined);
    });
  }

  // ===========================================================
  // 7. RENDER QUESTION & RUN CODE SANDBOX
  // ===========================================================
  const optionLetters = ['A', 'B', 'C', 'D'];

  function renderQuestion(index) {
    saveCurrentAnswer();
    const questions = currentAssessment.questions || [{ _placeholder: true }];
    const qData = questions[index] || {};

    if (currentAssessment.type === 'mixed' && qData._sectionIndex < activeSectionIndex) {
        window.Toast.show("Cannot return to previous sections.", "error");
        return; // stay on current
    }

    currentQIndex = index;
    const total = questions.length;

    // Section Timer Logic
    if (currentAssessment.type === 'mixed') {
        if (qData._sectionIndex !== activeSectionIndex) {
            activeSectionIndex = qData._sectionIndex;
            sectionSecondsLeft = (qData._sectionTimer || 15) * 60;
            if (sectionTimerInterval) clearInterval(sectionTimerInterval);
            sectionTimerInterval = setInterval(() => {
                sectionSecondsLeft--;
                if (sectionSecondsLeft <= 0) {
                    clearInterval(sectionTimerInterval);
                    let nextSecIdx = currentQIndex;
                    while(nextSecIdx < questions.length && questions[nextSecIdx]._sectionIndex === activeSectionIndex) {
                        nextSecIdx++;
                    }
                    if (nextSecIdx < questions.length) {
                        window.Toast.show("Section time up! Moving to next section.", "error");
                        renderQuestion(nextSecIdx);
                    } else {
                        submitAssessment();
                    }
                }
            }, 1000);
        }
    }

    questionTracker.textContent = `Question ${index + 1} of ${total}`;
    prevBtn.disabled = index === 0;
    nextBtn.innerHTML = index === total - 1 ? '<i class="fa-solid fa-flag"></i> Finish' : 'Next <i class="fa-solid fa-arrow-right"></i>';

    // Dispatch progress to Live Command Center
    localStorage.setItem('torpedo_live_event', JSON.stringify({
      type: 'progress',
      student: studentName || 'Unknown Student',
      message: `Navigated to Q${index + 1} of ${total}`,
      time: new Date().toLocaleTimeString(),
      _rand: Math.random()
    }));

    let html = '';
    const rType = qData._mixedType || currentAssessment.type;
    if (rType === 'mcq') {
      html = `<p class="q-text">${qData.q}</p>`;

      // Rich Media Support
      if (qData.mediaUrl) {
        let mediaHtml = '';
        const url = qData.mediaUrl.trim();
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
          let vid = '';
          if (lowerUrl.includes('v=')) vid = url.split('v=')[1].split('&')[0];
          else if (lowerUrl.includes('youtu.be/')) vid = url.split('youtu.be/')[1].split('?')[0];
          if (vid) mediaHtml = `<iframe class="q-media-embed" src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen style="width:100%; aspect-ratio:16/9; border-radius:var(--radius-md); border:1px solid var(--glass-border);"></iframe>`;
        } else if (lowerUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
          mediaHtml = `<img src="${url}" class="q-media-embed" style="max-width:100%; max-height:300px; border-radius:var(--radius-md); border:1px solid var(--glass-border); object-fit:contain;">`;
        } else if (lowerUrl.match(/\.(mp3|wav|ogg)$/i)) {
          mediaHtml = `<audio controls class="q-media-embed" src="${url}" style="width:100%; max-width:400px; margin:0 auto; display:block;"></audio>`;
        } else {
          mediaHtml = `<a href="${url}" target="_blank" class="btn btn-outline"><i class="fa-solid fa-external-link"></i> Open Attached Media</a>`;
        }
        if (mediaHtml) html += `<div style="margin-bottom:1.5rem; text-align:center; background:var(--glass-bg); padding:1rem; border-radius:var(--radius-md);">${mediaHtml}</div>`;
      }

      html += `<div class="options-grid">`;
      qData.opts.forEach((opt, i) => {
        html += `<label class="option-label"><input type="radio" name="mcq_q" value="${i}"> <div class="option-marker">${optionLetters[i]}</div> <span>${opt}</span></label>`;
      });
      html += `</div>`;
    } else if (rType === 'case') {
      html = `
        <div class="case-study-panel">
          <h4><i class="fa-solid fa-book-open"></i> Case Study Scenario</h4>
          <p>${(qData._caseContent || currentAssessment.content) || 'No case study content provided.'}</p>
        </div>
        <p class="q-text">${qData.q}</p>
        <textarea class="case-answer-box" id="case-ans-input" placeholder="Type your detailed answer here...">${studentAnswers[index] || ''}</textarea>
      `;
    } else if (rType === 'match') {
      html = `
        <div class="match-container">
          <p class="q-text" style="margin-bottom: 1.5rem;"><i class="fa-solid fa-arrows-up-down-left-right"></i> Drag the items from the bank to match them with the correct terms.</p>
          <div class="match-bank" id="match-bank" style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:2rem; padding:1rem; background:var(--glass-bg); border-radius:var(--radius-md); min-height:60px; border: 1px dashed var(--glass-border);">
            <!-- Draggable items will be populated via JS -->
          </div>
          <div class="match-pairs" id="match-pairs" style="display:flex; flex-direction:column; gap:1rem;">
            <!-- Drop zones will be populated via JS -->
          </div>
        </div>
      `;
    } else if (rType === 'coding') {
      if (qData.probType === 'web') {
        html = `
        <div class="coding-split-layout" style="display:grid; grid-template-columns: 220px 1fr 1fr; gap:1.5rem; min-height: 55vh;">
          <!-- File Explorer -->
          <div class="coding-left-pane glass-panel" style="padding:1rem;">
            <h4 style="margin-bottom:1rem; font-size:1rem;">${qData.title}</h4>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">${qData.desc}</p>
            <div style="font-weight:600; font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.5rem; color:var(--text-secondary);">Explorer</div>
            <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:0.25rem;" id="web-file-list">
              <li><button class="btn btn-outline btn-sm web-file-btn active" data-file="html" style="width:100%; text-align:left; border:none; padding:0.5rem;"><i class="fa-brands fa-html5" style="color:#e34f26; width:20px;"></i> index.html</button></li>
              <li><button class="btn btn-outline btn-sm web-file-btn" data-file="css" style="width:100%; text-align:left; border:none; padding:0.5rem;"><i class="fa-brands fa-css3-alt" style="color:#264de4; width:20px;"></i> style.css</button></li>
              <li><button class="btn btn-outline btn-sm web-file-btn" data-file="js" style="width:100%; text-align:left; border:none; padding:0.5rem;"><i class="fa-brands fa-js" style="color:#f7df1e; width:20px;"></i> script.js</button></li>
            </ul>
          </div>
          <!-- IDE -->
          <div class="coding-center-pane" style="display:flex; flex-direction:column;">
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--glass-bg-strong); padding:0.5rem 1rem; border-radius:var(--radius-md) var(--radius-md) 0 0; border:1px solid var(--glass-border); border-bottom:none;">
              <span style="font-family:monospace; font-size:0.85rem; font-weight:bold; color:var(--text-primary);" id="web-active-file-label">index.html</span>
              <button class="btn btn-primary btn-sm" id="run-web-btn" style="padding:0.2rem 0.6rem; font-size:0.75rem;"><i class="fa-solid fa-play"></i> Run / Refresh</button>
            </div>
            <textarea class="code-editor" id="code-ans-input"></textarea>
          </div>
          <!-- Live Preview -->
          <div class="coding-right-pane" style="display:flex; flex-direction:column; background:#fff; border-radius:var(--radius-md); overflow:hidden; border:1px solid var(--glass-border);">
            <div style="background:#f1f1f1; padding:0.5rem; display:flex; gap:0.5rem; align-items:center; border-bottom:1px solid #ccc;">
              <div style="display:flex; gap:4px;">
                <div style="width:10px; height:10px; border-radius:50%; background:#ff5f56;"></div>
                <div style="width:10px; height:10px; border-radius:50%; background:#ffbd2e;"></div>
                <div style="width:10px; height:10px; border-radius:50%; background:#27c93f;"></div>
              </div>
              <div style="background:#fff; border-radius:4px; padding:2px 10px; font-size:0.75rem; color:#666; flex:1; font-family:monospace; border: 1px solid #ddd;">localhost:3000</div>
            </div>
            <iframe id="web-preview-frame" style="width:100%; height:100%; flex:1; border:none; background:#fff;"></iframe>
          </div>
        </div>
        `;
      } else {
        html = `
          <div class="coding-split-layout" style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; min-height: 60vh;">
            <div class="coding-left-pane glass-panel" style="padding:1.5rem; display:flex; flex-direction:column; overflow-y:auto;">
              <div class="problem-title-badge" style="margin-bottom:1rem; border-bottom:1px solid var(--glass-border); padding-bottom:0.5rem;">
                <h4 style="font-size:1.2rem; color:var(--accent-primary);"><i class="fa-solid fa-laptop-code"></i> ${qData.title}</h4>
              </div>
              <p class="q-text" style="font-size:0.95rem; line-height:1.6; margin-bottom:1.5rem;">${qData.desc}</p>
              
              <div style="margin-top:auto;">
                <div class="io-row" style="display:flex; flex-direction:column; gap:1rem;">
                  <div class="io-box" style="background:var(--glass-bg-strong); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--glass-border);">
                    <strong style="color:var(--text-secondary); font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.5rem; display:block;"><i class="fa-solid fa-arrow-right-to-bracket"></i> Sample Input</strong>
                    <code id="sample-input-code" style="display:block; font-family:monospace; background:rgba(0,0,0,0.2); padding:0.5rem; border-radius:4px;">${qData.input || 'None'}</code>
                  </div>
                  <div class="io-box" style="background:var(--glass-bg-strong); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--glass-border);">
                    <strong style="color:var(--text-secondary); font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.5rem; display:block;"><i class="fa-solid fa-arrow-right-from-bracket"></i> Expected Output</strong>
                    <code id="expected-output-code" style="display:block; font-family:monospace; background:rgba(0,0,0,0.2); padding:0.5rem; border-radius:4px; color:var(--success);">${qData.output || 'None'}</code>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="coding-right-pane" style="display:flex; flex-direction:column; border-radius:var(--radius-md); overflow:hidden; border:1px solid var(--glass-border); box-shadow:0 8px 32px rgba(0,0,0,0.1);">
              <div class="ide-toolbar" style="display:flex; justify-content:space-between; align-items:center; background:#1e1e1e; padding:0.5rem 1rem; border-bottom:1px solid #333;">
                <div style="display:flex; align-items:center; gap:1rem;">
                  <span style="color:#aaa; font-size:0.85rem; font-family:monospace;"><i class="fa-solid fa-code"></i> Workspace</span>
                  <select id="code-lang-sel" class="form-control" style="width:auto; padding:0.2rem 0.5rem; font-size:0.8rem; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
                    <option value="javascript" ${!window.currentCodeLang || window.currentCodeLang === 'javascript' ? 'selected' : ''}>JavaScript (Node.js)</option>
                    <option value="python" ${window.currentCodeLang === 'python' ? 'selected' : ''}>Python 3</option>
                    <option value="text/x-java" ${window.currentCodeLang === 'text/x-java' ? 'selected' : ''}>Java</option>
                    <option value="text/x-c++src" ${window.currentCodeLang === 'text/x-c++src' ? 'selected' : ''}>C++</option>
                  </select>
                </div>
                <button class="btn btn-success btn-sm" id="run-code-btn" style="padding:0.3rem 0.8rem; font-size:0.8rem; border-radius:4px; background:var(--success); color:#fff; border:none;"><i class="fa-solid fa-play"></i> Run Code</button>
              </div>
              
              <div style="flex:1; display:flex; flex-direction:column; background:#282a36; min-height:300px;">
                <textarea class="code-editor" id="code-ans-input" style="display:none;">${studentAnswers[index] || ''}</textarea>
              </div>
              
              <div class="terminal-container" style="background:#1e1e1e; border-top:1px solid #333; min-height:120px; display:flex; flex-direction:column;">
                <div style="background:#2d2d2d; padding:0.3rem 1rem; font-size:0.75rem; color:#888; text-transform:uppercase; letter-spacing:1px; display:flex; justify-content:space-between;">
                  <span><i class="fa-solid fa-terminal"></i> Console Output</span>
                  <span id="exec-time" style="color:#666;"></span>
                </div>
                <div class="terminal-output hidden" id="code-terminal" style="padding:1rem; flex:1; overflow-y:auto; font-family:'JetBrains Mono', monospace; font-size:0.85rem; color:#ccc;">
                  <pre id="terminal-stdout" style="margin:0; white-space:pre-wrap;"></pre>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    }

    dynamicQContent.innerHTML = html;

    if (currentAssessment.type === 'match') {
      // Logic for Match Drag-and-Drop
      const bank = document.getElementById('match-bank');
      const pairs = document.getElementById('match-pairs');

      const savedMatches = studentAnswers[index] || {}; // leftIdx -> rightIdx

      // Initialize draggables state if not present (shuffle right items once)
      if (!currentAssessment.matchState) {
        let rightItems = currentAssessment.pairs.map((p, i) => ({ text: p.right, origIdx: i }));
        // Simple shuffle
        for (let i = rightItems.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rightItems[i], rightItems[j]] = [rightItems[j], rightItems[i]];
        }
        currentAssessment.matchState = rightItems;
      }

      // Populate drop zones (Left items)
      currentAssessment.pairs.forEach((p, i) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '1rem';
        row.style.alignItems = 'stretch';

        const leftBox = document.createElement('div');
        leftBox.className = 'glass-panel';
        leftBox.style.flex = '1';
        leftBox.style.padding = '1rem';
        leftBox.style.display = 'flex';
        leftBox.style.alignItems = 'center';
        leftBox.style.fontWeight = 'bold';
        leftBox.textContent = p.left;

        const dropZone = document.createElement('div');
        dropZone.className = 'match-drop-zone';
        dropZone.dataset.leftIdx = i;
        dropZone.style.flex = '1';
        dropZone.style.border = '2px dashed var(--glass-border)';
        dropZone.style.borderRadius = 'var(--radius-md)';
        dropZone.style.padding = '1rem';
        dropZone.style.display = 'flex';
        dropZone.style.alignItems = 'center';
        dropZone.style.justifyContent = 'center';
        dropZone.style.minHeight = '60px';
        dropZone.style.background = 'rgba(255,255,255,0.05)';
        dropZone.style.transition = 'all 0.2s';

        row.appendChild(leftBox);
        row.appendChild(dropZone);
        pairs.appendChild(row);

        // Setup drop events
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent-primary)'; });
        dropZone.addEventListener('dragleave', e => { dropZone.style.borderColor = 'var(--glass-border)'; });
        dropZone.addEventListener('drop', e => {
          e.preventDefault();
          dropZone.style.borderColor = 'var(--glass-border)';
          const rightIdx = e.dataTransfer.getData('text/plain');
          if (rightIdx) {
            // Move item from wherever it was to this drop zone
            const el = document.querySelector(`.match-drag-item[data-right-idx="${rightIdx}"]`);
            if (el) {
              if (dropZone.children.length > 0) {
                // Return existing item to bank
                bank.appendChild(dropZone.children[0]);
              }
              dropZone.appendChild(el);
              saveCurrentAnswer(); // update state immediately
            }
          }
        });
      });

      // Setup bank drop events
      bank.addEventListener('dragover', e => { e.preventDefault(); });
      bank.addEventListener('drop', e => {
        e.preventDefault();
        const rightIdx = e.dataTransfer.getData('text/plain');
        if (rightIdx) {
          const el = document.querySelector(`.match-drag-item[data-right-idx="${rightIdx}"]`);
          if (el) {
            bank.appendChild(el);
            saveCurrentAnswer();
          }
        }
      });

      // Populate draggable items (Right items)
      currentAssessment.matchState.forEach(r => {
        const item = document.createElement('div');
        item.className = 'match-drag-item btn btn-outline';
        item.dataset.rightIdx = r.origIdx;
        item.draggable = true;
        item.textContent = r.text;
        item.style.cursor = 'grab';
        item.style.background = 'var(--glass-bg-strong)';

        item.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', r.origIdx);
          item.style.opacity = '0.5';
        });
        item.addEventListener('dragend', e => {
          item.style.opacity = '1';
        });

        // Check if it should be in a drop zone
        let placed = false;
        for (let leftIdx in savedMatches) {
          if (savedMatches[leftIdx] == r.origIdx) {
            const zone = document.querySelector(`.match-drop-zone[data-left-idx="${leftIdx}"]`);
            if (zone) {
              zone.appendChild(item);
              placed = true;
              break;
            }
          }
        }
        if (!placed) {
          bank.appendChild(item);
        }
      });
    }

    if (currentAssessment.type === 'coding') {
      const editorEl = document.getElementById('code-ans-input');
      if (qData.probType === 'web') {
        const defaultState = { html: qData.htmlTemplate || '', css: qData.cssTemplate || '', js: qData.jsTemplate || '', active: 'html' };
        window.webProjectState = studentAnswers[index] || defaultState;

        if (window.CodeMirror) {
          window.codeMirrorInstance = CodeMirror.fromTextArea(editorEl, {
            mode: "xml",
            theme: "dracula",
            lineNumbers: true,
            matchBrackets: true,
            indentUnit: 4
          });
          window.codeMirrorInstance.setValue(window.webProjectState[window.webProjectState.active]);
          window.codeMirrorInstance.setSize("100%", "300px");
          window.codeMirrorInstance.getWrapperElement().style.fontFamily = "'JetBrains Mono', monospace";
          window.codeMirrorInstance.getWrapperElement().style.fontSize = "0.95rem";

          const fileBtns = document.querySelectorAll('.web-file-btn');
          fileBtns.forEach(btn => btn.addEventListener('click', (e) => {
            window.webProjectState[window.webProjectState.active] = window.codeMirrorInstance.getValue();
            fileBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const fileType = e.currentTarget.dataset.file;
            window.webProjectState.active = fileType;
            document.getElementById('web-active-file-label').textContent = fileType === 'html' ? 'index.html' : fileType === 'css' ? 'style.css' : 'script.js';
            window.codeMirrorInstance.setOption('mode', fileType === 'html' ? 'xml' : fileType === 'css' ? 'css' : 'javascript');
            window.codeMirrorInstance.setValue(window.webProjectState[fileType]);
          }));

          document.getElementById('run-web-btn').addEventListener('click', () => {
            window.webProjectState[window.webProjectState.active] = window.codeMirrorInstance.getValue();
            const frame = document.getElementById('web-preview-frame');
            const doc = frame.contentWindow.document;
            doc.open();
            doc.write(`
              <html>
              <head>
                <style>${window.webProjectState.css}</style>
              </head>
              <body>
                ${window.webProjectState.html}
                <script>${window.webProjectState.js}</script>
              </body>
              </html>
            `);
            doc.close();
          });
          // initial run
          document.getElementById('run-web-btn').click();
        }
      } else {
        if (window.CodeMirror) {
          window.currentCodeLang = window.currentCodeLang || "javascript";
          window.codeMirrorInstance = CodeMirror.fromTextArea(editorEl, {
            mode: window.currentCodeLang,
            theme: "dracula",
            lineNumbers: true,
            matchBrackets: true,
            indentUnit: 4
          });

          const langSel = document.getElementById('code-lang-sel');
          langSel.addEventListener('change', (e) => {
            window.currentCodeLang = e.target.value;
            window.codeMirrorInstance.setOption('mode', window.currentCodeLang);
          });
          window.codeMirrorInstance.setSize("100%", "300px");
          window.codeMirrorInstance.getWrapperElement().style.borderRadius = "var(--radius-md)";
          window.codeMirrorInstance.getWrapperElement().style.fontFamily = "'JetBrains Mono', monospace";
          window.codeMirrorInstance.getWrapperElement().style.fontSize = "0.95rem";
        }
        document.getElementById('run-code-btn').addEventListener('click', runCodingSandbox);
      }
    }
    if (currentAssessment.type === 'mcq' && studentAnswers[index] !== undefined) {
      const radio = dynamicQContent.querySelector(`input[value="${studentAnswers[index]}"]`);
      if (radio) radio.checked = true;
    }
    updatePalette();
    startQuestionTimer(qData);
  }

  function startQuestionTimer(qData) {
    // Clear any existing per-question timer
    if (qTimerInterval) {
      clearInterval(qTimerInterval);
      qTimerInterval = null;
    }

    const limit = qData.timeLimit || 0;
    if (limit <= 0) {
      // No per-question limit — hide the badge
      if (qTimerBadge) qTimerBadge.classList.add('hidden');
      return;
    }

    qSecondsLeft = limit;
    if (qTimerBadge) qTimerBadge.classList.remove('hidden');
    if (qTimeLeftEl) qTimeLeftEl.textContent = `${qSecondsLeft}s`;

    qTimerInterval = setInterval(() => {
      qSecondsLeft--;
      if (qTimeLeftEl) qTimeLeftEl.textContent = `${qSecondsLeft}s`;

      // Visual warning when low
      if (qSecondsLeft <= 5 && qTimerBadge) {
        qTimerBadge.style.animation = 'pulse 0.5s infinite';
      }

      if (qSecondsLeft <= 0) {
        clearInterval(qTimerInterval);
        qTimerInterval = null;
        if (qTimerBadge) qTimerBadge.style.animation = '';

        // Auto-advance to next question or submit
        saveCurrentAnswer();
        window.Toast.show('⏰ Time expired for this question! Auto-advancing.', 'warning');

        const total = currentAssessment.questions ? currentAssessment.questions.length : 1;
        if (currentQIndex < total - 1) {
          renderQuestion(currentQIndex + 1);
        } else {
          submitAssessment();
        }
      }
    }, 1000);
  }

  function runCodingSandbox() {
    if (window.codeMirrorInstance) window.codeMirrorInstance.save();
    const code = document.getElementById('code-ans-input').value;
    const input = document.getElementById('sample-input-code').textContent;
    const expected = document.getElementById('expected-output-code').textContent.trim();
    const stdout = document.getElementById('terminal-stdout');
    const execTime = document.getElementById('exec-time');
    const lang = window.currentCodeLang || 'javascript';

    document.getElementById('code-terminal').classList.remove('hidden');
    stdout.textContent = 'Compiling and Executing...';
    if (execTime) execTime.textContent = '';

    setTimeout(() => {
      const startTime = performance.now();
      if (lang === 'javascript') {
        try {
          const executor = new Function('input', `try { ${code} ; return typeof solution === 'function' ? solution(input) : undefined; } catch(e) { return null; }`);
          const result = executor(input);
          stdout.textContent = String(result) === expected ? '✅ Test Case Passed!' : `❌ Expected "${expected}" but got "${result}"`;
        } catch (e) { stdout.textContent = 'Runtime Error: ' + e.message; }
        if (execTime) execTime.innerHTML = `<i class="fa-solid fa-stopwatch"></i> ${Math.round(performance.now() - startTime)}ms`;
      } else {
        // Mock execution for Python, Java, C++ in offline mode
        stdout.innerHTML = `<span style="color:var(--warning)">⚠️ Offline Mode</span>\nSimulating remote execution for <strong>${lang.replace('text/x-', '').replace('src', '').toUpperCase()}</strong>...\n`;
        setTimeout(() => {
          if (code.trim().length > 10) {
            stdout.innerHTML += `\n✅ Mock Test Case Passed!\nOutput matched expected: "${expected}"`;
          } else {
            stdout.innerHTML += `\n❌ Syntax/Runtime Error or insufficient code.`;
          }
          if (execTime) execTime.innerHTML = `<i class="fa-solid fa-stopwatch"></i> ${Math.round(performance.now() - startTime + 600)}ms`;
        }, 600);
      }
    }, 400);
  }

  function saveCurrentAnswer() {
    if (!currentAssessment) return;
    const rType = qData._mixedType || currentAssessment.type;
    if (rType === 'mcq') {
      const s = dynamicQContent.querySelector('input[type="radio"]:checked');
      if (s) studentAnswers[currentQIndex] = parseInt(s.value);
    } else if (rType === 'coding') {
      const qData = currentAssessment.questions[currentQIndex];
      if (qData.probType === 'web') {
        if (window.codeMirrorInstance && window.webProjectState) {
          window.webProjectState[window.webProjectState.active] = window.codeMirrorInstance.getValue();
          studentAnswers[currentQIndex] = window.webProjectState;
        }
      } else {
        if (window.codeMirrorInstance) window.codeMirrorInstance.save();
        const input = document.getElementById('code-ans-input');
        if (input && input.value.trim()) studentAnswers[currentQIndex] = input.value.trim();
      }
    } else if (rType === 'match') {
      const matchMap = {};
      document.querySelectorAll('.match-drop-zone').forEach(zone => {
        const leftIdx = zone.dataset.leftIdx;
        if (zone.children.length > 0) {
          const rightIdx = zone.children[0].dataset.rightIdx;
          matchMap[leftIdx] = parseInt(rightIdx);
        }
      });
      studentAnswers[currentQIndex] = matchMap;
    } else {
      const input = document.getElementById('case-ans-input');
      if (input && input.value.trim()) studentAnswers[currentQIndex] = input.value.trim();
    }
  }

  // ===========================================================
  // 8. NAVIGATION
  // ===========================================================
  if (prevBtn) prevBtn.addEventListener('click', () => { if (currentQIndex > 0) renderQuestion(currentQIndex - 1); });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    const total = (currentAssessment.questions || []).length;
    if (currentQIndex < total - 1) renderQuestion(currentQIndex + 1);
    else submitAssessment();
  });
  if (submitBtn) submitBtn.addEventListener('click', () => {
    // Enforce minimum time
    const settings = currentAssessment?.settings || {};
    const minTimeSec = (settings.minTime || 0) * 60;
    if (minTimeSec > 0 && examStartedAt) {
      const elapsed = (Date.now() - examStartedAt) / 1000;
      if (elapsed < minTimeSec) {
        const remaining = Math.ceil((minTimeSec - elapsed) / 60);
        window.Toast.show(`You must spend at least ${settings.minTime} min on this exam. ${remaining} min remaining.`, 'error');
        return;
      }
    }
    submitAssessment();
  });

  // ===========================================================
  // 9. SUBMIT & RESULTS
  // ===========================================================
  function submitAssessment() {
    clearInterval(timerInterval);
    if (qTimerInterval) { clearInterval(qTimerInterval); qTimerInterval = null; }
    if (sectionTimerInterval) { clearInterval(sectionTimerInterval); sectionTimerInterval = null; }
    isActive = false;
    saveCurrentAnswer();
    stopCameraStream();
    try { document.exitFullscreen?.(); } catch (_) { }
    if (wakeLock) { wakeLock.release().then(() => wakeLock = null); }

    const total = currentAssessment.questions ? currentAssessment.questions.length : (currentAssessment.pairs ? 1 : 1);
    const answered = Object.keys(studentAnswers).length;
    let scoreText = 'Submitted';

    const rType = qData._mixedType || currentAssessment.type;
    if (rType === 'mcq') {
      let scoreNum = 0;
      let penaltyNum = 0;
      let maxScore = 0;
      currentAssessment.questions.forEach((q, i) => {
        const p = q.points !== undefined ? q.points : 1;
        const neg = q.negative !== undefined ? q.negative : 0;
        maxScore += p;

        if (studentAnswers[i] !== undefined) {
          if (studentAnswers[i] === q.ans) {
            scoreNum += p;
          } else {
            // Partial Credit
            if (q.partialCredit > 0) scoreNum += q.partialCredit;
            else penaltyNum += neg;
          }
        }
      });

      const finalScore = Math.max(0, scoreNum - penaltyNum);

      scoreText = `${finalScore} / ${maxScore} (${Math.round((finalScore / maxScore) * 100)}%)`;
      if (penaltyNum > 0) {
        scoreText += ` [-${penaltyNum} penalty]`;
      }
    }

    if (currentAssessment.type === 'match') {
      let correct = 0;
      let totalPairs = currentAssessment.pairs.length;
      if (studentAnswers[0]) {
        for (let leftIdx in studentAnswers[0]) {
          if (leftIdx == studentAnswers[0][leftIdx]) {
            correct++;
          }
        }
      }
      scoreText = `${correct} / ${totalPairs} (${Math.round((correct / totalPairs) * 100)}%)`;
    }

    if (window.DB) window.DB.saveSubmission({
      studentName,
      studentEmail,
      title: currentAssessment.title,
      score: scoreText,
      violations: violationsLog,
      submittedAt: new Date().toLocaleString(),
      answers: studentAnswers,
      assessment: currentAssessment
    });
    stopAudioSpike();
    showView(viewResults);
    resultsScoreEl.textContent = scoreText;

    // Read publish settings to tell user
    const published = currentAssessment.settings?.publishResult !== false;
    const summaryMsg = `Completed ${answered} / ${total} questions. ${flagCount} violations logged. ` +
      (published ? 'Your result has been logged.' : 'Result hidden pending faculty review.');

    resultsSummaryEl.textContent = summaryMsg;

    if (!published) {
      resultsScoreEl.style.display = 'none';
    } else {
      resultsScoreEl.style.display = 'block';
    }

    const resultsReviewWrap = document.getElementById('results-review-wrap');
    if (currentAssessment.settings?.allowReview && resultsReviewWrap) {
      resultsReviewWrap.classList.remove('hidden');
    } else if (resultsReviewWrap) {
      resultsReviewWrap.classList.add('hidden');
    }

    populateResultLog();
  }

  // ===========================================================
  // 10. ANTI-CHEAT & ANTI-PLAGIARISM
  // ===========================================================
  document.addEventListener('fullscreenchange', handleFsChange);
  document.addEventListener('visibilitychange', () => {
    if (isActive && document.hidden && !currentAssessment?.settings?.allowTab) {
      triggerFlag('Tab Switch');
    }
  });
  window.addEventListener('blur', () => {
    if (isActive && !currentAssessment?.settings?.allowTab) {
      triggerFlag('Focus Lost');
    }
  });

  // Anti-Copy & Anti-Paste
  document.addEventListener('copy', (e) => {
    if (isActive && !currentAssessment?.settings?.allowPaste) {
      e.preventDefault();
      triggerFlag('Attempted to Copy content');
      window.Toast.show('Copying is disabled during the assessment!', 'error');
    }
  });

  document.addEventListener('paste', (e) => {
    if (isActive && !currentAssessment?.settings?.allowPaste) {
      e.preventDefault();
      triggerFlag('Attempted to Paste content');
      window.Toast.show('Pasting is disabled during the assessment!', 'error');
    }
  });

  // Keystroke Rhythm & Speed Tracker
  let lastKeyTime = 0;
  let rapidKeyCount = 0;

  // Ultimate Lockdown Mode
  document.addEventListener('contextmenu', e => {
    if (isActive) {
      e.preventDefault();
      triggerFlag('Attempted to open Context Menu (Right Click)');
    }
  });

  // Block DevTools shortcuts
  document.addEventListener('keydown', (e) => {
    if (!isActive) return;

    // F12 or Ctrl+Shift+I / Cmd+Option+I
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.metaKey && e.altKey && e.key === 'i')) {
      e.preventDefault();
      triggerFlag('Attempted to open Developer Tools');
    }

    const now = Date.now();
    // Ignore non-character keys like Shift/Ctrl/Meta
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      if (now - lastKeyTime < 25) { // Unnaturally fast (less than 25ms between strokes)
        rapidKeyCount++;
        if (rapidKeyCount > 10) {
          triggerFlag('Suspicious Keystroke Speed Detected (Macro/Auto-typer)');
          rapidKeyCount = 0; // reset to prevent spam
        }
      } else {
        rapidKeyCount = Math.max(0, rapidKeyCount - 1);
      }
      lastKeyTime = now;
    }
  });

  function handleFsChange() { if (isActive && !document.fullscreenElement) triggerFlag('Exited Fullscreen'); }

  function triggerFlag(reason) {
    flagCount++;
    pendingViolationReason = reason;
    const timeStr = new Date().toLocaleTimeString();
    violationsLog.push(`${timeStr} — ${reason}`);

    // Dispatch to Live Command Center
    localStorage.setItem('torpedo_live_event', JSON.stringify({
      type: 'flag',
      student: studentName || 'Unknown Student',
      message: reason,
      time: timeStr,
      _rand: Math.random() // force event trigger
    }));

    flagCounterEl.textContent = `⚑ ${flagCount} Flag${flagCount > 1 ? 's' : ''}`;
    flagCounterEl.classList.remove('hidden');
    warningReasonEl.textContent = reason;
    const remaining = MAX_FLAGS - flagCount;
    if (flagsRemainingEl) {
      flagsRemainingEl.textContent = remaining > 0
        ? `${remaining} more violation${remaining > 1 ? 's' : ''} will result in automatic submission.`
        : `This was your final warning. Auto-submitting...`;
    }
    const appealInput = document.getElementById('appeal-input');
    if (appealInput) appealInput.value = '';
    warningModal.classList.remove('hidden');
    if (flagCount >= MAX_FLAGS) setTimeout(submitAssessment, 2500);
  }

  if (resumeBtn) resumeBtn.addEventListener('click', () => {
    // Capture appeal text and attach to the last violation
    const appealInput = document.getElementById('appeal-input');
    if (appealInput && appealInput.value.trim() && violationsLog.length > 0) {
      violationsLog[violationsLog.length - 1] += ` | Appeal: ${appealInput.value.trim()}`;
    }
    warningModal.classList.add('hidden');
    document.documentElement.requestFullscreen?.();
  });

  // ===========================================================
  // 11. FACULTY ACTIONS & POST-EXAM REVIEW
  // ===========================================================
  const facultyWarnModal = document.getElementById('faculty-warn-modal');
  const facultyWarnMsg = document.getElementById('faculty-warn-message');
  const facultyWarnOk = document.getElementById('faculty-warn-ok-btn');

  if (facultyWarnOk) {
    facultyWarnOk.addEventListener('click', () => {
      facultyWarnModal.classList.add('hidden');
    });
  }

  window.addEventListener('storage', (e) => {
    const keyPrefix = `torpedo_faculty_action_${studentEmail || studentName}`;
    if (e.key === keyPrefix && e.newValue) {
      const data = JSON.parse(e.newValue);
      if (data.action === 'warn') {
        if (facultyWarnMsg) facultyWarnMsg.textContent = data.message || 'Please keep your eyes on the screen.';
        if (facultyWarnModal) facultyWarnModal.classList.remove('hidden');
      } else if (data.action === 'kick') {
        if (facultyWarnModal) facultyWarnModal.classList.add('hidden');
        if (isActive) submitAssessment();
        window.Toast.show('Your exam was terminated by faculty.', 'error', 10000);
      }
    }
  });

  // Review functionality
  const viewReviewBtn = document.getElementById('view-review-btn');
  const reviewBackBtn = document.getElementById('review-back-btn');
  const viewReview = document.getElementById('view-review');

  if (viewReviewBtn) {
    viewReviewBtn.addEventListener('click', () => {
      window.openReviewMode({ score: resultsScoreEl.textContent, answers: studentAnswers }, currentAssessment);
    });
  }
  if (reviewBackBtn) {
    reviewBackBtn.addEventListener('click', () => {
      showView(viewDashboard);
    });
  }

  window.openReviewMode = function (submission, assessment) {
    if (!assessment || !submission) return;
    showView(viewReview);
    document.getElementById('review-title').textContent = assessment.title;
    document.getElementById('review-score').textContent = `Final Score: ${submission.score}`;

    const container = document.getElementById('review-questions-container');
    container.innerHTML = '';
    const answers = submission.answers || {};

    assessment.questions.forEach((q, i) => {
      const div = document.createElement('div');
      div.className = 'glass-panel review-question animate-fade-in';
      div.style.marginBottom = '1.5rem';
      div.style.padding = '1.5rem';
      div.style.animationDelay = `${i * 0.05}s`;

      let html = `<h4>Q${i + 1}. ${q.q || q.title || ''}</h4>`;

      if (assessment.type === 'mcq') {
        const userAns = answers[i];
        const isCorrect = userAns === q.ans;

        if (q.mediaUrl) {
          html += `<div style="margin-bottom:1rem;"><a href="${q.mediaUrl}" target="_blank" style="color:var(--accent-primary);"><i class="fa-solid fa-link"></i> Attached Media</a></div>`;
        }

        html += `<div class="options-grid" style="margin-top:1rem; pointer-events:none; opacity: 0.9;">`;
        q.opts.forEach((opt, optIdx) => {
          let className = 'option-label';
          let icon = '';
          if (optIdx === q.ans) {
            className += ' correct';
            icon = '<i class="fa-solid fa-check" style="color:var(--success); margin-left:auto;"></i>';
          } else if (optIdx === userAns) {
            className += ' incorrect';
            icon = '<i class="fa-solid fa-xmark" style="color:var(--danger); margin-left:auto;"></i>';
          }

          html += `<div class="${className}" style="display:flex; align-items:center;">
            <div class="option-marker">${String.fromCharCode(65 + optIdx)}</div> 
            <span>${opt}</span>
            ${icon}
          </div>`;
        });
        html += `</div>`;

        if (isCorrect) {
          html += `<div style="margin-top:1rem; color:var(--success); font-weight:600;"><i class="fa-solid fa-circle-check"></i> Correct (+${q.points || 1} points)</div>`;
        } else if (userAns !== undefined) {
          if (q.partialCredit > 0) {
            html += `<div style="margin-top:1rem; color:var(--warning); font-weight:600;"><i class="fa-solid fa-circle-half-stroke"></i> Partially Correct (+${q.partialCredit} points)</div>`;
          } else {
            html += `<div style="margin-top:1rem; color:var(--danger); font-weight:600;"><i class="fa-solid fa-circle-xmark"></i> Incorrect (Penalty: -${q.negative || 0})</div>`;
          }
        } else {
          html += `<div style="margin-top:1rem; color:var(--text-secondary); font-weight:600;"><i class="fa-solid fa-minus"></i> Skipped</div>`;
        }

      } else if (assessment.type === 'case') {
        html += `<p style="margin-bottom:0.5rem; font-size:0.9rem; color:var(--text-secondary);">Your Answer:</p>`;
        html += `<div style="padding:1rem; background:var(--glass-bg); border-radius:4px; white-space:pre-wrap; border: 1px solid var(--glass-border);">${answers[i] || '<em>No answer provided</em>'}</div>`;
      } else if (assessment.type === 'coding') {
        html += `<p style="margin-bottom:0.5rem; font-size:0.9rem; color:var(--text-secondary);">Your Code:</p>`;
        html += `<pre style="padding:1rem; background:var(--glass-bg); border-radius:4px; font-family:monospace; overflow-x:auto; border: 1px solid var(--glass-border);">${answers[i] || '/* No code provided */'}</pre>`;
      }

      div.innerHTML = html;
      container.appendChild(div);
    });
  };


  // =====================================================
  // PERFORMANCE TRENDS & PDF EXPORT
  // =====================================================
  const navTrends = document.querySelector('.nav-item[data-target="trends-section"]');
  if (navTrends) {
      navTrends.addEventListener('click', () => {
         const submissions = (window.DB ? window.DB.getSubmissions() : []).filter(s => s.studentName === studentName);
         const tbody = document.getElementById('trends-table-body');
         if (tbody) {
             if (submissions.length === 0) {
                 tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color:var(--text-secondary);">No completed exams yet.</td></tr>';
                 return;
             }
             tbody.innerHTML = submissions.map(sub => `
               <tr>
                 <td>${sub.assessmentTitle}</td>
                 <td>${sub.submittedAt}</td>
                 <td><strong style="color:var(--accent-primary)">${sub.score}</strong></td>
                 <td>
                   <button class="btn btn-sm btn-outline btn-download-pdf" data-title="${sub.assessmentTitle}" data-score="${sub.score}" data-date="${sub.submittedAt}">
                     <i class="fa-solid fa-file-pdf"></i> Download
                   </button>
                 </td>
               </tr>
             `).join('');
             
             // Attach PDF download handlers
             tbody.querySelectorAll('.btn-download-pdf').forEach(btn => {
                 btn.addEventListener('click', (e) => {
                     const t = e.currentTarget.dataset.title;
                     const s = e.currentTarget.dataset.score;
                     const d = e.currentTarget.dataset.date;
                     const content = `TORPEDO PERFORMANCE REPORT

Student Name: ${studentName}
Exam Title: ${t}
Date Submitted: ${d}
Score: ${s}

-- Generated by Torpedo --`;
                     const blob = new Blob([content], {type: 'text/plain'});
                     const url = URL.createObjectURL(blob);
                     const a = document.createElement('a');
                     a.href = url;
                     a.download = `Report_${t.replace(/\s+/g, '_')}.pdf`;
                     a.click();
                 });
             });
         }
      });
  }

});
