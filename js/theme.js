/* --- Light/dark theme ------------------------------------------------------ */
(function () {
  'use strict';

  var KEY = 'rbr-theme';
  var savedTheme = readSavedTheme();
  var currentTheme = savedTheme || systemTheme();
  var button = null;

  function readSavedTheme() {
    try {
      var theme = window.localStorage.getItem(KEY);
      return theme === 'light' || theme === 'dark' ? theme : null;
    } catch (error) {
      if (window.console) { console.error('Could not read the theme preference.', error); }
      return null;
    }
  }

  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function updateButton() {
    if (!button) { return; }
    var dark = currentTheme === 'dark';
    button.textContent = dark ? '☀' : '☾';
    button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    button.setAttribute('aria-pressed', dark ? 'true' : 'false');
    button.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
  }

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    updateButton();
  }

  function saveTheme(theme) {
    try {
      window.localStorage.setItem(KEY, theme);
      savedTheme = theme;
    } catch (error) {
      if (window.console) { console.error('Could not save the theme preference.', error); }
    }
  }

  function addButton() {
    var header = document.querySelector('.rbr-header__inner');
    if (!header || header.querySelector('.rbr-theme-toggle')) { return; }

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'rbr-theme-toggle';
    button.addEventListener('click', function () {
      var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      saveTheme(newTheme);
      applyTheme(newTheme);
    });

    updateButton();
    header.appendChild(button);
  }

  function init() {
    addButton();

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (event) {
        if (!savedTheme) { applyTheme(event.matches ? 'dark' : 'light'); }
      });
    }

    window.addEventListener('storage', function (event) {
      if (event.key !== KEY) { return; }
      savedTheme = event.newValue === 'light' || event.newValue === 'dark'
        ? event.newValue
        : null;
      applyTheme(savedTheme || systemTheme());
    });
  }

  applyTheme(currentTheme);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
