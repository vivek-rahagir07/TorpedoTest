document.addEventListener('DOMContentLoaded', () => {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const icon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;

  const savedTheme = localStorage.getItem('theme');
  
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (icon) {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    }
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      
      if (currentTheme === 'dark') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if(icon) {
          icon.classList.remove('fa-sun');
          icon.classList.add('fa-moon');
        }
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if(icon) {
          icon.classList.remove('fa-moon');
          icon.classList.add('fa-sun');
        }
      }
    });
  }
});

// --- Mock Database (LocalStorage) ---
window.DB = {
  getAssessments: function() {
    const data = localStorage.getItem('torpedo_assessments');
    return data ? JSON.parse(data) : [];
  },
  saveAssessment: function(assessment) {
    const data = this.getAssessments();
    assessment.id = Date.now().toString();
    assessment.createdAt = new Date().toISOString();
    data.push(assessment);
    localStorage.setItem('torpedo_assessments', JSON.stringify(data));
    return assessment.id;
  }
};

// --- Toast Notification System ---
window.Toast = {
  show: function(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-fade-in`;
    toast.innerHTML = `
      <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
      <span>${message}</span>
    `;
    
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};
