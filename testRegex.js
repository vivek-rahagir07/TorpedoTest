const text = `1. What is the capital of Australia? A. Sydney B. Melbourne C. Canberra D. Perth Correct Answer: C. Canberra 2. Which planet is known as the Red Planet? A. Venus B. Mars C. Jupiter D. Mercury Correct Answer: B. Mars 3. Who wrote the Indian National Anthem "Jana Gana Mana"? A. Bankim Chandra Chatterjee B. Rabindranath Tagore C. Mahatma Gandhi D. Subhas Chandra Bose Correct Answer: B. Rabindranath Tagore 4. Which is the largest ocean on Earth? A. Atlantic Ocean B. Indian Ocean C. Arctic Ocean D. Pacific Ocean Correct Answer: D. Pacific Ocean 5. What is the chemical symbol for Gold? A. Ag B. Au C. Gd D. Go Correct Answer: B. Au`;

function parseQuestionsFromText(text) {
  const questions = [];
  text = text.replace(/\s+/g, ' ');
  
  const qRegex = /(?:(?:^|\s)Q?\d+\s*[\.\)]\s*)(.*?)(?=(?:(?:^|\s)Q?\d+\s*[\.\)]|$))/g;
  let match;
  
  while ((match = qRegex.exec(text)) !== null) {
    const block = match[1];
    if (block.length < 10) continue; 
    
    const optRegex = /(?:^|\s)(?:[A-D]|[a-d])\s*[\.\)]\s*(.*?)(?=(?:^|\s)(?:[A-D]|[a-d])\s*[\.\)]|\b(?:Correct\s+)?Answer:|$)/gi;
    let opts = [];
    let optMatch;
    
    let qText = block.split(/(?:^|\s)(?:[A-D]|[a-d])\s*[\.\)]/i)[0].trim();
    
    while ((optMatch = optRegex.exec(block)) !== null) {
      const optionText = optMatch[1].trim();
      if (optionText.toLowerCase().includes('answer:')) break;
      if (opts.length >= 4) break;
      if (optionText.length > 0) opts.push(optionText);
    }
    
    let ansIndex = 0; 
    const ansMatch = block.match(/(?:Correct\s+)?Answer:\s*([A-D]|[a-d])/i);
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

console.log(JSON.stringify(parseQuestionsFromText(text), null, 2));
