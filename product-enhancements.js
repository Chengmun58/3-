import './auth-hotfix.js';

let deferredInstallPrompt = null;
const PREF_KEY = 'maeil-korean-preferences-v1';

function toast(message) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2200);
}

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY)) || { daily_minutes: 20, focus: 'native-fluency', interface_language: 'ko', theme: 'system' };
  } catch {
    return { daily_minutes: 20, focus: 'native-fluency', interface_language: 'ko', theme: 'system' };
  }
}

function toggleMobileTheme() {
  const prefs = readPrefs();
  const current = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  prefs.theme = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  document.documentElement.dataset.theme = prefs.theme;
}

function toggleMobileLanguage() {
  const prefs = readPrefs();
  prefs.interface_language = prefs.interface_language === 'ko' ? 'zh' : prefs.interface_language === 'zh' ? 'en' : 'ko';
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  location.reload();
}

function addUtilityPanel() {
  const dock = document.createElement('aside');
  dock.className = 'utility-dock';
  dock.setAttribute('aria-label', '학습 도구');
  dock.dataset.open = 'false';
  dock.innerHTML = `
    <button class="utility-dock-toggle" id="utilityDockToggle" type="button" aria-expanded="false" aria-controls="utilityDockMenu" aria-label="학습 도구 열기">
      <span aria-hidden="true">＋</span><span class="utility-dock-toggle-label">학습 도구</span>
    </button>
    <div class="utility-dock-backdrop" id="utilityDockBackdrop" hidden></div>
    <div class="utility-dock-menu" id="utilityDockMenu" hidden role="dialog" aria-modal="false" aria-label="학습 도구 메뉴">
      <div class="utility-dock-handle" aria-hidden="true"></div>
      <div class="utility-dock-mobile-controls">
        <button id="mobileThemeButton" type="button">◐ 테마</button>
        <button id="mobileLangButton" type="button">文 언어</button>
      </div>
      <button id="installAppButton" type="button" hidden>앱 설치</button>
      <button id="listenPhraseButton" type="button">표현 듣기</button>
      <button id="shadowingButton" type="button">따라 말하기</button>
      <button id="reminderButton" type="button">오늘 알림</button>
      <button id="closeUtilityDock" class="utility-dock-close" type="button">닫기</button>
      <p id="speechFeedback" aria-live="polite"></p>
    </div>
  `;
  document.body.appendChild(dock);

  const toggle = dock.querySelector('#utilityDockToggle');
  const menu = dock.querySelector('#utilityDockMenu');
  const backdrop = dock.querySelector('#utilityDockBackdrop');

  const setOpen = (open) => {
    dock.dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '학습 도구 닫기' : '학습 도구 열기');
    toggle.querySelector('[aria-hidden="true"]').textContent = open ? '×' : '＋';
    menu.hidden = !open;
    backdrop.hidden = !open;
    document.documentElement.classList.toggle('utility-sheet-open', open);
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(dock.dataset.open !== 'true');
  });

  backdrop.addEventListener('click', () => setOpen(false));
  dock.querySelector('#closeUtilityDock').addEventListener('click', () => setOpen(false));

  document.addEventListener('click', (event) => {
    if (dock.dataset.open === 'true' && !dock.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  let touchStartY = 0;
  menu.addEventListener('touchstart', event => { touchStartY = event.touches[0]?.clientY || 0; }, { passive: true });
  menu.addEventListener('touchend', event => {
    const endY = event.changedTouches[0]?.clientY || 0;
    if (endY - touchStartY > 70) setOpen(false);
  }, { passive: true });

  const closeAfterAction = (handler) => async (event) => {
    await handler(event);
    setOpen(false);
  };

  dock.querySelector('#mobileThemeButton').addEventListener('click', closeAfterAction(toggleMobileTheme));
  dock.querySelector('#mobileLangButton').addEventListener('click', toggleMobileLanguage);

  const installButton = dock.querySelector('#installAppButton');
  installButton.addEventListener('click', closeAfterAction(async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
  }));

  dock.querySelector('#listenPhraseButton').addEventListener('click', closeAfterAction(() => {
    const text = document.getElementById('dailyPhrase')?.textContent?.trim();
    if (!text || !('speechSynthesis' in window)) return toast('이 기기에서는 음성 재생을 지원하지 않습니다.');
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.82;
    speechSynthesis.speak(utterance);
  }));

  dock.querySelector('#shadowingButton').addEventListener('click', closeAfterAction(startShadowing));
  dock.querySelector('#reminderButton').addEventListener('click', closeAfterAction(enableReminder));
}

function startShadowing() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const target = document.getElementById('dailyPhrase')?.textContent?.trim() || '';
  const output = document.getElementById('speechFeedback');
  if (!Recognition) {
    output.textContent = '이 브라우저에서는 음성 인식을 지원하지 않습니다. Safari 최신 버전 또는 Chrome을 사용해 주세요.';
    return;
  }
  const recognition = new Recognition();
  recognition.lang = 'ko-KR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  output.textContent = '듣고 있습니다…';
  recognition.onresult = event => {
    const heard = event.results[0][0].transcript.trim();
    const normalize = value => value.replace(/[\s.,!?~]/g, '').toLowerCase();
    const expected = normalize(target);
    const actual = normalize(heard);
    const matched = expected === actual || expected.includes(actual) || actual.includes(expected);
    output.textContent = matched ? `좋아요: “${heard}”` : `인식 결과: “${heard}” · 목표 표현을 한 번 더 천천히 말해 보세요.`;
  };
  recognition.onerror = () => { output.textContent = '음성 인식에 실패했습니다. 마이크 권한을 확인해 주세요.'; };
  recognition.start();
}

async function enableReminder() {
  if (!('Notification' in window)) return toast('이 기기에서는 웹 알림을 지원하지 않습니다.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return toast('알림 권한이 허용되지 않았습니다.');
  localStorage.setItem('maeil-korean-reminder', 'enabled');
  new Notification('매일, 한국어', { body: '알림이 켜졌습니다. 사이트를 열었을 때 오늘의 학습을 알려드릴게요.', icon: '/icon.svg' });
  toast('학습 알림을 켰습니다.');
}

function showDailyReminder() {
  if (localStorage.getItem('maeil-korean-reminder') !== 'enabled') return;
  if (Notification.permission !== 'granted') return;
  const today = new Date().toISOString().slice(0, 10);
  const key = `maeil-korean-reminded-${today}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  new Notification('오늘의 한국어', { body: '20분 몰입 루틴을 시작할 시간입니다.', icon: '/icon.svg' });
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const button = document.getElementById('installAppButton');
  if (button) button.hidden = false;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(console.error));
}

document.addEventListener('DOMContentLoaded', () => {
  addUtilityPanel();
  showDailyReminder();
});