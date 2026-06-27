document.addEventListener('DOMContentLoaded', () => {
  const listView = document.getElementById('assessment-list-view');
  const assessmentsContainer = document.getElementById('assessments-container');
  
  const preAssessment = document.getElementById('pre-assessment');
  const activeTitle = document.getElementById('active-assessment-title');
  const startBtn = document.getElementById('start-btn');
  const backToListBtn = document.getElementById('back-to-list-btn');
  
  const assessmentPlayer = document.getElementById('assessment-player');
  const questionTracker = document.getElementById('question-tracker');
  const dynamicQContent = document.getElementById('dynamic-q-content');
  const qPalette = document.getElementById('q-palette');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const submitBtn = document.getElementById('submit-btn');
  const warningModal = document.getElementById('warning-modal');
  const resumeBtn = document.getElementById('resume-btn');
  const flagCounterEl = document.getElementById('flag-counter');

  let assessments = [];
  let currentAssessment = null;
  let currentQIndex = 0;
  
  let isAssessmentActive = false;
  let flagCount = 0;
  let warningActive = false;

  // --- 1. Load Assessments ---
  function loadAssessments() {
    if (window.DB) {
      assessments = window.DB.getAssessments();
    }
    
    if (assessments.length === 0) {
      assessmentsContainer.innerHTML = '<p>No assessments currently available.</p>';
      return;
    }

    assessmentsContainer.innerHTML = '';
    assessments.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'assessment-item animate-fade-in';
      
      let typeLabel = item.type.toUpperCase();
      if(item.type === 'mcq') typeLabel = 'MCQ Based';
      if(item.type === 'case') typeLabel = 'Case Based';
      if(item.type === 'coding') typeLabel = 'Coding';
      
      card.innerHTML = `
        <h3>${item.title}</h3>
        <p><strong>Type:</strong> ${typeLabel}</p>
        <p><strong>Questions:</strong> ${item.questions.length}</p>
        <p style="font-size: 0.8rem; color: var(--text-secondary);">ID: ${item.id}</p>
      `;
      card.addEventListener('click', () => selectAssessment(item));
      assessmentsContainer.appendChild(card);
    });
  }
  
  loadAssessments();

  function selectAssessment(item) {
    currentAssessment = item;
    listView.classList.add('hidden');
    preAssessment.classList.remove('hidden');
    activeTitle.innerText = item.title;
  }

  if (backToListBtn) {
    backToListBtn.addEventListener('click', () => {
      currentAssessment = null;
      preAssessment.classList.add('hidden');
      listView.classList.remove('hidden');
    });
  }

  // --- 2. Start Assessment & Full Screen ---
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      if(currentAssessment.questions.length === 0) {
        alert("This assessment has no questions.");
        return;
      }
      try {
        await requestFullScreen(document.documentElement);
      } catch (err) {
        console.warn("Fullscreen API failed or not supported in this environment.", err);
        // Continue anyway so testing isn't completely blocked
      }
      startAssessment();
    });
  }

  function startAssessment() {
    isAssessmentActive = true;
    currentQIndex = 0;
    preAssessment.classList.add('hidden');
    assessmentPlayer.classList.remove('hidden');
    
    buildPalette();
    renderQuestion(currentQIndex);
  }

  function requestFullScreen(element) {
    if (element.requestFullscreen) return element.requestFullscreen();
    if (element.webkitRequestFullscreen) return element.webkitRequestFullscreen();
    if (element.msRequestFullscreen) return element.msRequestFullscreen();
    return Promise.reject("Fullscreen API not supported");
  }

  function exitFullScreen() {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  }

  // --- 3. Render Player ---
  function buildPalette() {
    qPalette.innerHTML = '';
    currentAssessment.questions.forEach((_, idx) => {
      const dot = document.createElement('div');
      dot.className = `q-dot ${idx === 0 ? 'active' : ''}`;
      dot.innerText = idx + 1;
      dot.addEventListener('click', () => renderQuestion(idx));
      qPalette.appendChild(dot);
    });
  }

  function updatePaletteActive(index) {
    const dots = qPalette.querySelectorAll('.q-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === index);
    });
  }

  function renderQuestion(index) {
    currentQIndex = index;
    const qData = currentAssessment.questions[index];
    const total = currentAssessment.questions.length;
    
    questionTracker.innerText = `Question ${index + 1} of ${total}`;
    updatePaletteActive(index);
    
    // Disable prev/next conditionally
    prevBtn.disabled = index === 0;
    nextBtn.innerText = index === total - 1 ? 'Finish' : 'Next Question';
    
    // Build HTML based on type
    let html = '';
    
    if (currentAssessment.type === 'mcq') {
      html += `<p class="q-text">${qData.q}</p>`;
      html += `<div class="options-grid">`;
      qData.opts.forEach((opt, oIdx) => {
        html += `
          <label class="option-label">
            <input type="radio" name="q${index}" value="${oIdx}">
            <span class="option-text">${opt}</span>
          </label>
        `;
      });
      html += `</div>`;
    } 
    else if (currentAssessment.type === 'case') {
      if (index === 0) {
        // Show case study content mostly on first question or pin it
        html += `<div class="rules-box" style="margin-bottom: 2rem;">
          <h4>Case Study</h4>
          <p>${currentAssessment.content}</p>
        </div>`;
      }
      html += `<p class="q-text">${qData.q}</p>`;
      html += `<textarea class="form-control" rows="5" placeholder="Type your answer here..."></textarea>`;
    }
    else if (currentAssessment.type === 'coding') {
      html += `
        <h4 style="margin-bottom:1rem; color:var(--accent-primary);">${qData.title}</h4>
        <p class="q-text" style="font-size:1rem;">${qData.desc}</p>
        <div style="display:flex; gap:1rem; margin-bottom:2rem;">
          <div style="flex:1; background:var(--bg-primary); padding:1rem; border-radius:8px;"><strong>Sample Input:</strong><br><code style="white-space:pre-wrap">${qData.input}</code></div>
          <div style="flex:1; background:var(--bg-primary); padding:1rem; border-radius:8px;"><strong>Sample Output:</strong><br><code style="white-space:pre-wrap">${qData.output}</code></div>
        </div>
        <textarea class="form-control code-font" rows="10" placeholder="// Write your solution here..."></textarea>
      `;
    }

    dynamicQContent.innerHTML = html;
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentQIndex > 0) renderQuestion(currentQIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentQIndex < currentAssessment.questions.length - 1) {
        renderQuestion(currentQIndex + 1);
      } else {
        submitAssessment();
      }
    });
  }

  // --- 4. Anti-Cheat Mechanisms ---
  document.addEventListener('fullscreenchange', handleFullScreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullScreenChange);

  function handleFullScreenChange() {
    if (!isAssessmentActive) return;
    const isFullScreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFullScreen && !warningActive) {
      triggerFlag("Exited full-screen mode.");
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!isAssessmentActive) return;
    if (document.hidden && !warningActive) {
      triggerFlag("Switched tab or minimized window.");
    }
  });

  window.addEventListener('blur', () => {
    if (!isAssessmentActive) return;
    if (!warningActive) {
      triggerFlag("Clicked outside the assessment window.");
    }
  });

  function triggerFlag(reason) {
    console.warn("FLAG TRIGGERED: ", reason);
    flagCount++;
    flagCounterEl.innerText = `Flags: ${flagCount}`;
    
    warningActive = true;
    warningModal.classList.remove('hidden');
    exitFullScreen();

    if (flagCount >= 3) {
      alert("Maximum violations reached. Your assessment is being automatically submitted.");
      submitAssessment();
    }
  }

  if (resumeBtn) {
    resumeBtn.addEventListener('click', async () => {
      try {
        await requestFullScreen(document.documentElement);
        warningModal.classList.add('hidden');
        setTimeout(() => { warningActive = false; }, 500);
      } catch (err) {
        alert("You must enter full screen to resume.");
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', submitAssessment);
  }

  function submitAssessment() {
    isAssessmentActive = false;
    exitFullScreen();
    if(window.Toast) {
      window.Toast.show("Assessment Submitted Successfully!");
    } else {
      alert("Assessment Submitted Successfully!");
    }
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1500);
  }
});
