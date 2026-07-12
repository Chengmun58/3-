import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let currentUser = null;
let cloudReady = false;

const contentBank = [
  {
    phrase: "말이 입에 붙다",
    meaning: "자주 써서 표현이 자연스럽게 나오다",
    example: "매일 소리 내어 따라 했더니 이 표현이 이제 입에 붙었어요.",
    readingTitle: "완벽한 문장보다 빠른 반응이 먼저다",
    readingBody: "대화에서는 정확한 문장을 만드는 능력만큼 흐름을 놓치지 않는 감각이 중요하다. 짧은 맞장구와 연결 표현을 익혀 두면 생각할 시간을 벌면서도 자연스럽게 대화를 이어 갈 수 있다.",
    readingPrompt: "자연스러운 대화를 위해 오늘 바꾸고 싶은 습관은 무엇인가요?",
    reaction: "친구가 약속 시간에 20분 늦는다고 했습니다. 기분을 너무 세게 드러내지 않고 자연스럽게 답해 보세요.",
    writing: "최근 계획이 바뀌었지만 오히려 잘됐다고 느낀 경험",
    mz: [["인정", "상대의 말에 강하게 동의할 때"], ["그럴 만해", "이유를 듣고 납득할 때"], ["은근 괜찮다", "기대보다 제법 좋을 때"]]
  },
  {
    phrase: "감이 오다",
    meaning: "상황이나 방법을 대략 이해하게 되다",
    example: "몇 번 직접 해 보니까 이제 어떻게 해야 할지 감이 와요.",
    readingTitle: "모르는 단어를 바로 번역하지 않는 연습",
    readingBody: "낯선 단어를 만날 때마다 번역하면 생각의 흐름이 끊긴다. 먼저 문맥과 말하는 사람의 태도를 보고 뜻을 추측한 뒤, 마지막에 사전으로 확인하는 편이 한국어 감각을 기르는 데 더 효과적이다.",
    readingPrompt: "문맥만으로 뜻을 짐작했던 최근 표현을 설명해 보세요.",
    reaction: "처음 맡은 업무가 생각보다 복잡합니다. 동료에게 현재 상태를 자연스럽게 설명해 보세요.",
    writing: "처음에는 어려웠지만 점점 감이 오기 시작한 일",
    mz: [["딱 봐도", "자세히 보지 않아도 분명할 때"], ["애매하다", "분명히 판단하기 어려울 때"], ["살짝", "말을 부드럽게 낮출 때"]]
  },
  {
    phrase: "선을 넘다",
    meaning: "허용되는 범위나 예의를 지나치다",
    example: "농담이라도 상대가 불편해하면 선을 넘은 거예요.",
    readingTitle: "부드럽지만 분명하게 의견 말하기",
    readingBody: "한국어로 반대할 때는 결론부터 세게 말하기보다 상대의 관점을 먼저 인정하고 우려되는 지점을 구체적으로 덧붙이는 방식이 자연스럽다. 다만 핵심 입장을 흐릴 필요는 없다.",
    readingPrompt: "상대의 의견을 인정하면서 반대하는 문장을 만들어 보세요.",
    reaction: "회의에서 일정이 현실적이지 않다고 느꼈습니다. 대안을 포함해 말해 보세요.",
    writing: "예의를 지키면서도 분명하게 거절해야 했던 상황",
    mz: [["팩트다", "틀림없는 사실이라는 뜻"], ["무리다", "현실적으로 어렵다는 뜻"], ["선을 넘네", "행동이 지나쳤다는 반응"]]
  },
  {
    phrase: "여유가 생기다",
    meaning: "시간이나 마음의 부담이 줄어들다",
    example: "아침 일정을 단순하게 바꾸니까 마음에 여유가 생겼어요.",
    readingTitle: "한국어를 생활의 기본 언어로 만드는 법",
    readingBody: "공부 시간을 따로 만드는 것보다 이미 반복하는 행동에 한국어를 붙이는 편이 오래간다. 메모, 검색, 혼잣말, 일정 확인을 한국어로 바꾸면 학습과 생활의 경계가 점점 사라진다.",
    readingPrompt: "오늘부터 한국어로 바꿀 수 있는 일상 행동 세 가지는 무엇인가요?",
    reaction: "주말 계획을 묻는 친구에게 구체적인 일정 없이 편하게 답해 보세요.",
    writing: "시간과 마음에 여유를 만들기 위해 줄이고 싶은 것",
    mz: [["나름", "자기 기준에서는 꽤 괜찮다는 뜻"], ["은근히", "생각보다 조용히 또는 제법"], ["그냥저냥", "아주 좋지도 나쁘지도 않게"]]
  }
];

const STORAGE_KEY = "maeil-korean-v2";
const today = new Date();
const localDate = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
const dayNumber = Math.floor(today.getTime() / 86400000);
const daily = contentBank[Math.abs(dayNumber) % contentBank.length];

const state = loadState();
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && Array.isArray(saved.entries) ? saved : { entries: [], checks: {} };
  } catch { return { entries: [], checks: {} }; }
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function setSyncStatus(text) { const el = document.getElementById("syncStatus"); if (el) el.textContent = text; }

async function pushEntryToCloud(entry) {
  if (!currentUser) return;
  setSyncStatus("동기화 중…");
  const payload = {
    user_id: currentUser.id, entry_date: entry.date, title: entry.title, content: entry.content,
    category: entry.type, tags: entry.tags || [], completed: entry.type === "체크인"
  };
  const { error } = await supabase.from("daily_entries").upsert(payload, { onConflict: "user_id,entry_date,title,category" });
  setSyncStatus(error ? "동기화 오류" : "클라우드 저장");
  if (error) console.error(error);
}

async function deleteEntryFromCloud(entry) {
  if (!currentUser) return;
  await supabase.from("daily_entries").delete().eq("user_id", currentUser.id).eq("entry_date", entry.date).eq("title", entry.title).eq("category", entry.type);
}

async function loadCloudEntries() {
  if (!currentUser) return;
  setSyncStatus("불러오는 중…");
  const { data, error } = await supabase.from("daily_entries").select("id,entry_date,title,content,category,tags,created_at").order("entry_date", { ascending: false });
  if (error) { setSyncStatus("동기화 오류"); console.error(error); return; }
  const cloudEntries = (data || []).map(row => ({ id: row.id, date: row.entry_date, type: row.category, title: row.title, content: row.content, tags: row.tags || [] }));
  const localOnly = state.entries.filter(local => !cloudEntries.some(cloud => cloud.date === local.date && cloud.type === local.type && cloud.title === local.title));
  state.entries = [...cloudEntries, ...localOnly]; persist(); renderArchive(); renderMetrics();
  for (const entry of localOnly) await pushEntryToCloud(entry);
  setSyncStatus("클라우드 저장");
}

async function initCloud() {
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null; cloudReady = true; updateAuthUI();
  if (currentUser) await loadCloudEntries();
  supabase.auth.onAuthStateChange(async (_event, sessionNow) => {
    currentUser = sessionNow?.user || null; updateAuthUI();
    if (currentUser) await loadCloudEntries(); else setSyncStatus("로컬 저장");
  });
}

function updateAuthUI() {
  const btn = document.getElementById("authButton");
  const out = document.getElementById("signOutButton");
  if (!btn) return;
  btn.textContent = currentUser ? "계정" : "로그인";
  if (out) out.hidden = !currentUser;
  setSyncStatus(currentUser ? "클라우드 연결" : "로컬 저장");
}

function uid() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function escapeHTML(value = "") { return value.replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function formatDate(dateString) { return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${dateString}T00:00:00`)); }
function showToast(message) { const toast = document.getElementById("toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800); }

function setDailyContent() {
  document.getElementById("todayDate").textContent = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(today);
  document.getElementById("dayIndex").textContent = `DAY ${String((Math.abs(dayNumber) % 99) + 1).padStart(2, "0")}`;
  document.getElementById("dailyPhrase").textContent = daily.phrase;
  document.getElementById("dailyMeaning").textContent = daily.meaning;
  document.getElementById("dailyExample").textContent = daily.example;
  document.getElementById("readingTitle").textContent = daily.readingTitle;
  document.getElementById("readingBody").textContent = daily.readingBody;
  document.getElementById("readingPrompt").textContent = daily.readingPrompt;
  document.getElementById("reactionPrompt").textContent = daily.reaction;
  document.getElementById("writingTopic").textContent = daily.writing;
  document.getElementById("mzCount").textContent = `${daily.mz.length}개`;
  document.getElementById("mzList").innerHTML = daily.mz.map(([word, desc]) => `<div><strong>${escapeHTML(word)}</strong><span>${escapeHTML(desc)}</span></div>`).join("");
}

function addEntry(type, title, content, tags = []) {
  if (!content.trim()) { showToast("내용을 먼저 입력해 주세요."); return false; }
  const existingIndex = state.entries.findIndex(e => e.date === localDate && e.type === type && e.title === title);
  const entry = { id: existingIndex >= 0 ? state.entries[existingIndex].id : uid(), date: localDate, type, title, content: content.trim(), tags };
  if (existingIndex >= 0) state.entries[existingIndex] = entry; else state.entries.unshift(entry);
  persist(); renderArchive(); renderMetrics(); pushEntryToCloud(entry); showToast(currentUser ? "클라우드에 저장했습니다." : "이 브라우저에 저장했습니다."); return true;
}

function initInputs() {
  const speaking = state.entries.find(e => e.date === localDate && e.type === "말하기");
  const writing = state.entries.find(e => e.date === localDate && e.type === "글쓰기");
  if (speaking) document.getElementById("speakingInput").value = speaking.content;
  if (writing) document.getElementById("writingInput").value = writing.content;
  updateCounts(); updateCoach();
  const checks = state.checks[localDate] || {};
  document.querySelectorAll("[data-check]").forEach(input => { input.checked = Boolean(checks[input.dataset.check]); });
  updateCompletion();
}

function updateCounts() {
  document.getElementById("speakingCount").textContent = `${document.getElementById("speakingInput").value.length}자`;
  document.getElementById("writingCount").textContent = `${document.getElementById("writingInput").value.length}자`;
}
function updateCoach() {
  const text = document.getElementById("writingInput").value.trim();
  const box = document.getElementById("coachResult");
  if (!text) { box.textContent = "글을 쓰면 문장 길이와 연결 표현을 점검합니다."; return; }
  const sentences = text.split(/[.!?。！？\n]+/).filter(s => s.trim().length > 1);
  const connectors = ["그래서", "하지만", "그러나", "게다가", "반면에", "결국", "오히려", "때문에"].filter(w => text.includes(w));
  const notes = [];
  notes.push(`${sentences.length}문장으로 인식했습니다.`);
  notes.push(sentences.length >= 5 ? "분량이 충분합니다." : "5문장까지 조금 더 확장해 보세요.");
  notes.push(connectors.length ? `연결 표현: ${connectors.join(", ")}` : "‘하지만’, ‘그래서’, ‘오히려’ 같은 연결 표현을 넣어 보세요.");
  box.textContent = notes.join(" ");
}

function updateCompletion() {
  const checks = {};
  document.querySelectorAll("[data-check]").forEach(input => checks[input.dataset.check] = input.checked);
  state.checks[localDate] = checks; persist();
  const done = Object.values(checks).filter(Boolean).length;
  const percent = done * 25;
  document.getElementById("completionBar").style.width = `${percent}%`;
  document.getElementById("completionText").textContent = `${percent}%`;
  document.getElementById("todayMetric").textContent = `${percent}%`;
  document.getElementById("todayMetricBar").style.width = `${percent}%`;
  if (done) {
    const details = Object.entries(checks).filter(([,v]) => v).map(([k]) => ({read:"읽기", speak:"말하기", write:"글쓰기", review:"복습"}[k]));
    const existing = state.entries.findIndex(e => e.date === localDate && e.type === "체크인");
    const entry = { id: existing >= 0 ? state.entries[existing].id : uid(), date: localDate, type: "체크인", title: `오늘의 루틴 ${percent}%`, content: details.join(" · "), tags: ["루틴"] };
    if (existing >= 0) state.entries[existing] = entry; else state.entries.unshift(entry);
    persist();
  }
  renderMetrics();
}

function filteredEntries() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const type = document.getElementById("typeFilter").value;
  const month = document.getElementById("dateFilter").value;
  const sort = document.getElementById("sortFilter").value;
  return [...state.entries].filter(e => {
    const haystack = [e.title, e.type, e.content, ...(e.tags || [])].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (type === "all" || e.type === type) && (!month || e.date.startsWith(month));
  }).sort((a,b) => sort === "newest" ? b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)) : a.date.localeCompare(b.date));
}
function renderArchive() {
  const list = filteredEntries();
  document.getElementById("archiveCount").textContent = `${list.length}개의 기록`;
  document.getElementById("emptyState").hidden = list.length > 0;
  document.getElementById("archiveList").innerHTML = list.map(e => `<article class="archive-item" data-id="${escapeHTML(String(e.id))}" tabindex="0" role="button"><time>${formatDate(e.date)}</time><div><span class="entry-type">${escapeHTML(e.type)}</span><h3>${escapeHTML(e.title)}</h3><p>${escapeHTML(e.content.slice(0, 100))}${e.content.length > 100 ? "…" : ""}</p></div><div class="archive-tags">${(e.tags || []).map(t => `<span>#${escapeHTML(t)}</span>`).join("")}</div></article>`).join("");
}
function openEntry(id) {
  const entry = state.entries.find(e => String(e.id) === String(id)); if (!entry) return;
  document.getElementById("dialogContent").innerHTML = `<p class="dialog-kicker">${formatDate(entry.date)} · ${escapeHTML(entry.type)}</p><h3 class="dialog-title">${escapeHTML(entry.title)}</h3><p class="dialog-body">${escapeHTML(entry.content)}</p><div class="dialog-footer"><span>${(entry.tags || []).map(t => `#${escapeHTML(t)}`).join(" ")}</span><button id="deleteEntry" class="danger-link" type="button">기록 삭제</button></div>`;
  document.getElementById("entryDialog").showModal();
  document.getElementById("deleteEntry").addEventListener("click", () => { deleteEntryFromCloud(entry); state.entries = state.entries.filter(e => String(e.id) !== String(id)); persist(); document.getElementById("entryDialog").close(); renderArchive(); renderMetrics(); showToast("기록을 삭제했습니다."); });
}
function renderMetrics() {
  const dates = [...new Set(state.entries.map(e => e.date))].sort().reverse();
  let streak = 0; const cursor = new Date(`${localDate}T00:00:00`);
  for (;;) { const d = new Intl.DateTimeFormat("en-CA", {year:"numeric",month:"2-digit",day:"2-digit"}).format(cursor); if (dates.includes(d)) { streak++; cursor.setDate(cursor.getDate()-1); } else break; }
  document.getElementById("streakMetric").textContent = `${streak}일`;
  document.getElementById("phraseMetric").textContent = `${state.entries.filter(e => e.type === "표현").length}개`;
  document.getElementById("writingMetric").textContent = `${state.entries.filter(e => e.type === "글쓰기").length}편`;
}
function exportData() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `maeil-korean-${localDate}.json`; a.click(); URL.revokeObjectURL(url); showToast("백업 파일을 만들었습니다.");
}

setDailyContent(); initInputs(); renderArchive(); renderMetrics();
document.getElementById("savePhrase").addEventListener("click", () => addEntry("표현", daily.phrase, `${daily.meaning}\n\n${daily.example}`, ["오늘의 표현"]));
document.getElementById("saveSpeaking").addEventListener("click", () => addEntry("말하기", "오늘의 반응 연습", document.getElementById("speakingInput").value, ["반응", "회화"]));
document.getElementById("saveWriting").addEventListener("click", () => addEntry("글쓰기", daily.writing, document.getElementById("writingInput").value, ["오늘의 글"]));
document.querySelectorAll("textarea").forEach(el => el.addEventListener("input", () => { updateCounts(); if (el.id === "writingInput") updateCoach(); }));
document.querySelectorAll("[data-check]").forEach(el => el.addEventListener("change", updateCompletion));
document.querySelectorAll("[data-focus]").forEach(el => el.addEventListener("click", () => { document.getElementById(el.dataset.focus).focus(); document.getElementById("practice").scrollIntoView({behavior:"smooth"}); }));
["searchInput","typeFilter","dateFilter","sortFilter"].forEach(id => document.getElementById(id).addEventListener("input", renderArchive));
document.getElementById("archiveList").addEventListener("click", e => { const item = e.target.closest(".archive-item"); if (item) openEntry(item.dataset.id); });
document.getElementById("archiveList").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest(".archive-item")) openEntry(e.target.closest(".archive-item").dataset.id); });
document.getElementById("closeDialog").addEventListener("click", () => document.getElementById("entryDialog").close());
document.getElementById("entryDialog").addEventListener("click", e => { if (e.target.id === "entryDialog") e.target.close(); });
document.getElementById("exportData").addEventListener("click", exportData);


document.getElementById("authButton").addEventListener("click", () => document.getElementById("authDialog").showModal());
document.getElementById("closeAuthDialog").addEventListener("click", () => document.getElementById("authDialog").close());
document.getElementById("signInButton").addEventListener("click", async () => {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  document.getElementById("authMessage").textContent = error ? error.message : "로그인했습니다.";
  if (!error) document.getElementById("authDialog").close();
});
document.getElementById("signUpButton").addEventListener("click", async () => {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const { error } = await supabase.auth.signUp({ email, password });
  document.getElementById("authMessage").textContent = error ? error.message : "계정을 만들었습니다. 이메일 확인이 필요할 수 있습니다.";
});
document.getElementById("signOutButton").addEventListener("click", async () => { await supabase.auth.signOut(); document.getElementById("authDialog").close(); });
initCloud();
