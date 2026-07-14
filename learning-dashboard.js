import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const heatmap = document.getElementById("learningHeatmap");
const reviewCard = document.getElementById("reviewCard");
const reviewCount = document.getElementById("reviewCount");
const writingScore = document.getElementById("writingScore");
const scoreWritingButton = document.getElementById("scoreWritingButton");
let reviewItems = [];
let reviewIndex = 0;

function isoDate(date) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

async function currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
}

async function renderHeatmap() {
  if (!heatmap) return;
  const user = await currentUser();
  const days = [];
  for (let i = 83; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(isoDate(d));
  }
  let counts = {};
  if (user) {
    const start = days[0];
    const { data } = await supabase.from("daily_entries").select("entry_date").gte("entry_date", start);
    for (const row of data || []) counts[row.entry_date] = (counts[row.entry_date] || 0) + 1;
  } else {
    try {
      const local = JSON.parse(localStorage.getItem("maeil-korean-v2") || "{}");
      for (const row of local.entries || []) counts[row.date] = (counts[row.date] || 0) + 1;
    } catch {}
  }
  heatmap.innerHTML = days.map((day) => {
    const n = counts[day] || 0;
    const level = n === 0 ? 0 : n === 1 ? 1 : n < 4 ? 2 : 3;
    return `<span class="heat-cell level-${level}" title="${day} · ${n}개 기록"></span>`;
  }).join("");
}

async function addCurrentPhraseToSrs() {
  const user = await currentUser();
  if (!user) return;
  const expression = document.getElementById("dailyPhrase")?.textContent?.trim();
  if (!expression) return;
  const meaning = document.getElementById("dailyMeaning")?.textContent?.trim() || "";
  const example = document.getElementById("dailyExample")?.textContent?.trim() || "";
  await supabase.from("review_items").upsert({
    user_id: user.id,
    expression,
    meaning,
    example,
    due_date: isoDate(new Date())
  }, { onConflict: "user_id,expression" });
  await loadReviews();
}

async function loadReviews() {
  const user = await currentUser();
  if (!user) {
    reviewItems = [];
    renderReview();
    return;
  }
  const today = isoDate(new Date());
  const { data } = await supabase.from("review_items").select("*").lte("due_date", today).order("due_date").limit(20);
  reviewItems = data || [];
  reviewIndex = 0;
  renderReview();
}

function renderReview() {
  if (!reviewCard || !reviewCount) return;
  reviewCount.textContent = `${reviewItems.length}개 복습 예정`;
  const item = reviewItems[reviewIndex];
  if (!item) {
    reviewCard.innerHTML = '<p class="review-empty">오늘 복습할 표현이 없습니다.</p>';
    return;
  }
  reviewCard.innerHTML = `
    <p class="review-expression">${escapeHtml(item.expression)}</p>
    <button class="text-link" id="revealReview" type="button">뜻 보기</button>
    <div id="reviewAnswer" hidden><p>${escapeHtml(item.meaning || "")}</p><small>${escapeHtml(item.example || "")}</small></div>
    <div class="review-actions">
      <button data-quality="1" type="button">다시</button>
      <button data-quality="3" type="button">어려움</button>
      <button data-quality="4" type="button">좋음</button>
      <button data-quality="5" type="button">쉬움</button>
    </div>`;
  document.getElementById("revealReview")?.addEventListener("click", () => {
    document.getElementById("reviewAnswer").hidden = false;
  });
  reviewCard.querySelectorAll("[data-quality]").forEach((button) => button.addEventListener("click", () => gradeReview(item, Number(button.dataset.quality))));
}

async function gradeReview(item, quality) {
  let repetitions = quality < 3 ? 0 : item.repetitions + 1;
  let interval = quality < 3 ? 1 : repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.max(1, Math.round(item.interval_days * item.ease_factor));
  let ease = Math.max(1.3, Number(item.ease_factor) + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const due = new Date();
  due.setDate(due.getDate() + interval);
  await supabase.from("review_items").update({
    repetitions,
    interval_days: interval,
    ease_factor: ease,
    due_date: isoDate(due),
    last_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", item.id);
  reviewItems.splice(reviewIndex, 1);
  renderReview();
}

async function scoreWriting() {
  const text = document.getElementById("writingInput")?.value?.trim();
  if (!text) {
    writingScore.textContent = "먼저 글을 작성해 주세요.";
    return;
  }
  scoreWritingButton.disabled = true;
  writingScore.textContent = "AI가 문법·자연스러움·구성을 평가하고 있습니다…";
  try {
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "writing-score",
        text,
        instruction: "한국어 학습자의 글을 100점 만점으로 평가하고 문법, 자연스러움, 어휘, 구성 점수와 핵심 수정 3개, 자연스러운 전체 교정문을 한국어로 제공하세요."
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "평가 실패");
    writingScore.textContent = data.reply || data.feedback || data.result || JSON.stringify(data);
  } catch (error) {
    writingScore.textContent = `평가를 완료하지 못했습니다: ${error.message}`;
  } finally {
    scoreWritingButton.disabled = false;
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.getElementById("savePhrase")?.addEventListener("click", () => setTimeout(addCurrentPhraseToSrs, 200));
scoreWritingButton?.addEventListener("click", scoreWriting);
supabase.auth.onAuthStateChange(() => { renderHeatmap(); loadReviews(); });
renderHeatmap();
loadReviews();
