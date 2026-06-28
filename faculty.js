/** FACULTY PORTAL — JS
   Fully functional: PDF parsing, MCQ, Case, Coding */

document.addEventListener('DOMContentLoaded', () => {

  // =====================================================
  // 1. SIDEBAR NAVIGATION
  // =====================================================
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.assessment-section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      sections.forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });

      item.classList.add('active');
      const target = document.getElementById(item.getAttribute('data-target'));
      if (target) { target.classList.add('active'); target.style.display = 'block'; }
    });
  });

  // =====================================================
  // 2. MCQ SECTION — PDF UPLOAD & PARSING
  // =====================================================
  const fileUpload   = document.getElementById('file-upload');
  const uploadZone   = document.getElementById('upload-zone');
  const loader       = document.getElementById('parsing-loader');
  const extractedBox = document.getElementById('extracted-questions');
  const questionsList = document.getElementById('questions-list');
  const qCountEl     = document.getElementById('q-count');
  const publishMcqBtn = document.getElementById('publish-mcq-btn');

  const tabPdf = document.getElementById('tab-pdf');
  const tabPaste = document.getElementById('tab-paste');
  const tabCsv = document.getElementById('tab-csv');
  const uploadZoneWrap = document.getElementById('upload-zone-wrap');
  const pasteZoneWrap = document.getElementById('paste-zone-wrap');
  const csvZoneWrap = document.getElementById('csv-zone-wrap');
  const pasteInput = document.getElementById('paste-input');
  const parsePasteBtn = document.getElementById('parse-paste-btn');
  const csvFileUpload = document.getElementById('csv-file-upload');

  function activateTab(activeTab) {
    [tabPdf, tabPaste, tabCsv].forEach(t => t.classList.remove('active'));
    [uploadZoneWrap, pasteZoneWrap, csvZoneWrap].forEach(z => z.classList.add('hidden'));
    activeTab.classList.add('active');
  }

  tabPdf.addEventListener('click', () => {
    activateTab(tabPdf);
    uploadZoneWrap.classList.remove('hidden');
  });

  tabPaste.addEventListener('click', () => {
    activateTab(tabPaste);
    pasteZoneWrap.classList.remove('hidden');
  });

  tabCsv.addEventListener('click', () => {
    activateTab(tabCsv);
    csvZoneWrap.classList.remove('hidden');
  });

  // ---- CSV Import ----
  if (csvFileUpload) {
    csvFileUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function() {
        const parsed = parseCsvQuestions(this.result);
        if (parsed.length > 0) {
          renderParsedQuestions(parsed);
          csvZoneWrap.classList.add('hidden');
          extractedBox.classList.remove('hidden');
          window.Toast.show(`✅ ${parsed.length} questions imported from CSV!`);
        } else {
          window.Toast.show('No questions found in CSV. Check the format.', 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  function parseCsvQuestions(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    const questions = [];
    for (const line of lines) {
      // Simple CSV split (handles quoted fields)
      const cols = line.match(/("[^"]*"|[^,]+)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || [];
      if (cols.length < 5) continue;
      // Skip header row
      if (/^question$/i.test(cols[0]) || /^q\b/i.test(cols[0]) && /option/i.test(cols[1])) continue;
      const q = cols[0];
      const opts = [cols[1], cols[2], cols[3], cols[4]].filter(Boolean);
      if (opts.length < 2 || !q) continue;
      let ansIndex = -1;
      if (cols[5]) {
        const letter = cols[5].trim().toUpperCase();
        ansIndex = 'ABCD'.indexOf(letter);
      }
      const points = parseFloat(cols[6]) || 1;
      const negative = parseFloat(cols[7]) || 0;
      questions.push({ q, opts, ans: ansIndex >= 0 ? ansIndex : -1, accepted: true, points, negative });
    }
    return questions;
  }

  parsePasteBtn.addEventListener('click', () => {
    const rawText = pasteInput.value.trim();
    if (!rawText) {
      window.Toast.show('Please paste some questions first.', 'error');
      return;
    }
    const parsed = parseQuestionsFromText(rawText);
    if (parsed.length > 0) {
      renderParsedQuestions(parsed);
      pasteZoneWrap.classList.add('hidden');
      extractedBox.classList.remove('hidden');
      window.Toast.show(`✅ ${parsed.length} questions parsed!`);
    } else {
      window.Toast.show('No questions could be framed from the text. Please check the format.', 'error');
    }
  });

  let currentMcqData = [];

  // Drag-and-Drop
  uploadZone.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  });

  fileUpload.addEventListener('change', e => {
    if (e.target.files[0]) handleFileUpload(e.target.files[0]);
  });

  // Click on zone to open file
  uploadZone.addEventListener('click', e => {
    if (e.target.closest('button')) return; // Don't double-trigger Browse button
    fileUpload.click();
  });

  function handleFileUpload(file) {
    if (file.type !== 'application/pdf') {
      window.Toast.show('Please upload a PDF file.', 'error');
      return;
    }
    uploadZone.classList.add('hidden');
    loader.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = async function () {
      try {
        const typedarray = new Uint8Array(this.result);
        const pdfDoc = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let fullText = '';

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const content = await page.getTextContent();
          // Join with space but preserve line-breaks using transform data
          const pageText = content.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }

        console.log('--- PDF TEXT ---\n', fullText, '\n--- END ---');

        const parsed = parseQuestionsFromText(fullText);
        console.log('Parsed:', parsed);

        loader.classList.add('hidden');
        if (parsed.length > 0) {
          renderParsedQuestions(parsed);
          extractedBox.classList.remove('hidden');
          window.Toast.show(`✅ ${parsed.length} questions extracted!`);
        } else {
          uploadZone.classList.remove('hidden');
          window.Toast.show('No questions found. Check the PDF format.', 'error');
        }
      } catch (err) {
        console.error(err);
        loader.classList.add('hidden');
        uploadZone.classList.remove('hidden');
        window.Toast.show('Error reading PDF: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // =====================================================
  // UNIVERSAL MCQ PARSER — handles virtually any format
  // Strategies:
  //   1. Line-by-line state machine (most reliable)
  //   2. Fallback: inline regex splitting
  // =====================================================
  function parseQuestionsFromText(rawText) {
    // Normalise line endings
    let text = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // pdf.js sometimes packs everything in one line — detect this
      // by looking for consecutive question numbers and splitting on them
      .replace(/(\d+[.)][\s])/g, '\n$1')   // 1. → newline before
      .replace(/([A-D][.)][\s])/g, '\n$1') // A. / A) → newline before (keep letter)
      .replace(/Correct\s+Answer/gi, '\nCorrect Answer') // ensure on new line
      .replace(/Answer\s*:/gi, '\nAnswer:');

    console.log('Normalised text:\n', text);

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const questions = [];

    // State
    let state = 'idle'; // 'idle' | 'question' | 'options'
    let currentQ   = null;
    let currentOpts = [];
    let currentAns = -1;
    let qBuffer    = [];

    const isQuestionStart = (line) =>
      /^(?:Q\.?\s*)?\d+\s*[.)][\s]/i.test(line) || /^(?:Q\.?\s*)?\d+\s*[.)]$/.test(line);

    const isOptionLine = (line) =>
      /^\(?[A-Da-d]\s*[.)][\s]/i.test(line) || /^\(?[A-Da-d]\s*[.)]$/.test(line);

    const isAnswerLine = (line) =>
      /^(?:Correct\s+Answer|Answer)\s*[:\-]/i.test(line);

    const extractOptionLetter = (line) => {
      const m = line.match(/^\(?([A-Da-d])\s*[.)][\s]*(.*)/is);
      return m ? { letter: m[1].toLowerCase(), text: m[2].trim() } : null;
    };

    const extractAnswerLetter = (line) => {
      const m = line.match(/(?:Correct\s+Answer|Answer)\s*[:\-]?\s*\(?([A-Da-d])\b/i);
      return m ? m[1].toLowerCase() : null;
    };

    const stripQNumber = (line) =>
      line.replace(/^(?:Q\.?\s*)?\d+\s*[.)]\s*/, '').trim();

    const finishQuestion = () => {
      if (currentQ && currentOpts.length >= 2) {
        questions.push({
          q:        currentQ,
          opts:     currentOpts,
          ans:      currentAns >= 0 ? currentAns : -1,
          accepted: true
        });
      }
      currentQ    = null;
      currentOpts = [];
      currentAns  = -1;
      qBuffer     = [];
      state       = 'idle';
    };

    for (const line of lines) {
      // ---- Answer line — can appear anywhere ----
      if (isAnswerLine(line)) {
        const letter = extractAnswerLetter(line);
        if (letter) currentAns = 'abcd'.indexOf(letter);
        // After answer, likely moving to next question soon
        if (currentQ && currentOpts.length >= 2) {
          // don't finish yet — might be an inline block, next Q start will flush
        }
        continue;
      }

      // ---- New question start ----
      if (isQuestionStart(line)) {
        finishQuestion(); // flush previous
        state = 'question';
        qBuffer = [stripQNumber(line)];
        continue;
      }

      // ---- Option line ----
      if (isOptionLine(line)) {
        if (state === 'question') {
          // Finalise question text from buffer
          currentQ = qBuffer.join(' ').trim();
          qBuffer  = [];
          state    = 'options';
        }
        const opt = extractOptionLetter(line);
        if (opt && opt.text.length > 0 && currentOpts.length < 4) {
          currentOpts.push(opt.text);
        }
        continue;
      }

      // ---- Continuation of question text ----
      if (state === 'question') {
        qBuffer.push(line);
        continue;
      }

      // ---- Continuation of last option (multi-word option) ----
      if (state === 'options' && currentOpts.length > 0) {
        // Only append if it doesn't look like a new standalone element
        currentOpts[currentOpts.length - 1] += ' ' + line;
        continue;
      }
    }

    finishQuestion(); // flush final question

    // ---- FALLBACK: If state-machine got 0, try inline splitter ----
    if (questions.length === 0) {
      console.warn('State-machine got 0 questions — trying inline fallback parser');
      return fallbackInlineParser(rawText);
    }

    return questions;
  }

  // Fallback: treats the whole text as one long string and splits on numbers
  function fallbackInlineParser(rawText) {
    const text = rawText.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
    const questions = [];
    // Split on question-number boundaries
    const parts = text.split(/(?=\b\d{1,3}\s*[.)][\s])/);

    for (const part of parts) {
      if (part.trim().length < 20) continue;
      const clean = part.replace(/^\d+\s*[.)]\s*/, '').trim();

      // Find where options start
      const optIdx = clean.search(/\b[A-Da-d]\s*[.)]\s/);
      if (optIdx < 5) continue;

      const qText = clean.slice(0, optIdx).trim();
      const optBlock = clean.slice(optIdx);

      // Extract A B C D
      const opts = [];
      const optRx = /\b([A-Da-d])\s*[.)]\s*(.*?)(?=\b[A-Da-d]\s*[.)]|(?:Correct\s+)?Answer|$)/gi;
      let om;
      while ((om = optRx.exec(optBlock)) !== null) {
        const t = om[2].trim();
        if (t && !(/^(answer|correct)/i.test(t)) && opts.length < 4) opts.push(t);
      }

      const ansM = part.match(/(?:Correct\s+Answer|Answer)\s*[:\-]?\s*\(?([A-Da-d])\b/i);
      const ansIndex = ansM ? 'abcd'.indexOf(ansM[1].toLowerCase()) : -1;

      if (qText && opts.length >= 2) {
        questions.push({ q: qText, opts, ans: ansIndex >= 0 ? ansIndex : -1, accepted: true });
      }
    }
    return questions;
  }

  // ---- RENDER ----
  function renderParsedQuestions(data) {
    currentMcqData = data;
    questionsList.innerHTML = '';
    qCountEl.textContent = data.length;

    const labels = ['A', 'B', 'C', 'D'];

    data.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'mcq-item animate-fade-in';
      div.style.animationDelay = `${index * 0.06}s`;

      // If no valid answer was parsed, default to -1 (unselected)
      if (item.ans === undefined) item.ans = -1;

      let optsHtml = item.opts.map((opt, i) => `
        <li class="mcq-opt ${i === item.ans ? 'correct-option' : ''}" data-index="${i}" data-label="${labels[i]}" title="Click to mark as correct answer">
          ${opt}
        </li>`).join('');

      div.innerHTML = `
        <div class="mcq-content">
          <h4>Q${index + 1}. ${item.q}</h4>
          ${item.ans === -1 ? '<p style="color:var(--danger); font-size:0.8rem; margin-bottom:0.5rem; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Please select the correct answer below</p>' : ''}
          <div style="display:flex; gap:1rem; margin-bottom:0.75rem; align-items:center; flex-wrap:wrap;">
            <div style="font-size:0.85rem; color:var(--text-secondary);"><label>Points: </label><input type="number" class="q-points" value="${item.points || 1}" min="0" step="1" style="width:50px; padding:2px; border:1px solid var(--glass-border); border-radius:4px; background:var(--glass-bg); color:var(--text-primary);"></div>
            <div style="font-size:0.85rem; color:var(--text-secondary);"><label>Negative: </label><input type="number" class="q-negative" value="${item.negative || 0}" min="0" step="0.25" style="width:50px; padding:2px; border:1px solid var(--glass-border); border-radius:4px; background:var(--glass-bg); color:var(--text-primary);"></div>
            <div style="font-size:0.85rem; color:var(--text-secondary);"><label>Partial credit: </label><input type="number" class="q-partial" value="${item.partialCredit || 0}" min="0" step="0.25" style="width:50px; padding:2px; border:1px solid var(--glass-border); border-radius:4px; background:var(--glass-bg); color:var(--text-primary);"></div>
            <div style="font-size:0.85rem; color:var(--text-secondary);"><label><i class="fa-solid fa-stopwatch"></i> Time (sec): </label><input type="number" class="q-timelimit" value="${item.timeLimit || 0}" min="0" step="5" placeholder="0=unlimited" style="width:60px; padding:2px; border:1px solid var(--glass-border); border-radius:4px; background:var(--glass-bg); color:var(--text-primary);"></div>
          </div>
          <div style="margin-bottom:0.75rem;">
            <div style="font-size:0.85rem; color:var(--text-secondary);"><label>Media URL <span style="font-size:0.75rem;">(YouTube, Image, or Audio)</span>: </label><input type="url" class="q-media" value="${item.mediaUrl || ''}" placeholder="https://..." style="width:100%; max-width:400px; padding:4px 6px; border:1px solid var(--glass-border); border-radius:4px; background:var(--glass-bg); color:var(--text-primary); font-size:0.85rem;"></div>
          </div>
          <ul class="mcq-options">${optsHtml}</ul>
        </div>
        <div class="mcq-actions">
          <button class="btn-icon btn-accept active" title="Accept this question">
            <i class="fa-solid fa-check"></i>
          </button>
          <button class="btn-icon btn-reject" title="Reject this question">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;

      questionsList.appendChild(div);

      // ---- Wire up Options ----
      const optEls = div.querySelectorAll('.mcq-opt');
      optEls.forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          // Remove correct class from all
          optEls.forEach(o => o.classList.remove('correct-option'));
          // Add to clicked
          el.classList.add('correct-option');
          item.ans = parseInt(el.getAttribute('data-index'), 10);
          
          // Remove the warning message if it exists
          const warningMsg = div.querySelector('.mcq-content p');
          if (warningMsg) warningMsg.remove();
        });
      });

      // ---- Wire up buttons AFTER appending to DOM ----
      const acceptBtn = div.querySelector('.btn-accept');
      const rejectBtn = div.querySelector('.btn-reject');

      acceptBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.accepted = true;
        div.classList.remove('rejected');
        acceptBtn.classList.add('active');
        rejectBtn.classList.remove('active');
      });

      rejectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.accepted = false;
        div.classList.add('rejected');
        rejectBtn.classList.add('active');
        acceptBtn.classList.remove('active');
      });
    });
  }

  // ---- PUBLISH MCQ ----
  const inviteBanner   = document.getElementById('invite-banner');
  const inviteCodeText = document.getElementById('invite-code-text');
  const copyCodeBtn    = document.getElementById('copy-invite-code-btn');
  const copyLinkBtn    = document.getElementById('copy-invite-link-btn');

  function showInviteBanner(assessment) {
    if (!inviteBanner || !inviteCodeText) return;
    inviteCodeText.textContent = assessment.inviteCode || '------';
    inviteBanner.classList.remove('hidden');
  }

  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(inviteCodeText.textContent);
      window.Toast.show('Invite code copied to clipboard!');
    });
  }

  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
      const base = window.location.href.replace('faculty.html', 'student.html');
      const link = `${base}?code=${inviteCodeText.textContent}`;
      navigator.clipboard.writeText(link);
      window.Toast.show('Student invite link copied!');
    });
  }

  if (publishMcqBtn) {
    publishMcqBtn.addEventListener('click', () => {
      const accepted = [];
      const itemNodes = Array.from(questionsList.children);
      
      currentMcqData.forEach((q, idx) => {
        if (q.accepted) {
          const node = itemNodes[idx];
          const points = parseFloat(node.querySelector('.q-points')?.value || 1);
          const negative = parseFloat(node.querySelector('.q-negative')?.value || 0);
          const partialCredit = parseFloat(node.querySelector('.q-partial')?.value || 0);
          const mediaUrl = node.querySelector('.q-media')?.value.trim() || '';
          const timeLimit = parseInt(node.querySelector('.q-timelimit')?.value) || 0;
          accepted.push({ ...q, points, negative, partialCredit, mediaUrl, timeLimit });
        }
      });

      if (accepted.length === 0) {
        window.Toast.show('Accept at least one question first.', 'error');
        return;
      }
      
      const unselected = accepted.filter(q => q.ans === -1);
      if (unselected.length > 0) {
        window.Toast.show('Please select a correct answer for all accepted questions.', 'error');
        return;
      }
      
      const title = document.getElementById('mcq-title').value.trim() || 'MCQ Assessment';
      const settings = {
        proctoring: document.getElementById('mcq-proctor')?.value || 'strict',
        allowTab: document.getElementById('mcq-allow-tab')?.checked || false,
        allowPaste: document.getElementById('mcq-allow-paste')?.checked || false,
        publishResult: document.getElementById('mcq-publish-res')?.checked ?? true,
        allowReview: document.getElementById('mcq-allow-review')?.checked || false,
        duration: parseInt(document.getElementById('mcq-duration')?.value) || 30,
        minTime: parseInt(document.getElementById('mcq-min-time')?.value) || 0,
        startTime: document.getElementById('mcq-start-time')?.value || '',
        endTime: document.getElementById('mcq-end-time')?.value || '',
        randomize: document.getElementById('mcq-randomize')?.checked || false,
        shuffleOptions: document.getElementById('mcq-shuffle-opts')?.checked || false,
        questionsPerStudent: parseInt(document.getElementById('mcq-q-count')?.value) || 0
      };
      const saved = window.DB.saveAssessment({ title, type: 'mcq', questions: accepted, settings });
      // Get the saved assessment to show its invite code
      const allAssessments = window.DB.getAssessments();
      const savedAssessment = allAssessments.find(a => a.id === saved) || allAssessments[allAssessments.length - 1];
      window.Toast.show(`"${title}" published! Code: ${savedAssessment.inviteCode}`);
      showInviteBanner(savedAssessment);
      // Reset
      document.getElementById('mcq-title').value = '';
      uploadZone.classList.remove('hidden');
      uploadZoneWrap.classList.remove('hidden');
      pasteZoneWrap.classList.add('hidden');
      csvZoneWrap.classList.add('hidden');
      tabPdf.classList.add('active');
      tabPaste.classList.remove('active');
      tabCsv.classList.remove('active');
      extractedBox.classList.add('hidden');
      questionsList.innerHTML = '';
      currentMcqData = [];
      fileUpload.value = '';
      pasteInput.value = '';
    });
  }

  // =====================================================
  // 3. CASE BASED SECTION
  // =====================================================
  const caseContainer = document.getElementById('case-questions-container');
  const addCaseQBtn   = document.getElementById('add-case-q-btn');
  const publishCaseBtn = document.getElementById('publish-case-btn');
  let caseQCount = 0;

  function addCaseQuestion() {
    caseQCount++;
    const div = document.createElement('div');
    div.className = 'question-card animate-fade-in';

    div.innerHTML = `
      <div class="question-card-header">
        <h4><i class="fa-solid fa-circle-question"></i> Question ${caseQCount}</h4>
        <button class="btn-remove-card" title="Remove"><i class="fa-solid fa-trash"></i></button>
      </div>
      <div class="form-group">
        <label>Question Text</label>
        <input type="text" class="form-control case-q-text" placeholder="e.g. What strategy should the company adopt?">
      </div>
      <div class="form-group">
        <label>Model Answer / Marking Rubric</label>
        <textarea class="form-control case-q-ans" rows="3" placeholder="Enter expected answer keywords, or full model answer..."></textarea>
      </div>
    `;
    caseContainer.appendChild(div);

    div.querySelector('.btn-remove-card').addEventListener('click', () => {
      div.remove();
      caseQCount--;
    });
  }

  // Initialize with 1 question
  addCaseQuestion();

  if (addCaseQBtn) {
    addCaseQBtn.addEventListener('click', addCaseQuestion);
  }

  if (publishCaseBtn) {
    publishCaseBtn.addEventListener('click', () => {
      const title   = document.getElementById('case-title').value.trim() || 'Case Study Assessment';
      const content = document.getElementById('case-content').value.trim();
      if (!content) { window.Toast.show('Please add case study content.', 'error'); return; }

      const questions = [];
      caseContainer.querySelectorAll('.question-card').forEach(card => {
        const q = card.querySelector('.case-q-text')?.value.trim();
        const a = card.querySelector('.case-q-ans')?.value.trim();
        if (q) questions.push({ q, ans: a || '' });
      });

      if (questions.length === 0) { window.Toast.show('Add at least one question.', 'error'); return; }

      const settings = {
        proctoring: document.getElementById('case-proctor')?.value || 'strict',
        allowTab: document.getElementById('case-allow-tab')?.checked || false,
        allowPaste: document.getElementById('case-allow-paste')?.checked || false,
        publishResult: document.getElementById('case-publish-res')?.checked ?? true,
        allowReview: document.getElementById('case-allow-review')?.checked || false,
        duration: parseInt(document.getElementById('case-duration')?.value) || 45,
        minTime: parseInt(document.getElementById('case-min-time')?.value) || 0,
        startTime: document.getElementById('case-start-time')?.value || '',
        endTime: document.getElementById('case-end-time')?.value || ''
      };
      const savedId = window.DB.saveAssessment({ title, type: 'case', content, questions, settings });
      const savedA  = window.DB.getAssessments().find(a => a.id === savedId) || window.DB.getAssessments().at(-1);
      window.Toast.show(`"${title}" published! Code: ${savedA.inviteCode}`);
      showInviteBanner(savedA);
      // Reset
      document.getElementById('case-title').value = '';
      document.getElementById('case-content').value = '';
      caseContainer.innerHTML = '';
      caseQCount = 0;
      addCaseQuestion();
    });
  }

  // =====================================================
  // 4. CODING SECTION
  // =====================================================
  const codingContainer  = document.getElementById('coding-questions-container');
  const addCodingQBtn    = document.getElementById('add-coding-q-btn');
  const publishCodingBtn = document.getElementById('publish-coding-btn');
  let codingQCount = 0;

  function addCodingProblem() {
    codingQCount++;
    const div = document.createElement('div');
    div.className = 'question-card animate-fade-in';

    div.innerHTML = `
      <div class="question-card-header">
        <h4><i class="fa-solid fa-terminal"></i> Problem ${codingQCount}</h4>
        <button class="btn-remove-card" title="Remove"><i class="fa-solid fa-trash"></i></button>
      </div>
      <div class="form-group" style="display:flex; gap:1rem;">
        <div style="flex:1;">
          <label>Problem Title</label>
          <input type="text" class="form-control coding-prob-title" placeholder="e.g. Two Sum or Web App">
        </div>
        <div style="width:250px;">
          <label>Problem Type</label>
          <select class="form-control coding-prob-type">
            <option value="algo">Standard Algorithm</option>
            <option value="web">Web Project (HTML/CSS/JS)</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Problem Statement</label>
        <textarea class="form-control coding-prob-desc" rows="4" placeholder="Describe the problem, constraints, and examples..."></textarea>
      </div>
      
      <!-- Standard Algorithm Fields -->
      <div class="grid-2 coding-algo-fields">
        <div class="form-group">
          <label>Sample Input</label>
          <textarea class="form-control code-font coding-prob-in" rows="3" placeholder="nums = [2,7,11,15]\ntarget = 9"></textarea>
        </div>
        <div class="form-group">
          <label>Expected Output</label>
          <textarea class="form-control code-font coding-prob-out" rows="3" placeholder="[0, 1]"></textarea>
        </div>
      </div>

      <!-- Web Project Boilerplate Fields (Hidden by default) -->
      <div class="coding-web-fields hidden">
        <div class="form-group">
          <label>HTML Boilerplate</label>
          <textarea class="form-control code-font coding-prob-html" rows="3" placeholder="<h1>Hello World</h1>"></textarea>
        </div>
        <div class="form-group">
          <label>CSS Boilerplate</label>
          <textarea class="form-control code-font coding-prob-css" rows="3" placeholder="h1 { color: red; }"></textarea>
        </div>
        <div class="form-group">
          <label>JS Boilerplate</label>
          <textarea class="form-control code-font coding-prob-js" rows="3" placeholder="console.log('Started');"></textarea>
        </div>
      </div>
    `;
    codingContainer.appendChild(div);

    // Toggle fields based on type
    const typeSelect = div.querySelector('.coding-prob-type');
    const algoFields = div.querySelector('.coding-algo-fields');
    const webFields = div.querySelector('.coding-web-fields');
    
    typeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'web') {
        algoFields.classList.add('hidden');
        webFields.classList.remove('hidden');
      } else {
        algoFields.classList.remove('hidden');
        webFields.classList.add('hidden');
      }
    });

    div.querySelector('.btn-remove-card').addEventListener('click', () => {
      div.remove();
      codingQCount--;
    });
  }

  // Initialize with 1 problem
  addCodingProblem();

  if (addCodingQBtn) {
    addCodingQBtn.addEventListener('click', addCodingProblem);
  }

  if (publishCodingBtn) {
    publishCodingBtn.addEventListener('click', () => {
      const title = document.getElementById('coding-title-main').value.trim() || 'Coding Assessment';
      const questions = [];
      codingContainer.querySelectorAll('.question-card').forEach(card => {
        const type = card.querySelector('.coding-prob-type')?.value || 'algo';
        questions.push({
          title: card.querySelector('.coding-prob-title')?.value.trim() || 'Problem',
          desc:  card.querySelector('.coding-prob-desc')?.value.trim() || '',
          probType: type,
          input: card.querySelector('.coding-prob-in')?.value.trim() || '',
          output: card.querySelector('.coding-prob-out')?.value.trim() || '',
          htmlTemplate: card.querySelector('.coding-prob-html')?.value || '',
          cssTemplate: card.querySelector('.coding-prob-css')?.value || '',
          jsTemplate: card.querySelector('.coding-prob-js')?.value || ''
        });
      });

      if (questions.length === 0) { window.Toast.show('Add at least one problem.', 'error'); return; }

      const settings = {
        proctoring: document.getElementById('coding-proctor')?.value || 'strict',
        allowTab: document.getElementById('coding-allow-tab')?.checked || false,
        allowPaste: document.getElementById('coding-allow-paste')?.checked || false,
        publishResult: document.getElementById('coding-publish-res')?.checked ?? true,
        allowReview: document.getElementById('coding-allow-review')?.checked || false,
        duration: parseInt(document.getElementById('coding-duration')?.value) || 60,
        minTime: parseInt(document.getElementById('coding-min-time')?.value) || 0,
        startTime: document.getElementById('coding-start-time')?.value || '',
        endTime: document.getElementById('coding-end-time')?.value || ''
      };
      const savedId = window.DB.saveAssessment({ title, type: 'coding', questions, settings });
      const savedA  = window.DB.getAssessments().find(a => a.id === savedId) || window.DB.getAssessments().at(-1);
      window.Toast.show(`"${title}" published! Code: ${savedA.inviteCode}`);
      showInviteBanner(savedA);
      document.getElementById('coding-title-main').value = '';
      codingContainer.innerHTML = '';
      codingQCount = 0;
      addCodingProblem();
    });
  }

  // =====================================================
  // 5. MATCHING SECTION
  // =====================================================
  const matchContainer = document.getElementById('match-pairs-container');
  const addMatchPairBtn = document.getElementById('add-match-pair-btn');
  const publishMatchBtn = document.getElementById('publish-match-btn');
  let matchPairCount = 0;

  function addMatchPair() {
    matchPairCount++;
    const div = document.createElement('div');
    div.className = 'question-card animate-fade-in';

    div.innerHTML = `
      <div class="question-card-header">
        <h4><i class="fa-solid fa-link"></i> Pair ${matchPairCount}</h4>
        <button class="btn-remove-card" title="Remove"><i class="fa-solid fa-trash"></i></button>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Left Item (e.g. Term)</label>
          <input type="text" class="form-control match-prob-left" placeholder="e.g. Mitochondria">
        </div>
        <div class="form-group">
          <label>Right Item (e.g. Definition)</label>
          <input type="text" class="form-control match-prob-right" placeholder="e.g. Powerhouse of the cell">
        </div>
      </div>
    `;
    matchContainer.appendChild(div);

    div.querySelector('.btn-remove-card').addEventListener('click', () => {
      div.remove();
      matchPairCount--;
    });
  }

  if (matchContainer) {
    // Initialize with 3 pairs
    for(let i=0; i<3; i++) addMatchPair();
  }

  if (addMatchPairBtn) {
    addMatchPairBtn.addEventListener('click', addMatchPair);
  }

  if (publishMatchBtn) {
    publishMatchBtn.addEventListener('click', () => {
      const title = document.getElementById('match-title-main').value.trim() || 'Matching Assessment';
      const pairs = [];
      matchContainer.querySelectorAll('.question-card').forEach(card => {
        const left = card.querySelector('.match-prob-left')?.value.trim();
        const right = card.querySelector('.match-prob-right')?.value.trim();
        if (left && right) {
          pairs.push({ left, right });
        }
      });

      if (pairs.length < 2) { window.Toast.show('Add at least two valid pairs.', 'error'); return; }

      const settings = {
        proctoring: document.getElementById('match-proctor')?.value || 'strict',
        allowTab: document.getElementById('match-allow-tab')?.checked || false,
        publishResult: document.getElementById('match-publish-res')?.checked ?? true,
        allowReview: document.getElementById('match-allow-review')?.checked || false,
        duration: parseInt(document.getElementById('match-duration')?.value) || 15,
        minTime: parseInt(document.getElementById('match-min-time')?.value) || 0,
      };
      
      const savedId = window.DB.saveAssessment({ title, type: 'match', pairs, settings });
      const savedA  = window.DB.getAssessments().find(a => a.id === savedId) || window.DB.getAssessments().at(-1);
      window.Toast.show(`"${title}" published! Code: ${savedA.inviteCode}`);
      showInviteBanner(savedA);
      
      document.getElementById('match-title-main').value = '';
      matchContainer.innerHTML = '';
      matchPairCount = 0;
      for(let i=0; i<3; i++) addMatchPair();
    });
  }

  // =====================================================
  // 6. SUBMISSION LOGS DASHBOARD
  // =====================================================
  const logsTableBody = document.getElementById('logs-table-body');
  const statsTotal    = document.getElementById('stats-total');
  const statsFlagged  = document.getElementById('stats-flagged');
  const clearLogsBtn  = document.getElementById('clear-logs-btn');
  const navLogs       = document.getElementById('nav-logs');

  function loadSubmissionLogs() {
    if (!logsTableBody) return;
    const submissions = window.DB ? window.DB.getSubmissions() : [];
    logsTableBody.innerHTML = '';

    statsTotal.textContent = submissions.length;
    const flaggedCount = submissions.filter(s => s.violations && s.violations.length > 0).length;
    statsFlagged.textContent = flaggedCount;

    if (submissions.length === 0) {
      logsTableBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:var(--text-secondary); padding:2rem;">No submissions recorded yet.</td></tr>`;
      return;
    }

    submissions.forEach(sub => {
      const tr = document.createElement('tr');

      const nameHtml = `<strong>${sub.studentName || 'Student'}</strong>${sub.studentEmail ? `<br><span style="font-size:0.8rem;color:var(--text-secondary)">${sub.studentEmail}</span>` : ''}`;
      
      let flagStatusHtml = sub.violations && sub.violations.length > 0
        ? `<span class="violation-tag"><i class="fa-solid fa-triangle-exclamation"></i> Flagged (${sub.violations.length})</span>`
        : `<span class="violation-tag-clean"><i class="fa-solid fa-circle-check"></i> Clean</span>`;

      let timelineHtml = '<span style="color:var(--text-secondary);font-size:0.85rem;">No violations.</span>';
      if (sub.violations && sub.violations.length > 0) {
        timelineHtml = sub.violations.map(v => {
          // Check if violation has an appeal appended
          const parts = v.split(' | Appeal: ');
          const flagText = parts[0];
          const appealText = parts[1];
          let html = `<div style="font-size:0.8rem; color:var(--danger); margin-bottom:0.3rem;"><i class="fa-solid fa-circle-exclamation"></i> ${flagText}</div>`;
          if (appealText) {
            html += `<div style="font-size:0.78rem; color:var(--warning); margin-left:1rem; margin-bottom:0.3rem;"><i class="fa-solid fa-comment"></i> Appeal: "${appealText}"</div>`;
          }
          return html;
        }).join('');
      }

      tr.innerHTML = `
        <td>${nameHtml}</td>
        <td>${sub.assessmentTitle || 'Untitled'}</td>
        <td><strong style="color:var(--accent-primary)">${sub.score || 'N/A'}</strong></td>
        <td>${flagStatusHtml}</td>
        <td>${timelineHtml}</td>
      `;
      logsTableBody.appendChild(tr);
    });
  }

  if (navLogs) {
    navLogs.addEventListener('click', loadSubmissionLogs);
  }

  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
      if (confirm('Clear all submission logs? This cannot be undone.')) {
        window.DB && window.DB.clearSubmissions();
        loadSubmissionLogs();
        window.Toast.show('All submission logs cleared!');
      }
    });
  }

  // ---- CSV Export ----
  const exportCsvBtn = document.getElementById('export-csv-btn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const submissions = window.DB ? window.DB.getSubmissions() : [];
      if (submissions.length === 0) {
        window.Toast.show('No submissions to export.', 'error');
        return;
      }

      const headers = ['Student Name', 'Email', 'Assessment', 'Score', 'Violations', 'Appeals', 'Submitted At'];
      const rows = submissions.map(sub => {
        const violations = (sub.violations || []).filter(v => !v.includes('| Appeal:')).join('; ');
        const appeals = (sub.violations || [])
          .filter(v => v.includes('| Appeal:'))
          .map(v => v.split('| Appeal:')[1]?.trim())
          .filter(Boolean)
          .join('; ');
        return [
          sub.studentName || 'Student',
          sub.studentEmail || '',
          sub.assessmentTitle || '',
          sub.score || '',
          violations,
          appeals,
          sub.submittedAt || ''
        ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `torpedo_submissions_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      window.Toast.show('CSV exported successfully!');
    });
  }

});

// --- 6. LIVE COMMAND CENTER (Cross-Tab Sync) ---
const liveFeedList = document.getElementById('live-feed-list');
const liveFeedGrid = document.getElementById('live-feed-grid');

// Polling for video screen share frames in localStorage
setInterval(() => {
  if (!liveFeedGrid || document.querySelector('.assessment-section.active')?.id !== 'live-section') return;
  
  const streams = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('torpedo_stream_')) {
      try {
        const val = JSON.parse(localStorage.getItem(key));
        if (Date.now() - val.ts < 10000) { // Only show active streams (< 10 seconds old)
          streams.push({ key, ...val });
        }
      } catch(e){}
    }
  }

  if (streams.length === 0) {
    liveFeedGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fa-solid fa-check-double" style="font-size: 2rem; color: var(--success); margin-bottom: 0.5rem; display:block;"></i>
        No active students currently sharing their screen.
      </div>
    `;
    return;
  }

  // Check if we need to completely rebuild to avoid flickering or just update existing
  const currentImgs = Array.from(liveFeedGrid.querySelectorAll('.screen-stream-card'));
  
  if (currentImgs.length === 0 || currentImgs.length !== streams.length) {
    liveFeedGrid.innerHTML = streams.map(s => {
      const studentId = s.key.replace('torpedo_stream_', '');
      return `
      <div class="screen-stream-card glass-panel" data-key="${s.key}" style="padding:0.5rem; display:flex; flex-direction:column; gap:0.5rem; animation:fadeIn 0.3s ease-out;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem;">
          <strong>${s.name}</strong>
          <span style="color:var(--success); font-size:0.75rem;"><i class="fa-solid fa-circle fa-beat-fade"></i> Live</span>
        </div>
        <img src="${s.img}" id="img-${s.key}" style="width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:4px; border:1px solid var(--glass-border); background:#000;">
        <div style="display:flex; gap:0.5rem; margin-top:0.25rem;">
          <button class="btn btn-outline btn-sm faculty-warn-btn" data-student="${studentId}" style="flex:1; font-size:0.75rem; padding:0.3rem;"><i class="fa-solid fa-triangle-exclamation"></i> Warn</button>
          <button class="btn btn-danger btn-sm faculty-kick-btn" data-student="${studentId}" style="flex:1; font-size:0.75rem; padding:0.3rem;"><i class="fa-solid fa-ban"></i> Kick</button>
        </div>
      </div>
    `;
    }).join('');

    // Wire up Warn/Kick buttons
    liveFeedGrid.querySelectorAll('.faculty-warn-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.student;
        localStorage.setItem('torpedo_faculty_action_' + sid, JSON.stringify({ action: 'warn', message: 'Please keep your eyes on the screen.', ts: Date.now() }));
        window.Toast.show('Warning sent to student!');
      });
    });
    liveFeedGrid.querySelectorAll('.faculty-kick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.student;
        if (confirm('Terminate this student\'s exam? This cannot be undone.')) {
          localStorage.setItem('torpedo_faculty_action_' + sid, JSON.stringify({ action: 'kick', ts: Date.now() }));
          window.Toast.show('Student exam terminated!', 'error');
        }
      });
    });
  } else {
    // Just update src to prevent reflow flicker
    streams.forEach(s => {
      const img = document.getElementById(`img-${s.key}`);
      if (img) img.src = s.img;
    });
  }
}, 2000);

window.addEventListener('storage', (e) => {
  if (e.key === 'torpedo_live_event') {
    if (!e.newValue) return;
    const data = JSON.parse(e.newValue);
    
    // Remove empty state if present
    const empty = liveFeedList?.querySelector('.empty-state');
    if (empty) empty.remove();
    
    const div = document.createElement('div');
    div.className = `live-event ${data.type === 'progress' ? 'progress' : 'flag'}`;
    
    const icon = data.type === 'progress' ? '<i class="fa-solid fa-spinner fa-spin-pulse"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
    
    div.innerHTML = `
      <div class="live-event-info">
        <span class="live-event-time">${data.time}</span>
        <span><strong>${data.student}</strong></span>
        <span class="live-event-reason">${icon} ${data.message}</span>
      </div>
    `;
    
    if (liveFeedList) liveFeedList.prepend(div);
    
    // Show toast for flags
    if (data.type === 'flag') {
      window.Toast.show(`ALERT: ${data.student} - ${data.message}`, 'error');
      
      // Flash the live section icon if not currently viewing it
      const liveNavIcon = document.querySelector('li[data-target="live-section"] i');
      if (liveNavIcon && document.querySelector('.assessment-section.active')?.id !== 'live-section') {
        liveNavIcon.classList.add('fa-beat-fade');
        setTimeout(() => liveNavIcon.classList.remove('fa-beat-fade'), 5000);
      }
    }
  }
});
