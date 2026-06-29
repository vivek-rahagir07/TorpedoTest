const fs = require('fs');
let code = fs.readFileSync('/Users/vivek/Documents/GitHub/TorpedoTest/student.js', 'utf8');

// 1. Add globals for section timer
code = code.replace("let wakeLock = null;", "let wakeLock = null;\n  let activeSectionIndex = -1;\n  let sectionTimerInterval = null;\n  let sectionSecondsLeft = 0;");

// 2. Question Randomization
const randomBlock = `    // --- Question Randomization ---
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
    }`;
code = code.replace(/    \/\/ --- Question Randomization ---[\s\S]*?currentAssessment\.questions = qs;\n    \}/, randomBlock);

// 3. renderQuestion updates
const renderStart = `  function renderQuestion(index) {
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
    }`;
code = code.replace(/  function renderQuestion\(index\) \{[\s\S]*?const total = questions\.length;/, renderStart);

// 4. Update rType in renderQuestion
code = code.replace(/if \(currentAssessment\.type === 'mcq'\)/g, "const rType = qData._mixedType || currentAssessment.type;\n    if (rType === 'mcq')");
code = code.replace(/else if \(currentAssessment\.type === 'case'\)/g, "else if (rType === 'case')");
code = code.replace(/else if \(currentAssessment\.type === 'match'\)/g, "else if (rType === 'match')");
code = code.replace(/else if \(currentAssessment\.type === 'coding'\)/g, "else if (rType === 'coding')");

// 5. Update case content reference
code = code.replace(/currentAssessment\.content \|\| 'No case study content provided\.'/g, "(qData._caseContent || currentAssessment.content) || 'No case study content provided.'");

// 6. submitAssessment updates
const submitStart = `    if (currentAssessment.type === 'mcq' || currentAssessment.type === 'case' || currentAssessment.type === 'mixed') {
      let scoreNum = 0;
      let penaltyNum = 0;
      let maxScore = 0;
      
      currentAssessment.questions.forEach((q, i) => {
        const rType = q._mixedType || currentAssessment.type;
        const p = q.points !== undefined ? q.points : 1;
        const neg = q.negative !== undefined ? q.negative : 0;
        
        if (rType === 'mcq') {
            maxScore += p;
            if (studentAnswers[i] !== undefined) {
              if (studentAnswers[i] === q.ans) {
                scoreNum += p;
              } else {
                if (q.partialCredit > 0) scoreNum += q.partialCredit;
                else penaltyNum += neg;
              }
            }
        } else if (rType === 'case') {
            maxScore += p;
            const studentText = studentAnswers[i] || '';
            const modelAnswer = q.ans || '';
            const modelWords = modelAnswer.toLowerCase().split(/\\W+/).filter(w => w.length > 2);
            if (modelWords.length > 0) {
               let matches = 0;
               const studentTextLow = studentText.toLowerCase();
               modelWords.forEach(w => { if (studentTextLow.includes(w)) matches++; });
               const caseScore = Math.min(p, (matches / modelWords.length) * p);
               scoreNum += caseScore;
            } else {
               scoreNum += (studentText.length > 10 ? p : 0);
            }
        } else if (rType === 'coding') {
            maxScore += p; // Code grading not implemented, manually graded
        }
      });

      const finalScore = Math.max(0, scoreNum - penaltyNum);
      scoreText = \`\${Math.round(finalScore)} / \${maxScore} (\${Math.round((finalScore / maxScore) * 100)}%)\`;
      if (penaltyNum > 0) {
        scoreText += \` [-\${penaltyNum} penalty]\`;
      }
    }`;
code = code.replace(/    if \(currentAssessment\.type === 'mcq'\) \{[\s\S]*?scoreText \+= ` \[-\$\{penaltyNum\} penalty\]`;\n      \}\n    \}/, submitStart);

// 7. Clear section timer
code = code.replace(/if \(qTimerInterval\) \{ clearInterval\(qTimerInterval\); qTimerInterval = null; \}/, "if (qTimerInterval) { clearInterval(qTimerInterval); qTimerInterval = null; }\n    if (sectionTimerInterval) { clearInterval(sectionTimerInterval); sectionTimerInterval = null; }");

// 8. Trends and PDF Export logic at the end of DOMContentLoaded
const dashboardCode = `
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
             tbody.innerHTML = submissions.map(sub => \`
               <tr>
                 <td>\${sub.assessmentTitle}</td>
                 <td>\${sub.submittedAt}</td>
                 <td><strong style="color:var(--accent-primary)">\${sub.score}</strong></td>
                 <td>
                   <button class="btn btn-sm btn-outline btn-download-pdf" data-title="\${sub.assessmentTitle}" data-score="\${sub.score}" data-date="\${sub.submittedAt}">
                     <i class="fa-solid fa-file-pdf"></i> Download
                   </button>
                 </td>
               </tr>
             \`).join('');
             
             // Attach PDF download handlers
             tbody.querySelectorAll('.btn-download-pdf').forEach(btn => {
                 btn.addEventListener('click', (e) => {
                     const t = e.currentTarget.dataset.title;
                     const s = e.currentTarget.dataset.score;
                     const d = e.currentTarget.dataset.date;
                     const content = \`TORPEDO PERFORMANCE REPORT\n\nStudent Name: \${studentName}\nExam Title: \${t}\nDate Submitted: \${d}\nScore: \${s}\n\n-- Generated by Torpedo --\`;
                     const blob = new Blob([content], {type: 'text/plain'});
                     const url = URL.createObjectURL(blob);
                     const a = document.createElement('a');
                     a.href = url;
                     a.download = \`Report_\${t.replace(/\\s+/g, '_')}.pdf\`;
                     a.click();
                 });
             });
         }
      });
  }
`;
code = code.replace(/\}\);[\s]*$/, dashboardCode + "\n});\n");

fs.writeFileSync('/Users/vivek/Documents/GitHub/TorpedoTest/student.js', code);
console.log("student.js patched successfully.");
