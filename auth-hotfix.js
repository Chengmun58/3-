const dialog = document.getElementById('authDialog');
const signIn = document.getElementById('signInButton');
const signUp = document.getElementById('signUpButton');
const message = document.getElementById('authMessage');

function resetAuthControls(mode = 'signin') {
  if (!dialog) return;
  const isSignIn = mode === 'signin';
  if (signIn) {
    signIn.disabled = false;
    signIn.hidden = !isSignIn;
    signIn.style.display = isSignIn ? 'inline-flex' : 'none';
  }
  if (signUp) {
    signUp.disabled = false;
    signUp.hidden = isSignIn;
    signUp.style.display = isSignIn ? 'none' : 'inline-flex';
  }
}

function currentMode() {
  return dialog?.querySelector('[data-auth-mode].active')?.dataset.authMode || 'signin';
}

document.getElementById('authButton')?.addEventListener('click', () => {
  resetAuthControls(currentMode());
  if (message?.dataset.type === 'success') {
    message.textContent = '계정에 로그인해 주세요.';
    message.dataset.type = 'info';
  }
}, { capture: true });

dialog?.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-auth-mode]');
  if (!tab) return;
  resetAuthControls(tab.dataset.authMode);
}, { capture: true });

dialog?.addEventListener('close', () => resetAuthControls('signin'));

resetAuthControls(currentMode());
