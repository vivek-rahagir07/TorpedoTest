/* =====================================================
   FACULTY PORTAL — JS
   Fully functional: PDF parsing, MCQ, Case, Coding
   ===================================================== */

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

  // ---- PARSER ----
  function parseQuestionsFromText(rawText) {
    // Normalize: collapse multiple spaces/newlines to a single space
    let text = rawText.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

    const questions = [];

    // Split text into question blocks by finding "1." "2." "1)" "Q1." etc.
    // Strategy: split on question-number patterns, then parse each block
    const blocks = splitIntoBlocks(text);

    for (const block of blocks) {
      const q = parseBlock(block);
      if (q) questions.push(q);
    }
    return questions;
  }

  function splitIntoBlocks(text) {
    // Match start of a new question: number followed by . or ) at start or after newline
    const qStartRegex = /(?:^|\n)\s*(?:Q\.?\s*)?\d+\s*[.)]/g;
    const positions = [];
    let m;
    while ((m = qStartRegex.exec(text)) !== null) {
      positions.push(m.index + (m[0].startsWith('\n') ? 1 : 0));
    }

    const blocks = [];
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i];
      const end   = positions[i + 1] ?? text.length;
      blocks.push(text.slice(start, end).trim());
    }
    return blocks;
  }

  function parseBlock(block) {
    if (block.length < 15) return null;

    // Remove leading question number
    let text = block.replace(/^(?:Q\.?\s*)?\d+\s*[.)]\s*/, '').trim();

    // Find where options start: look for first A. or A) or (A)
    const optStartRegex = /(?:^|\n|\s)\(?[A-Da-d]\s*[.)]\s/;
    const optStartMatch = optStartRegex.exec(text);
    if (!optStartMatch) return null;

    const qText = text.slice(0, optStartMatch.index).trim();
    if (qText.length < 5) return null;

    const optionsBlock = text.slice(optStartMatch.index).trim();

    // Extract each option
    const optRegex = /(?:^|\n|\s)\(?([A-Da-d])\s*[.)]\s*(.*?)(?=(?:\n|\s)\(?[A-Da-d]\s*[.)]|\bAnswer|\bCorrect|$)/gis;
    const opts = [];
    let om;
    while ((om = optRegex.exec(optionsBlock)) !== null) {
      const optText = om[2].trim();
      if (optText.length === 0) continue;
      if (/^(answer|correct)/i.test(optText)) break;
      if (opts.length >= 4) break;
      opts.push(optText);
    }

    if (opts.length < 2) return null;

    // Find correct answer
    const answerMatch = block.match(/(?:Correct\s+Answer|Answer)\s*[:\-]?\s*\(?([A-Da-d])\b/i);
    let ansIndex = -1;
    if (answerMatch) {
      const ch = answerMatch[1].toLowerCase();
      ansIndex = 'abcd'.indexOf(ch);
    }

    return { q: qText, opts, ans: ansIndex >= 0 ? ansIndex : 0, accepted: true };
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

      let optsHtml = item.opts.map((opt, i) => `
        <li class="${i === item.ans ? 'correct-option' : ''}" data-label="${labels[i]}">
          ${opt}
        </li>`).join('');

      div.innerHTML = `
        <div class="mcq-content">
          <h4>Q${index + 1}. ${item.q}</h4>
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

      // ---- FIX: Wire up buttons AFTER appending to DOM ----
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
  if (publishMcqBtn) {
    publishMcqBtn.addEventListener('click', () => {
      const accepted = currentMcqData.filter(q => q.accepted);
      if (accepted.length === 0) {
        window.Toast.show('Accept at least one question first.', 'error');
        return;
      }
      const title = document.getElementById('mcq-title').value.trim() || 'MCQ Assessment';
      window.DB.saveAssessment({ title, type: 'mcq', questions: accepted });
      window.Toast.show(`"${title}" published with ${accepted.length} questions!`);
      // Reset
      uploadZone.classList.remove('hidden');
      extractedBox.classList.add('hidden');
      questionsList.innerHTML = '';
      currentMcqData = [];
      fileUpload.value = '';
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

      window.DB.saveAssessment({ title, type: 'case', content, questions });
      window.Toast.show(`"${title}" published with ${questions.length} questions!`);
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
      <div class="form-group">
        <label>Problem Title</label>
        <input type="text" class="form-control coding-prob-title" placeholder="e.g. Two Sum">
      </div>
      <div class="form-group">
        <label>Problem Statement</label>
        <textarea class="form-control coding-prob-desc" rows="4" placeholder="Describe the problem, constraints, and examples..."></textarea>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Sample Input</label>
          <textarea class="form-control code-font coding-prob-in" rows="3" placeholder="nums = [2,7,11,15]\ntarget = 9"></textarea>
        </div>
        <div class="form-group">
          <label>Expected Output</label>
          <textarea class="form-control code-font coding-prob-out" rows="3" placeholder="[0, 1]"></textarea>
        </div>
      </div>
    `;
    codingContainer.appendChild(div);

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
        questions.push({
          title: card.querySelector('.coding-prob-title')?.value.trim() || 'Problem',
          desc:  card.querySelector('.coding-prob-desc')?.value.trim() || '',
          input: card.querySelector('.coding-prob-in')?.value.trim() || '',
          output: card.querySelector('.coding-prob-out')?.value.trim() || ''
        });
      });

      if (questions.length === 0) { window.Toast.show('Add at least one problem.', 'error'); return; }

      window.DB.saveAssessment({ title, type: 'coding', questions });
      window.Toast.show(`"${title}" published with ${questions.length} problem(s)!`);
      document.getElementById('coding-title-main').value = '';
      codingContainer.innerHTML = '';
      codingQCount = 0;
      addCodingProblem();
    });
  }

});
