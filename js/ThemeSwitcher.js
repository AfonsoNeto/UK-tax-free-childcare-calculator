export class ThemeSwitcher {
  constructor() {
    this.themeToggle = document.getElementById('theme-toggle');
  }

  init() {
    this.themeToggle.addEventListener('change', () => this.toggleTheme());
    this.applyTheme();
  }

  toggleTheme() {
    const isDarkMode = this.themeToggle.checked;
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    this.applyTheme();
  }

  applyTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkMode = savedTheme ? savedTheme === 'dark' : prefersDark;

    this.themeToggle.checked = isDarkMode;
    document.body.classList.toggle('dark-theme', isDarkMode);
  }
}
