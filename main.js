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
