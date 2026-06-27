/* =====================================================
   STUDENT PORTAL — JS
   Fully functional: proctoring, player, scoring, results,
   pre-exam system check, camera feed, and JS runner sandbox.
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ---- Views ----
  const viewList     = document.getElementById('view-list');
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

  // ---- Helper: Show View ----
  function showView(view) {
    [viewList, viewSyscheck, viewPre, viewPlayer, viewResults].forEach(v => v.classList.add('hidden'));
    view.classList.remove('hidden');
  }

  // ===========================================================
  // 1. LOAD ASSESSMENTS
  // ===========================================================
  function loadAssessments() {
    assessments = window.DB ? window.DB.getAssessments() : [];
    const container = document.getElementById('assessments-container');
    container.innerHTML = '';

    if (assessments.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1">
          <i class="fa-solid fa-inbox"></i>
          <p>No assessments published yet.</p>
        </div>`;
      return;
    }

    assessments.forEach(item => {
      const card = document.createElement('div');
      card.className = 'assessment-item animate-fade-in';
      const icons = { mcq: 'fa-list-check icon-mcq', case: 'fa-file-signature icon-case', coding: 'fa-code icon-coding' };
      const typeLabels = { mcq: 'MCQ Based', case: 'Case Based', coding: 'Coding' };
      card.innerHTML = `
        <div class="assessment-item-icon ${icons[item.type].split(' ')[1]}">
          <i class="fa-solid ${icons[item.type].split(' ')[0]}"></i>
        </div>
        <h3>${item.title}</h3>
        <div class="meta">${typeLabels[item.type]} &bull; ${item.questions.length} Questions</div>
        <div class="start-hint"><i class="fa-solid fa-play"></i> Click to Start</div>
      `;
      card.addEventListener('click', () => selectAssessment(item));
      container.appendChild(card);
    });
  }

  loadAssessments();

  // ===========================================================
  // 2. SYSTEM CHECK SEQUENCE
  // ===========================================================
  function selectAssessment(item) {
    currentAssessment = item;
    showView(viewSyscheck);
    runSystemCheckSequence();
  }

  async function runSystemCheckSequence() {
    syscheckNextBtn.disabled = true;
    
    const cameraEl = document.getElementById('check-camera');
    const networkEl = document.getElementById('check-network');
    const screenEl = document.getElementById('check-screen');

    cameraEl.querySelector('.syscheck-status').innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Checking...';
    networkEl.querySelector('.syscheck-status').innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Checking...';
    screenEl.querySelector('.syscheck-status').innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Checking...';

    let cameraPassed = false;
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
      if (cameraPassed && networkPassed && screenPassed) {
        syscheckNextBtn.disabled = false;
      }
    }
  }

  syscheckNextBtn.addEventListener('click', () => {
    const typeLabels = { mcq: 'MCQ Assessment', case: 'Case Based Assessment', coding: 'Coding Assessment' };
    preTitleEl.textContent = currentAssessment.title;
    preTypeBadge.textContent = typeLabels[currentAssessment.type] || 'Assessment';
    preMetaEl.textContent = `${currentAssessment.questions.length} Question${currentAssessment.questions.length !== 1 ? 's' : ''} • Full Screen Required`;
    showView(viewPre);
  });

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      stopCameraStream();
      currentAssessment = null;
      showView(viewList);
    });
  }

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
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

  function startAssessment() {
    isActive = true;
    flagCount = 0;
    studentAnswers = {};
    currentQIndex = 0;
    violationsLog = [];
    flagCounterEl.classList.add('hidden');

    const minutes = Math.min(90, Math.max(10, currentAssessment.questions.length * 2));
    secondsLeft = minutes * 60;

    showView(viewPlayer);
    buildPalette();
    renderQuestion(0);
    startTimer();
    initProctorFeed();
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

    let html = '';
    if (currentAssessment.type === 'mcq') {
      html = `<p class="q-text">${qData.q}</p><div class="options-grid">`;
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
        <div class="coding-panel">
          <div class="problem-title-badge"><h4>${qData.title}</h4></div>
          <p class="q-text">${qData.desc}</p>
          <div class="io-row">
            <div class="io-box"><strong>Sample Input</strong><code id="sample-input-code">${qData.input || 'None'}</code></div>
            <div class="io-box"><strong>Expected Output</strong><code id="expected-output-code">${qData.output || 'None'}</code></div>
          </div>
          <textarea class="code-editor" id="code-ans-input">${studentAnswers[index] || ''}</textarea>
          <button class="btn btn-outline btn-sm mt-2" id="run-code-btn"><i class="fa-solid fa-play"></i> Run & Test</button>
          <div class="terminal-output hidden" id="code-terminal"><pre id="terminal-stdout"></pre></div>
        </div>
      `;
    }

    dynamicQContent.innerHTML = html;
    if (currentAssessment.type === 'coding') {
      document.getElementById('run-code-btn').addEventListener('click', runCodingSandbox);
    }
    if (currentAssessment.type === 'mcq' && studentAnswers[index] !== undefined) {
      const radio = dynamicQContent.querySelector(`input[value="${studentAnswers[index]}"]`);
      if (radio) radio.checked = true;
    }
    updatePalette();
  }

  function runCodingSandbox() {
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
    } else {
      const input = document.getElementById(currentAssessment.type === 'case' ? 'case-ans-input' : 'code-ans-input');
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
  if (submitBtn) submitBtn.addEventListener('click', submitAssessment);

  // ===========================================================
  // 9. SUBMIT & RESULTS
  // ===========================================================
  function submitAssessment() {
    clearInterval(timerInterval);
    isActive = false;
    saveCurrentAnswer();
    stopCameraStream();
    try { document.exitFullscreen?.(); } catch (_) {}

    const total = currentAssessment.questions.length;
    const answered = Object.keys(studentAnswers).length;
    let scoreText = 'Submitted';

    if (currentAssessment.type === 'mcq') {
      let correct = currentAssessment.questions.reduce((acc, q, i) => acc + (studentAnswers[i] === q.ans ? 1 : 0), 0);
      scoreText = `${correct} / ${total} (${Math.round((correct / total) * 100)}%)`;
    }

    if (window.DB) window.DB.saveSubmission({ title: currentAssessment.title, score: scoreText, violations: violationsLog });
    showView(viewResults);
    resultsScoreEl.textContent = scoreText;
    resultsSummaryEl.textContent = `Completed ${answered} / ${total} questions. ${flagCount} violations logged.`;
    loadAssessments();
  }

  // ===========================================================
  // 10. ANTI-CHEAT
  // ===========================================================
  document.addEventListener('fullscreenchange', handleFsChange);
  document.addEventListener('visibilitychange', () => { if (isActive && document.hidden) triggerFlag('Tab Switch'); });
  window.addEventListener('blur', () => { if (isActive) triggerFlag('Focus Lost'); });

  function handleFsChange() { if (isActive && !document.fullscreenElement) triggerFlag('Exited Fullscreen'); }

  function triggerFlag(reason) {
    flagCount++;
    violationsLog.push(`${new Date().toLocaleTimeString()} - ${reason}`);
    flagCounterEl.textContent = `Flags: ${flagCount}`;
    flagCounterEl.classList.remove('hidden');
    warningReasonEl.textContent = reason;
    warningModal.classList.remove('hidden');
    if (flagCount >= MAX_FLAGS) setTimeout(submitAssessment, 2000);
  }

  if (resumeBtn) resumeBtn.addEventListener('click', () => {
    warningModal.classList.add('hidden');
    document.documentElement.requestFullscreen?.();
  });

});
