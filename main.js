/* =====================================================
   TORPEDO SKILLCHECK — MAIN.JS
   Shared utilities: Theme, DB, Toast
   ===================================================== */

// ---- Theme Toggle ----
document.addEventListener('DOMContentLoaded', () => {
  const themeBtn = document.getElementById('theme-toggle');
  const icon     = themeBtn?.querySelector('i');

  const applyTheme = (isDark) => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (icon) {
      icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  };

  // Restore saved preference
  const saved = localStorage.getItem('torpedo_theme');
  applyTheme(saved === 'dark');

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const next = !isDark;
      applyTheme(next);
      localStorage.setItem('torpedo_theme', next ? 'dark' : 'light');
    });
  }

  // ---- Navbar scroll-shadow effect ----
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }
});


// ---- Assessment Database (LocalStorage) ----
window.DB = {
  _KEY: 'torpedo_assessments',

  getAssessments() {
    try {
      return JSON.parse(localStorage.getItem(this._KEY) || '[]');
    } catch { return []; }
  },

  saveAssessment(assessment) {
    const data = this.getAssessments();
    assessment.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    assessment.createdAt = new Date().toISOString();
    // Generate 6-char uppercase invite code, e.g. TRP8A4
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    assessment.inviteCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    data.push(assessment);
    localStorage.setItem(this._KEY, JSON.stringify(data));
    return assessment.id;
  },

  deleteAssessment(id) {
    const data = this.getAssessments().filter(a => a.id !== id);
    localStorage.setItem(this._KEY, JSON.stringify(data));
  },

  clearAll() {
    localStorage.removeItem(this._KEY);
  },

  // ---- Submissions DB Methods ----
  _SUB_KEY: 'torpedo_submissions',

  getSubmissions() {
    try {
      return JSON.parse(localStorage.getItem(this._SUB_KEY) || '[]');
    } catch { return []; }
  },

  saveSubmission(submission) {
    const data = this.getSubmissions();
    submission.id = 'sub-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    // Only set submittedAt if the caller didn't already provide one
    if (!submission.submittedAt) {
      submission.submittedAt = new Date().toLocaleString();
    }
    // Normalise title field for faculty logs
    if (submission.title && !submission.assessmentTitle) {
      submission.assessmentTitle = submission.title;
    }
    data.push(submission);
    localStorage.setItem(this._SUB_KEY, JSON.stringify(data));
    return submission.id;
  },


  clearSubmissions() {
    localStorage.removeItem(this._SUB_KEY);
  }
};

// ---- Toast Notification System ----
window.Toast = {
  show(message, type = 'success', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.success}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.35s ease-out forwards';
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }
};
