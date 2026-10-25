import { $ } from './config.js';

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const isDark = theme === 'dark';
  if ($('themeIconSun')) $('themeIconSun').hidden = !isDark;
  if ($('themeIconMoon')) $('themeIconMoon').hidden = isDark;
}

export function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(current);

  const toggle = $('themeToggle');
  if (toggle) {
    toggle.onclick = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      applyTheme(isDark ? 'light' : 'dark');
    };
  }
}
