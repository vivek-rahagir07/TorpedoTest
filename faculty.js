document.addEventListener('DOMContentLoaded', () => {
  // --- Navigation & Section Switching ---
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.assessment-section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(nav => nav.classList.remove('active'));
      sections.forEach(sec => {
        sec.classList.remove('active');
        sec.classList.add('hidden');
      });

      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add('active');
        targetSection.classList.remove('hidden');
      }
    });
  });

  // --- MCQ Mock Parsing Logic ---
  const fileUpload = document.getElementById('file-upload');
  const uploadZone = document.getElementById('upload-zone');
  const loader = document.getElementById('parsing-loader');
  const extractedContainer = document.getElementById('extracted-questions');
  const questionsList = document.getElementById('questions-list');
  const publishMcqBtn = document.getElementById('publish-mcq-btn');

  let currentMcqData = [];

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileUpload.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFileUpload(e.target.files[0]);
    }
  });

  function handleFileUpload(file) {
    if (file.type !== 'application/pdf') {
      window.Toast.show('Only PDF files are currently supported for parsing.', 'error');
      return;
    }

    uploadZone.classList.add('hidden');
    loader.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = async function() {
      try {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + "\\n";
        }

        console.log("--- PDF EXTRACTED TEXT ---");
        console.log(fullText);
        console.log("--------------------------");

        const parsedQuestions = parseQuestionsFromText(fullText);
        console.log("Parsed Questions:", parsedQuestions);
        
        loader.classList.add('hidden');
        if (parsedQuestions.length > 0) {
          renderParsedQuestions(parsedQuestions);
          extractedContainer.classList.remove('hidden');
          window.Toast.show(`Successfully extracted ${parsedQuestions.length} questions!`);
        } else {
          uploadZone.classList.remove('hidden');
          window.Toast.show('Could not find any standard questions in the PDF. Please check the formatting.', 'error');
        }
      } catch (err) {
        console.error(err);
        loader.classList.add('hidden');
        uploadZone.classList.remove('hidden');
        window.Toast.show('Error reading PDF file.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function parseQuestionsFromText(text) {
    const questions = [];
    
    // Normalize spaces and newlines
    text = text.replace(/\\s+/g, ' ');
    
    // Use (?:^|\\s) instead of \\b to be more robust against pdf.js spacing quirks
    const qRegex = /(?:(?:^|\\s)Q?\\d+\\s*[\\.\\)]\\s*)(.*?)(?=(?:(?:^|\\s)Q?\\d+\\s*[\\.\\)]|$))/g;
    let match;
    
    while ((match = qRegex.exec(text)) !== null) {
      const block = match[1];
      if (block.length < 10) continue; 
      
      const optRegex = /(?:^|\\s)(?:[A-D]|[a-d])\\s*[\\.\\)]\\s*(.*?)(?=(?:^|\\s)(?:[A-D]|[a-d])\\s*[\\.\\)]|\\b(?:Correct\\s+)?Answer:|$)/gi;
      let opts = [];
      let optMatch;
      
      let qText = block.split(/(?:^|\\s)(?:[A-D]|[a-d])\\s*[\\.\\)]/i)[0].trim();
      
      while ((optMatch = optRegex.exec(block)) !== null) {
        const optionText = optMatch[1].trim();
        if (optionText.toLowerCase().includes('answer:')) break;
        if (opts.length >= 4) break; // Force maximum of 4 options to prevent bleeding
        if (optionText.length > 0) opts.push(optionText);
      }
      
      let ansIndex = 0; 
      const ansMatch = block.match(/(?:Correct\\s+)?Answer:\\s*([A-D]|[a-d])/i);
      if (ansMatch) {
        const char = ansMatch[1].toLowerCase();
        if (char === 'a') ansIndex = 0;
        else if (char === 'b') ansIndex = 1;
        else if (char === 'c') ansIndex = 2;
        else if (char === 'd') ansIndex = 3;
      }
      
      if (qText && opts.length > 1) {
        questions.push({
          q: qText,
          opts: opts,
          ans: ansIndex,
          accepted: true
        });
      }
    }
    return questions;
  }

  function renderParsedQuestions(parsedData) {
    currentMcqData = parsedData;
    questionsList.innerHTML = '';
    
    currentMcqData.forEach((item, index) => {
      const qDiv = document.createElement('div');
      qDiv.className = 'mcq-item glass-panel animate-fade-in';
      qDiv.style.animationDelay = `${index * 0.1}s`;

      let optionsHTML = '';
      item.opts.forEach((opt, oIdx) => {
        const isCorrect = oIdx === item.ans ? 'correct-option' : '';
        optionsHTML += `<li class="${isCorrect}">${opt}</li>`;
      });

      qDiv.innerHTML = `
        <div class="mcq-content">
          <h4>Q${index + 1}: ${item.q}</h4>
          <ul class="mcq-options">
            ${optionsHTML}
          </ul>
        </div>
        <div class="mcq-actions">
          <button class="btn-icon btn-accept active" title="Accept"><i class="fa-solid fa-check"></i></button>
          <button class="btn-icon btn-reject" title="Reject"><i class="fa-solid fa-xmark"></i></button>
        </div>
      `;

      questionsList.appendChild(qDiv);

      const btnAccept = qDiv.querySelector('.btn-accept');
      const btnReject = qDiv.querySelector('.btn-reject');

      btnAccept.addEventListener('click', () => {
        btnAccept.classList.add('active');
        btnReject.classList.remove('active');
        qDiv.style.opacity = '1';
        item.accepted = true;
      });

      btnReject.addEventListener('click', () => {
        btnReject.classList.add('active');
        btnAccept.classList.remove('active');
        qDiv.style.opacity = '0.5';
        item.accepted = false;
      });
    });
  }

  if (publishMcqBtn) {
    publishMcqBtn.addEventListener('click', () => {
      const finalQuestions = currentMcqData.filter(q => q.accepted);
      
      const assessment = {
        title: "Parsed MCQ Assessment",
        type: "mcq",
        questions: finalQuestions
      };
      
      window.DB.saveAssessment(assessment);
      window.Toast.show("MCQ Assessment Published Successfully!");
      
      extractedContainer.classList.add('hidden');
      uploadZone.classList.remove('hidden');
    });
  }

  // --- Case Based Section ---
  const addCaseQBtn = document.getElementById('add-case-q-btn');
  const caseQContainer = document.getElementById('case-questions-container');
  const publishCaseBtn = document.getElementById('publish-case-btn');
  let caseQCount = 1;

  if (addCaseQBtn) {
    addCaseQBtn.addEventListener('click', () => {
      caseQCount++;
      const div = document.createElement('div');
      div.className = 'question-card glass-panel animate-fade-in';
      div.innerHTML = `
        <div class="form-group">
          <label>Question ${caseQCount}</label>
          <input type="text" class="form-control case-q-input" placeholder="Enter question">
        </div>
        <div class="form-group">
          <label>Expected Answer (Keywords/Rubric)</label>
          <textarea class="form-control case-q-ans" rows="2" placeholder="Keywords to look for in student's answer..."></textarea>
        </div>
      `;
      caseQContainer.appendChild(div);
    });
  }

  if (publishCaseBtn) {
    publishCaseBtn.addEventListener('click', () => {
      const title = document.getElementById('case-title').value || "Case Study Assessment";
      const content = document.getElementById('case-content').value;
      
      const qCards = caseQContainer.querySelectorAll('.question-card');
      const questions = [];
      qCards.forEach(card => {
        questions.push({
          q: card.querySelector('.case-q-input')?.value || "",
          ans: card.querySelector('.case-q-ans')?.value || ""
        });
      });
      
      window.DB.saveAssessment({
        title,
        type: "case",
        content,
        questions
      });
      window.Toast.show("Case Assessment Published!");
      
      // Reset
      document.getElementById('case-title').value = '';
      document.getElementById('case-content').value = '';
    });
  }

  // --- Coding Section ---
  const addCodingQBtn = document.getElementById('add-coding-q-btn');
  const codingQContainer = document.getElementById('coding-questions-container');
  const publishCodingBtn = document.getElementById('publish-coding-btn');

  if (addCodingQBtn) {
    addCodingQBtn.addEventListener('click', () => {
      const div = document.createElement('div');
      div.className = 'question-card glass-panel animate-fade-in';
      div.innerHTML = `
        <div class="form-group">
          <label>Problem Title</label>
          <input type="text" class="form-control coding-title" placeholder="e.g. Reverse String">
        </div>
        <div class="form-group">
          <label>Problem Statement</label>
          <textarea class="form-control coding-desc" rows="4" placeholder="Describe the problem, constraints, etc."></textarea>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>Sample Input</label>
            <textarea class="form-control code-font coding-in" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Expected Output</label>
            <textarea class="form-control code-font coding-out" rows="3"></textarea>
          </div>
        </div>
      `;
      codingQContainer.appendChild(div);
    });
  }

  if (publishCodingBtn) {
    publishCodingBtn.addEventListener('click', () => {
      const qCards = codingQContainer.querySelectorAll('.question-card');
      const questions = [];
      qCards.forEach(card => {
        questions.push({
          title: card.querySelector('.coding-title')?.value || "Coding Problem",
          desc: card.querySelector('.coding-desc')?.value || "",
          input: card.querySelector('.coding-in')?.value || "",
          output: card.querySelector('.coding-out')?.value || ""
        });
      });
      
      window.DB.saveAssessment({
        title: "Coding Assessment",
        type: "coding",
        questions
      });
      window.Toast.show("Coding Assessment Published!");
    });
  }
});
