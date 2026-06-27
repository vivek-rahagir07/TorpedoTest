/* =====================================================
   STUDENT PORTAL — JS
   Fully functional: proctoring, player, scoring, results
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ---- Views ----
  const viewList    = document.getElementById('view-list');
  const viewPre     = document.getElementById('view-pre');
  const viewPlayer  = document.getElementById('view-player');
  const viewResults = document.getElementById('view-results');

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

  // ---- Helper: Show View ----
  function showView(view) {
    [viewList, viewPre, viewPlayer, viewResults].forEach(v => v.classList.add('hidden'));
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
          <p style="font-size:0.8rem; margin-top: 0.25rem;">Ask your faculty to publish one from the Faculty Portal.</p>
        </div>`;
      return;
    }

    assessments.forEach(item => {
      const card = document.createElement('div');
      card.className = 'assessment-item animate-fade-in';

      const icons = { mcq: 'fa-list-check icon-mcq', case: 'fa-file-signature icon-case', coding: 'fa-code icon-coding' };
      const typeLabels = { mcq: 'MCQ Based', case: 'Case Based', coding: 'Coding' };
      const iconClass = icons[item.type] || 'fa-question';
      const typeLabel = typeLabels[item.type] || item.type;

      card.innerHTML = `
        <div class="assessment-item-icon ${iconClass.split(' ')[1]}">
          <i class="fa-solid ${iconClass.split(' ')[0]}"></i>
        </div>
        <h3>${item.title}</h3>
        <div class="meta">${typeLabel} &bull; ${item.questions.length} Question${item.questions.length !== 1 ? 's' : ''}</div>
        <div class="start-hint"><i class="fa-solid fa-play"></i> Click to Start</div>
      `;
      card.addEventListener('click', () => selectAssessment(item));
      container.appendChild(card);
    });
  }

  loadAssessments();

  // ===========================================================
  // 2. SELECT ASSESSMENT → PRE VIEW
  // ===========================================================
  function selectAssessment(item) {
    currentAssessment = item;
    const typeLabels = { mcq: 'MCQ Assessment', case: 'Case Based Assessment', coding: 'Coding Assessment' };
    preTitleEl.textContent = item.title;
    preTypeBadge.textContent = typeLabels[item.type] || 'Assessment';
    preMetaEl.textContent = `${item.questions.length} Question${item.questions.length !== 1 ? 's' : ''} • Full Screen Required`;
    showView(viewPre);
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => { currentAssessment = null; showView(viewList); });
  }

  // ===========================================================
  // 3. START ASSESSMENT
  // ===========================================================
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      if (!currentAssessment || currentAssessment.questions.length === 0) {
        window.Toast && window.Toast.show('No questions in this assessment.', 'error');
        return;
      }
      try {
        await document.documentElement.requestFullscreen?.();
      } catch (err) {
        console.warn('Fullscreen not available:', err.message);
      }
      startAssessment();
    });
  }

  function startAssessment() {
    isActive = true;
    flagCount = 0;
    studentAnswers = {};
    currentQIndex = 0;
    flagCounterEl.classList.add('hidden');

    // Timer: 2 minutes per question, min 10 min, max 90 min
    const minutes = Math.min(90, Math.max(10, currentAssessment.questions.length * 2));
    secondsLeft = minutes * 60;

    showView(viewPlayer);
    buildPalette();
    renderQuestion(0);
    startTimer();
  }

  // ===========================================================
  // 4. TIMER
  // ===========================================================
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      secondsLeft--;
      const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
      const s = (secondsLeft % 60).toString().padStart(2, '0');
      timeLeftEl.textContent = `${m}:${s}`;

      if (secondsLeft <= 60) {
        timerBadge.classList.add('warning');
      }
      if (secondsLeft <= 0) {
        clearInterval(timerInterval);
        window.Toast && window.Toast.show('Time is up! Submitting automatically.', 'warning');
        setTimeout(submitAssessment, 1000);
      }
    }, 1000);
  }

  // ===========================================================
  // 5. PALETTE
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
  // 6. RENDER QUESTION
  // ===========================================================
  const optionLetters = ['A', 'B', 'C', 'D'];

  function renderQuestion(index) {
    saveCurrentAnswer();  // Save before navigating away
    currentQIndex = index;
    const qData = currentAssessment.questions[index];
    const total  = currentAssessment.questions.length;

    questionTracker.textContent = `Question ${index + 1} of ${total}`;
    prevBtn.disabled = index === 0;
    nextBtn.innerHTML = index === total - 1
      ? '<i class="fa-solid fa-flag"></i> Finish'
      : 'Next <i class="fa-solid fa-arrow-right"></i>';

    let html = '';

    // ---- MCQ ----
    if (currentAssessment.type === 'mcq') {
      html = `<p class="q-text">${qData.q}</p><div class="options-grid">`;
      qData.opts.forEach((opt, i) => {
        const selected = studentAnswers[index] === i ? 'checked' : '';
        html += `
          <label class="option-label">
            <input type="radio" name="mcq_q" value="${i}" ${selected}>
            <div class="option-marker">${optionLetters[i]}</div>
            <span class="option-text">${opt}</span>
          </label>`;
      });
      html += `</div>`;
    }

    // ---- Case Based ----
    else if (currentAssessment.type === 'case') {
      html = `
        <div class="case-study-panel">
          <h4><i class="fa-solid fa-book-open"></i> Case Study</h4>
          <p>${currentAssessment.content || 'No case study content provided.'}</p>
        </div>
        <p class="q-text">${qData.q}</p>
        <textarea class="case-answer-box" id="case-ans-input" placeholder="Type your detailed answer here...">${studentAnswers[index] || ''}</textarea>
      `;
    }

    // ---- Coding ----
    else if (currentAssessment.type === 'coding') {
      html = `
        <div class="coding-panel">
          <div class="problem-title-badge">
            <i class="fa-solid fa-terminal" style="color:var(--accent-primary)"></i>
            <h4>${qData.title}</h4>
          </div>
          <p class="q-text" style="font-size:0.95rem;">${qData.desc}</p>
          <div class="io-row">
            <div class="io-box"><strong>Sample Input</strong><code>${qData.input || 'None'}</code></div>
            <div class="io-box"><strong>Expected Output</strong><code>${qData.output || 'None'}</code></div>
          </div>
          <label style="font-size:0.85rem; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:0.5rem;">Your Solution</label>
          <textarea class="code-editor" id="code-ans-input" placeholder="// Write your solution here...">${studentAnswers[index] || ''}</textarea>
        </div>
      `;
    }

    dynamicQContent.innerHTML = html;

    // Restore radio selection visual
    if (currentAssessment.type === 'mcq' && studentAnswers[index] !== undefined) {
      const radio = dynamicQContent.querySelector(`input[value="${studentAnswers[index]}"]`);
      if (radio) radio.checked = true;
    }

    updatePalette();
  }

  // ---- Save current answer before navigating ----
  function saveCurrentAnswer() {
    if (!currentAssessment) return;

    if (currentAssessment.type === 'mcq') {
      const selected = dynamicQContent.querySelector('input[type="radio"]:checked');
      if (selected) studentAnswers[currentQIndex] = parseInt(selected.value);
    } else if (currentAssessment.type === 'case') {
      const ta = document.getElementById('case-ans-input');
      if (ta && ta.value.trim()) studentAnswers[currentQIndex] = ta.value.trim();
    } else if (currentAssessment.type === 'coding') {
      const ce = document.getElementById('code-ans-input');
      if (ce && ce.value.trim()) studentAnswers[currentQIndex] = ce.value.trim();
    }
  }

  // ===========================================================
  // 7. NAVIGATION
  // ===========================================================
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (currentQIndex > 0) renderQuestion(currentQIndex - 1);
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (currentQIndex < currentAssessment.questions.length - 1) {
      renderQuestion(currentQIndex + 1);
    } else {
      confirmSubmit();
    }
  });

  if (submitBtn) submitBtn.addEventListener('click', confirmSubmit);

  function confirmSubmit() {
    saveCurrentAnswer();
    const answered = Object.keys(studentAnswers).length;
    const total    = currentAssessment.questions.length;
    const unanswered = total - answered;
    if (unanswered > 0) {
      if (!confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return;
    }
    submitAssessment();
  }

  // ===========================================================
  // 8. SUBMIT & RESULTS
  // ===========================================================
  function submitAssessment() {
    clearInterval(timerInterval);
    isActive = false;
    saveCurrentAnswer();

    try { document.exitFullscreen?.(); } catch (_) {}

    // Score MCQ
    let correctCount = 0;
    if (currentAssessment.type === 'mcq') {
      currentAssessment.questions.forEach((q, i) => {
        if (studentAnswers[i] === q.ans) correctCount++;
      });
    }

    const total    = currentAssessment.questions.length;
    const answered = Object.keys(studentAnswers).length;

    showView(viewResults);

    if (currentAssessment.type === 'mcq') {
      const pct = Math.round((correctCount / total) * 100);
      resultsScoreEl.textContent = `${correctCount} / ${total} (${pct}%)`;
      resultsSummaryEl.textContent = `You answered ${answered} of ${total} questions. ${flagCount} violation flag(s) recorded.`;
    } else {
      resultsScoreEl.textContent = `${answered} / ${total}`;
      resultsSummaryEl.textContent = `Submitted! ${answered} of ${total} question(s) answered. ${flagCount} violation flag(s) recorded.`;
    }

    window.Toast && window.Toast.show('Assessment submitted successfully!');
    loadAssessments(); // Refresh list for next time
  }

  // ===========================================================
  // 9. ANTI-CHEAT PROCTORING
  // ===========================================================
  document.addEventListener('fullscreenchange', handleFsChange);
  document.addEventListener('webkitfullscreenchange', handleFsChange);

  function handleFsChange() {
    if (!isActive || warningActive) return;
    const inFs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!inFs) triggerFlag('You exited full-screen mode.');
  }

  document.addEventListener('visibilitychange', () => {
    if (!isActive || warningActive) return;
    if (document.hidden) triggerFlag('You switched tabs or minimized the window.');
  });

  window.addEventListener('blur', () => {
    if (!isActive || warningActive) return;
    triggerFlag('Focus was lost from the assessment window.');
  });

  function triggerFlag(reason) {
    flagCount++;
    warningActive = true;

    // Update flag badge
    flagCounterEl.textContent = `Flags: ${flagCount}`;
    flagCounterEl.classList.remove('hidden');

    warningReasonEl.textContent = reason;
    const remaining = MAX_FLAGS - flagCount;
    flagsRemainingEl.textContent = remaining > 0
      ? `${remaining} more violation(s) will auto-submit.`
      : 'This is your last warning. Next violation will auto-submit.';

    try { document.exitFullscreen?.(); } catch (_) {}
    warningModal.classList.remove('hidden');

    if (flagCount >= MAX_FLAGS) {
      setTimeout(() => {
        warningModal.classList.add('hidden');
        window.Toast && window.Toast.show('Maximum violations reached. Auto-submitting.', 'error');
        setTimeout(submitAssessment, 800);
      }, 2500);
    }
  }

  if (resumeBtn) {
    resumeBtn.addEventListener('click', async () => {
      try {
        await document.documentElement.requestFullscreen?.();
        warningModal.classList.add('hidden');
        setTimeout(() => { warningActive = false; }, 600);
      } catch (err) {
        window.Toast && window.Toast.show('Please allow full-screen to resume.', 'error');
      }
    });
  }

});
