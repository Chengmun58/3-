import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

const configResponse = await fetch("/api/public-config", { cache: "no-store" });
const publicConfig = await configResponse.json();

if (!configResponse.ok) {
  throw new Error(publicConfig?.error || "Supabase public config could not be loaded");
}

const supabase = createClient(publicConfig.supabaseUrl, publicConfig.supabasePublishableKey);
const STORAGE_KEY = "maeil-korean-v2";
const authDialog = document.getElementById("authDialog");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authMessage = document.getElementById("authMessage");
const signInButton = document.getElementById("signInButton");
const signUpButton = document.getElementById("signUpButton");
const signOutButton = document.getElementById("signOutButton");
const authButton = document.getElementById("authButton");
const syncStatus = document.getElementById("syncStatus");

let mode = "signin";

function translateError(error) {
  const raw = String(error?.message || error || "").toLowerCase();
  if (raw.includes("invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (raw.includes("email not confirmed")) return "이메일 인증을 먼저 완료해 주세요.";
  if (raw.includes("user already registered")) return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (raw.includes("password should be")) return "비밀번호는 8자 이상 입력해 주세요.";
  if (raw.includes("rate limit")) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  if (raw.includes("failed to fetch") || raw.includes("network")) return "네트워크 연결을 확인해 주세요.";
  return error?.message || "처리 중 오류가 발생했습니다.";
}

function setMessage(text, type = "info") {
  authMessage.textContent = text;
  authMessage.dataset.type = type;
}

function validate(email, password, requireStrong = false) {
  if (!email || !email.includes("@")) return "올바른 이메일 주소를 입력해 주세요.";
  if (!password || password.length < 8) return "비밀번호는 8자 이상 입력해 주세요.";
  if (requireStrong && (!/[A-Za-z]/.test(password) || !/\d/.test(password))) return "비밀번호에 영문과 숫자를 모두 포함해 주세요.";
  return "";
}

function prepareAuthDialog() {
  document.querySelectorAll(".utility-dock.open, .floating-learning-tools.open").forEach((node) => node.classList.remove("open"));
  authEmail.disabled = false;
  authEmail.readOnly = false;
  authPassword.disabled = false;
  authPassword.readOnly = false;
  authEmail.style.pointerEvents = "auto";
  authPassword.style.pointerEvents = "auto";
  signInButton.style.pointerEvents = "auto";
  signUpButton.style.pointerEvents = "auto";
  document.documentElement.classList.add("auth-dialog-open");
  window.setTimeout(() => authEmail.focus({ preventScroll: true }), 80);
}

function buildEnhancements() {
  const title = authDialog.querySelector(".dialog-title");
  title.textContent = "계정으로 기록 동기화";

  const tabs = document.createElement("div");
  tabs.className = "auth-tabs";
  tabs.innerHTML = '<button type="button" data-auth-mode="signin" class="active">로그인</button><button type="button" data-auth-mode="signup">회원가입</button>';
  title.insertAdjacentElement("afterend", tabs);

  const passwordHint = document.createElement("p");
  passwordHint.className = "password-hint";
  passwordHint.textContent = "8자 이상 · 영문과 숫자 포함";
  authPassword.insertAdjacentElement("afterend", passwordHint);
  authPassword.minLength = 8;
  authPassword.placeholder = "8자 이상";

  const utilityRow = document.createElement("div");
  utilityRow.className = "auth-utility-row";
  utilityRow.innerHTML = '<button id="resetPasswordButton" class="text-link" type="button">비밀번호를 잊으셨나요?</button><span id="accountStatus">로그인하면 모든 기기에서 기록을 볼 수 있어요.</span>';
  authDialog.querySelector(".hero-actions").insertAdjacentElement("afterend", utilityRow);

  const restoreWrap = document.createElement("div");
  restoreWrap.className = "backup-tools";
  restoreWrap.innerHTML = '<button id="restoreData" class="text-link" type="button">백업 불러오기 ↑</button><input id="restoreFile" type="file" accept="application/json,.json" hidden>';
  const exportButton = document.getElementById("exportData");
  exportButton.insertAdjacentElement("afterend", restoreWrap);

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-auth-mode]");
    if (!button) return;
    mode = button.dataset.authMode;
    tabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    signInButton.hidden = mode !== "signin";
    signUpButton.hidden = mode !== "signup";
    passwordHint.hidden = mode !== "signup";
    document.getElementById("resetPasswordButton").hidden = mode !== "signin";
    setMessage(mode === "signin" ? "계정에 로그인해 주세요." : "가입 후 인증 메일을 확인해 주세요.");
    authEmail.focus({ preventScroll: true });
  });

  document.getElementById("resetPasswordButton").addEventListener("click", resetPassword);
  document.getElementById("restoreData").addEventListener("click", () => document.getElementById("restoreFile").click());
  document.getElementById("restoreFile").addEventListener("change", restoreBackup);
}

async function signIn(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const email = authEmail.value.trim();
  const password = authPassword.value;
  const problem = validate(email, password);
  if (problem) return setMessage(problem, "error");
  signInButton.disabled = true;
  setMessage("로그인 중…");
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMessage(translateError(error), "error");
    setMessage("로그인했습니다.", "success");
    setTimeout(() => authDialog.close(), 450);
  } finally {
    signInButton.disabled = false;
  }
}

async function signUp(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const email = authEmail.value.trim();
  const password = authPassword.value;
  const problem = validate(email, password, true);
  if (problem) return setMessage(problem, "error");
  signUpButton.disabled = true;
  setMessage("계정을 만드는 중…");
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/` }
    });
    if (error) return setMessage(translateError(error), "error");
    if (data.session) {
      setMessage("계정을 만들고 로그인했습니다.", "success");
      setTimeout(() => authDialog.close(), 500);
    } else {
      setMessage("인증 메일을 보냈습니다. 메일함과 스팸함을 확인해 주세요.", "success");
    }
  } finally {
    signUpButton.disabled = false;
  }
}

async function resetPassword() {
  const email = authEmail.value.trim();
  if (!email || !email.includes("@")) return setMessage("먼저 이메일 주소를 입력해 주세요.", "error");
  setMessage("재설정 메일을 보내는 중…");
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/` });
  setMessage(error ? translateError(error) : "비밀번호 재설정 메일을 보냈습니다.", error ? "error" : "success");
}

async function updateAccountState() {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  const accountStatus = document.getElementById("accountStatus");
  if (!user) {
    accountStatus.textContent = "로그인하면 모든 기기에서 기록을 볼 수 있어요.";
    return;
  }
  authButton.textContent = user.email?.split("@")[0] || "계정";
  syncStatus.textContent = "클라우드 연결됨";
  syncStatus.dataset.state = "connected";
  accountStatus.textContent = `${user.email} · ${user.email_confirmed_at ? "이메일 인증 완료" : "이메일 인증 대기"}`;
}

function restoreBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed.entries)) throw new Error("invalid");
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: parsed.entries, checks: parsed.checks || {} }));
      alert("백업을 불러왔습니다. 페이지를 새로고침합니다.");
      location.reload();
    } catch {
      alert("올바른 백업 파일이 아닙니다.");
    }
  };
  reader.readAsText(file);
}

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    #authDialog{position:fixed;z-index:2147483647;max-height:calc(100dvh - 24px);overflow:auto;overscroll-behavior:contain;pointer-events:auto;touch-action:pan-y}
    #authDialog[open],#authDialog[open] *{pointer-events:auto}
    #authDialog .auth-dialog-body{position:relative;z-index:2}
    #authDialog input{position:relative;z-index:3;display:block;min-height:52px;background:#fffdf8;color:#171714;opacity:1;-webkit-user-select:text;user-select:text;touch-action:manipulation}
    #authDialog button{position:relative;z-index:3;touch-action:manipulation}
    html.auth-dialog-open .utility-dock,html.auth-dialog-open .floating-learning-tools{pointer-events:none!important}
    .auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:5px;border:1px solid var(--line);border-radius:999px}
    .auth-tabs button{border:0;border-radius:999px;padding:10px;background:transparent;color:var(--muted)}
    .auth-tabs button.active{background:var(--text);color:#fff}
    .password-hint{margin:-5px 0 0;color:var(--muted);font-size:.76rem}
    .auth-utility-row{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding-top:4px;color:var(--muted);font-size:.78rem}
    .auth-utility-row span{text-align:right;max-width:250px}
    #authMessage[data-type="error"]{color:#9e3028}
    #authMessage[data-type="success"]{color:#39702d}
    .backup-tools{display:inline-flex;margin-left:14px}
    #syncStatus[data-state="connected"]::before{content:"";display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:#58a548}
    button:disabled{opacity:.55;cursor:wait}
    @media(max-width:640px){#authDialog{width:calc(100% - 20px);padding:30px 20px}.auth-dialog-body{min-width:0!important}.auth-utility-row{display:grid}.auth-utility-row span{text-align:left}.backup-tools{margin-left:8px}}
  `;
  document.head.appendChild(style);
}

buildEnhancements();
injectStyles();
authButton.addEventListener("click", prepareAuthDialog);
authDialog.addEventListener("close", () => document.documentElement.classList.remove("auth-dialog-open"));
authDialog.addEventListener("cancel", () => document.documentElement.classList.remove("auth-dialog-open"));
authEmail.addEventListener("pointerdown", () => authEmail.focus());
authPassword.addEventListener("pointerdown", () => authPassword.focus());
authPassword.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  mode === "signup" ? signUp(event) : signIn(event);
});
signInButton.addEventListener("click", signIn, true);
signUpButton.addEventListener("click", signUp, true);
supabase.auth.onAuthStateChange(updateAccountState);
updateAccountState();
