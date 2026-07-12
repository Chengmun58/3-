const writingInput = document.getElementById("writingInput");
const coachBox = document.getElementById("coachResult");

if (writingInput && coachBox) {
  const actions = document.createElement("div");
  actions.className = "ai-coach-actions";
  actions.innerHTML = `
    <button id="runWritingCoach" class="button primary small" type="button">AI 첨삭 받기</button>
    <button id="runConversationCoach" class="button ghost small" type="button">대화체로 바꾸기</button>
  `;
  coachBox.insertAdjacentElement("afterend", actions);

  const resultPanel = document.createElement("section");
  resultPanel.id = "aiCoachPanel";
  resultPanel.className = "ai-coach-panel";
  resultPanel.hidden = true;
  resultPanel.innerHTML = `
    <div class="ai-coach-head">
      <div><span class="tag">AI COACH</span><h3>원어민 첨삭</h3></div>
      <button id="closeCoachPanel" class="text-link" type="button">닫기</button>
    </div>
    <div id="aiCoachOutput" class="ai-coach-output" aria-live="polite"></div>
  `;
  actions.insertAdjacentElement("afterend", resultPanel);

  const output = resultPanel.querySelector("#aiCoachOutput");

  function escapeHTML(value = "") {
    return value.replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  }

  function renderMarkdown(text) {
    return escapeHTML(text)
      .replace(/^## (.+)$/gm, "<h4>$1</h4>")
      .replace(/^### (.+)$/gm, "<h5>$1</h5>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  async function runCoach(mode) {
    const text = writingInput.value.trim();
    if (!text) {
      coachBox.textContent = "먼저 한국어 문장을 입력해 주세요.";
      writingInput.focus();
      return;
    }

    resultPanel.hidden = false;
    output.innerHTML = "<p>AI가 문법과 자연스러움을 분석하고 있습니다…</p>";
    actions.querySelectorAll("button").forEach(button => button.disabled = true);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI 분석에 실패했습니다.");
      output.innerHTML = renderMarkdown(data.result);
      resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      output.innerHTML = `<p class="ai-error">${escapeHTML(error.message)}</p>`;
    } finally {
      actions.querySelectorAll("button").forEach(button => button.disabled = false);
    }
  }

  document.getElementById("runWritingCoach").addEventListener("click", () => runCoach("writing"));
  document.getElementById("runConversationCoach").addEventListener("click", () => runCoach("conversation"));
  document.getElementById("closeCoachPanel").addEventListener("click", () => { resultPanel.hidden = true; });

  const style = document.createElement("style");
  style.textContent = `
    .ai-coach-actions{display:flex;gap:.65rem;flex-wrap:wrap;margin:.8rem 0 0}
    .ai-coach-panel{margin-top:1rem;border:1px solid rgba(33,33,30,.18);background:#faf8f2;padding:1.2rem;border-radius:18px}
    .ai-coach-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem}
    .ai-coach-head h3{margin:.35rem 0 0}
    .ai-coach-output{line-height:1.75;white-space:normal}
    .ai-coach-output h4{font-size:1rem;margin:1.35rem 0 .35rem;padding-top:.8rem;border-top:1px solid rgba(33,33,30,.12)}
    .ai-coach-output h4:first-child{margin-top:0;border-top:0;padding-top:0}
    .ai-coach-output h5{margin:1rem 0 .25rem}
    .ai-error{color:#9f2f2f}
    .ai-coach-actions button:disabled{opacity:.55;cursor:wait}
  `;
  document.head.appendChild(style);
}
