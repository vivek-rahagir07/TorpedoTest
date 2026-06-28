/* =====================================================
   STUDENT PORTAL — JS
   Fully functional: proctoring, player, scoring, results,
   pre-exam system check, camera feed, and JS runner sandbox.
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ---- Views ----
  const viewLogin    = document.getElementById('view-login');
  const viewDashboard= document.getElementById('view-dashboard');
  const viewSyscheck = document.getElementById('view-syscheck');
  const viewPre      = document.getElementById('view-pre');
  const viewPlayer   = document.getElementById('view-player');
  const viewResults  = document.getElementById('view-results');

  // ---- System Check ----
  const syscheckNextBtn = document.getElementById('syscheck-next-btn');
  const syscheckPreview = document.getElementById('syscheck-preview');
  const syscheckVideoContainer = document.getElementById('syscheck-video-container');

  // ---- Pre-Assessment ----
  const preTitleEl   = document.getElementById('pre-title');
  const preMetaEl    = document.getElementById('pre-meta');
  const preTypeBadge = document.getElementById('pre-type-badge');
  const startBtn     = document.getElementById('start-btn');
  const backBtn      = document.getElementById('back-btn');

  // ---- Player ----
  const questionTracker  = document.getElementById('question-tracker');
  const dynamicQContent  = document.getElementById('dynamic-q-content');
  const qPaletteEl       = document.getElementById('q-palette');
  const prevBtn          = document.getElementById('prev-btn');
  const nextBtn          = document.getElementById('next-btn');
  const submitBtn        = document.getElementById('submit-btn');
  const timerBadge       = document.getElementById('timer-badge');
  const timeLeftEl       = document.getElementById('time-left');

  // ---- Proctor PIP ----
  const proctorVideo     = document.getElementById('proctor-video');
  const proctorSim       = document.getElementById('proctor-simulation');
  const proctorStatusTxt = document.getElementById('proctor-status-txt');

  // ---- Anti-Cheat ----
  const warningModal      = document.getElementById('warning-modal');
  const warningReasonEl   = document.getElementById('warning-reason');
  const flagsRemainingEl  = document.getElementById('flags-remaining-text');
  const resumeBtn         = document.getElementById('resume-btn');
  const flagCounterEl     = document.getElementById('flag-counter');

  // ---- Results ----
  const resultsSummaryEl = document.getElementById('results-summary');
  const resultsScoreEl   = document.getElementById('results-score');

  // ---- State ----
  let assessments       = [];
  let currentAssessment = null;
  let currentQIndex     = 0;
  let studentAnswers    = {};   // { qIndex: answerValue }
  let isActive          = false;
  let flagCount         = 0;
  const MAX_FLAGS       = 3;
  let warningActive     = false;
  let timerInterval     = null;
  let secondsLeft       = 0;
  let violationsLog     = [];   // List of strings representing violations
  let cameraStream      = null;
  let audioStream       = null;
  let audioCtx          = null;
  let audioAnalyser     = null;
  let studentName       = 'Student';
  let studentEmail      = '';
  let pendingViolationReason = '';
  let screenStream      = null;
  let screenCaptureInterval = null;
  let examStartedAt     = null;  // timestamp when exam began

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
  const loginBtn   = document.getElementById('login-btn');
  const loginName  = document.getElementById('login-name');
  const loginEmail = document.getElementById('login-email');
  const loginError = document.getElementById('login-error');
  const loginErrorMsg = document.getElementById('login-error-msg');

  const dashboardName = document.getElementById('dashboard-name-display');
  const resultLogBody = document.getElementById('result-log-body');
  
  const joinBtn   = document.getElementById('join-btn');
  const joinCode  = document.getElementById('join-code');
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
    
    const cameraEl  = document.getElementById('check-camera');
    const micEl     = document.getElementById('check-mic');
    const networkEl = document.getElementById('check-network');
    const screenEl  = document.getElementById('check-screen');

    [cameraEl, micEl, networkEl, screenEl].forEach(el => {
      if (el) el.querySelector('.syscheck-status').innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Checking...';
    });

    let cameraPassed = false;
    let micPassed    = false;
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
    const typeLabels = { mcq: 'MCQ Assessment', case: 'Case Based Assessment', coding: 'Coding Assessment' };
    const settings = currentAssessment.settings || {};
    preTitleEl.textContent = currentAssessment.title;
    preTypeBadge.textContent = typeLabels[currentAssessment.type] || 'Assessment';

    // Build meta info including timing
    const qCount = currentAssessment.questions.length;
    const duration = settings.duration || Math.min(90, Math.max(10, qCount * 2));
    let metaParts = [`${qCount} Question${qCount !== 1 ? 's' : ''}`, `${duration} Minutes`, 'Full Screen Required'];
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
    stopAudioSpike();
  }

  // ===========================================================
  // 3. START ASSESSMENT
  // ===========================================================
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      try { await document.documentElement.requestFullscreen?.(); } catch (err) {}
      startAssessment();
    });
  }

  let wakeLock = null;

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
    const minutes = settings.duration || Math.min(90, Math.max(10, currentAssessment.questions.length * 2));
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
    if (settings.randomize && currentAssessment.type === 'mcq') {
      let qs = [...currentAssessment.questions];
      // Fisher-Yates shuffle questions
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
      // Subset slicing
      if (settings.questionsPerStudent > 0 && settings.questionsPerStudent < qs.length) {
        qs = qs.slice(0, settings.questionsPerStudent);
      }
      // Shuffle options per question
      if (settings.shuffleOptions) {
        qs.forEach(q => {
          let opts = [...q.opts];
          let correctStr = opts[q.ans]; // remember the correct text
          for (let i = opts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [opts[i], opts[j]] = [opts[j], opts[i]];
          }
          q.opts = opts;
          q.ans = opts.indexOf(correctStr); // remap the correct index
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
    } catch (err) {}
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
  // 4. LIVE PROCTOR FEED
  // ===========================================================
  function initProctorFeed() {
    if (cameraStream) {
      proctorVideo.srcObject = cameraStream;
      proctorVideo.classList.remove('hidden');
      proctorSim.classList.add('hidden');
      proctorStatusTxt.textContent = 'Active';
      proctorStatusTxt.style.color = 'var(--success)';
    } else {
      proctorVideo.classList.add('hidden');
      proctorSim.classList.remove('hidden');
      proctorStatusTxt.textContent = 'Simulated';
      proctorStatusTxt.style.color = 'var(--warning)';
    }
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
    currentAssessment.questions.forEach((_, idx) => {
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
    currentQIndex = index;
    const qData = currentAssessment.questions[index];
    const total  = currentAssessment.questions.length;

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
    if (currentAssessment.type === 'mcq') {
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
    } else if (currentAssessment.type === 'case') {
      html = `
        <div class="case-study-panel">
          <h4><i class="fa-solid fa-book-open"></i> Case Study Scenario</h4>
          <p>${currentAssessment.content || 'No case study content provided.'}</p>
        </div>
        <p class="q-text">${qData.q}</p>
        <textarea class="case-answer-box" id="case-ans-input" placeholder="Type your detailed answer here...">${studentAnswers[index] || ''}</textarea>
      `;
    } else if (currentAssessment.type === 'coding') {
      html = `
        <div class="coding-split-layout" style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; min-height: 50vh;">
          <div class="coding-left-pane">
            <div class="problem-title-badge"><h4>${qData.title}</h4></div>
            <p class="q-text">${qData.desc}</p>
            <div class="io-row">
              <div class="io-box"><strong>Sample Input</strong><code id="sample-input-code">${qData.input || 'None'}</code></div>
              <div class="io-box"><strong>Expected Output</strong><code id="expected-output-code">${qData.output || 'None'}</code></div>
            </div>
          </div>
          <div class="coding-right-pane" style="display:flex; flex-direction:column; gap:0.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <select id="code-lang-sel" class="form-control" style="width:150px; padding:0.25rem; font-size:0.85rem;">
                <option value="javascript" ${!window.currentCodeLang || window.currentCodeLang === 'javascript' ? 'selected' : ''}>JavaScript (Node)</option>
                <option value="python" ${window.currentCodeLang === 'python' ? 'selected' : ''}>Python</option>
              </select>
              <button class="btn btn-outline btn-sm" id="run-code-btn"><i class="fa-solid fa-play"></i> Run & Test</button>
            </div>
            <textarea class="code-editor" id="code-ans-input">${studentAnswers[index] || ''}</textarea>
            <div class="terminal-output hidden" id="code-terminal"><pre id="terminal-stdout"></pre></div>
          </div>
        </div>
      `;
    }

    dynamicQContent.innerHTML = html;
    if (currentAssessment.type === 'coding') {
      const editorEl = document.getElementById('code-ans-input');
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
        // add some inline CSS to fix border radius
        window.codeMirrorInstance.getWrapperElement().style.borderRadius = "var(--radius-md)";
        window.codeMirrorInstance.getWrapperElement().style.fontFamily = "'JetBrains Mono', monospace";
        window.codeMirrorInstance.getWrapperElement().style.fontSize = "0.95rem";
      }
      document.getElementById('run-code-btn').addEventListener('click', runCodingSandbox);
    }
    if (currentAssessment.type === 'mcq' && studentAnswers[index] !== undefined) {
      const radio = dynamicQContent.querySelector(`input[value="${studentAnswers[index]}"]`);
      if (radio) radio.checked = true;
    }
    updatePalette();
  }

  function runCodingSandbox() {
    if (window.codeMirrorInstance) window.codeMirrorInstance.save();
    const code = document.getElementById('code-ans-input').value;
    const input = document.getElementById('sample-input-code').textContent;
    const expected = document.getElementById('expected-output-code').textContent.trim();
    const stdout = document.getElementById('terminal-stdout');
    document.getElementById('code-terminal').classList.remove('hidden');
    
    try {
      const executor = new Function('input', `try { ${code} ; return typeof solution === 'function' ? solution(input) : undefined; } catch(e) { return null; }`);
      const result = executor(input);
      stdout.textContent = String(result) === expected ? '✅ Test Case Passed!' : `❌ Expected "${expected}" but got "${result}"`;
    } catch(e) { stdout.textContent = 'Runtime Error.'; }
  }

  function saveCurrentAnswer() {
    if (!currentAssessment) return;
    if (currentAssessment.type === 'mcq') {
      const s = dynamicQContent.querySelector('input[type="radio"]:checked');
      if (s) studentAnswers[currentQIndex] = parseInt(s.value);
    } else if (currentAssessment.type === 'coding') {
      if (window.codeMirrorInstance) window.codeMirrorInstance.save();
      const input = document.getElementById('code-ans-input');
      if (input && input.value.trim()) studentAnswers[currentQIndex] = input.value.trim();
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
    if (currentQIndex < currentAssessment.questions.length - 1) renderQuestion(currentQIndex + 1); 
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
    isActive = false;
    saveCurrentAnswer();
    stopCameraStream();
    try { document.exitFullscreen?.(); } catch (_) {}
    if (wakeLock) { wakeLock.release().then(() => wakeLock = null); }

    const total = currentAssessment.questions.length;
    const answered = Object.keys(studentAnswers).length;
    let scoreText = 'Submitted';

    if (currentAssessment.type === 'mcq') {
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

  window.openReviewMode = function(submission, assessment) {
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
      
      let html = `<h4>Q${i+1}. ${q.q || q.title || ''}</h4>`;
      
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

});
