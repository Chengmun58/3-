import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const PREF_KEY = "maeil-korean-preferences-v1";
const QUIZ_KEY = "maeil-korean-quiz-v1";

const translations = {
  ko: { title:"학습 스튜디오", plan:"나의 학습 계획", quiz:"TOPIK 미니 테스트", chat:"AI 역할 대화", share:"오늘의 학습 공유", save:"계획 저장", start:"테스트 시작", send:"보내기", copy:"결과 복사" },
  zh: { title:"学习工作室", plan:"我的学习计划", quiz:"TOPIK 小测", chat:"AI 情景对话", share:"分享今日学习", save:"保存计划", start:"开始测试", send:"发送", copy:"复制结果" },
  en: { title:"Learning Studio", plan:"My learning plan", quiz:"TOPIK mini test", chat:"AI roleplay", share:"Share today", save:"Save plan", start:"Start test", send:"Send", copy:"Copy result" }
};

const questions = [
  { q:"‘회의가 길어져서 점심을 ___ 먹었다.’에 가장 자연스러운 말은?", options:["대충","차라리","괜히","막상"], answer:0, note:"대충 먹다 = 간단히 또는 충분하지 않게 먹다." },
  { q:"‘SNS를 보다 보면 괜히 ___ 때가 있다.’", options:["조급해질","조용할","익숙할","정확할"], answer:0, note:"괜히 조급해지다 는 비교 상황에서 자주 쓰입니다." },
  { q:"‘처음에는 어려웠지만 몇 번 해 보니 감이 ___.’", options:["섰다","왔다","났다","들었다"], answer:1, note:"감이 오다 = 방법이나 상황을 대략 이해하다." },
  { q:"상대 의견을 인정하면서 반대할 때 가장 자연스러운 문장은?", options:["그건 틀렸어요.","그럴 수는 있는데 일정은 다시 봐야 할 것 같아요.","절대 안 돼요.","모르겠어요."], answer:1, note:"~기는/수는 한데 구조는 인정 뒤에 다른 의견을 덧붙입니다." },
  { q:"친구에게 ‘정말 웃기다’를 가장 자연스럽게 문자로 쓰면?", options:["매우 재미있습니다.","개웃겨ㅋㅋ", "웃음이 발생합니다.","재미를 느낍니다."], answer:1, note:"개웃겨ㅋㅋ 는 친한 사이의 매우 캐주얼한 표현입니다." }
];

function loadPrefs(){ try{return JSON.parse(localStorage.getItem(PREF_KEY))||{daily_minutes:20,focus:"native-fluency",interface_language:"ko",theme:"system"};}catch{return {daily_minutes:20,focus:"native-fluency",interface_language:"ko",theme:"system"};} }
let prefs=loadPrefs();
let quizIndex=0, quizCorrect=0, quizAnswers=[];

function inject(){
  const growth=document.getElementById("growth");
  if(!growth) return;
  const section=document.createElement("section");
  section.id="studio"; section.className="section-block section-shell suite-section";
  section.innerHTML=`<div class="section-heading"><div><p class="eyebrow">PERSONAL STUDIO</p><h2 id="suiteTitle"></h2></div></div>
  <div class="suite-grid">
    <article class="suite-card"><p class="eyebrow">PLAN</p><h3 id="planTitle"></h3><div class="plan-row"><label>하루 목표<input id="dailyMinutes" type="number" min="5" max="180" value="${prefs.daily_minutes}"></label><label>집중 영역<select id="focusArea"><option value="native-fluency">원어민 반응</option><option value="topik">TOPIK</option><option value="work">직장 한국어</option><option value="travel">여행·생활</option></select></label></div><div class="plan-summary"><span>이번 주 목표</span><strong id="weeklyGoal"></strong></div><div class="suite-actions"><button class="button dark small" id="savePlan"></button></div><div class="suite-output" id="planOutput">매일 짧게라도 출력하면 기록과 복습 일정이 자동으로 쌓입니다.</div></article>
    <article class="suite-card"><p class="eyebrow">TOPIK</p><h3 id="quizTitle"></h3><div id="quizBox" class="suite-output">어휘·문법·자연스러운 표현을 5문제로 확인합니다.</div><div class="suite-actions"><button class="button dark small" id="startQuiz"></button></div></article>
    <article class="suite-card"><p class="eyebrow">ROLEPLAY</p><h3 id="chatTitle"></h3><label>상황<select id="roleScenario"><option value="friend">친구와 카톡</option><option value="work">직장 동료와 일정 조율</option><option value="travel">한국 여행 중 문제 해결</option><option value="dating">친구·데이트 약속 잡기</option></select></label><div id="chatLog" class="chat-log"><div class="chat-message ai">상황을 고른 뒤 한국어로 먼저 말을 걸어 보세요. 답변 뒤에는 짧은 교정도 제공합니다.</div></div><textarea id="chatInput" rows="4" placeholder="한국어로 답해 보세요."></textarea><div class="suite-actions"><button class="button dark small" id="sendChat"></button></div></article>
    <article class="suite-card"><p class="eyebrow">SHARE</p><h3 id="shareTitle"></h3><div class="share-card" id="shareCard"></div><div class="suite-actions"><button class="button ghost small" id="copyShare"></button></div></article>
  </div>`;
  growth.insertAdjacentElement("afterend",section);
  const toolbar=document.createElement("div"); toolbar.className="suite-toolbar";
  toolbar.innerHTML='<button id="themeToggle" type="button">◐ 테마</button><button id="langToggle" type="button">文 언어</button><a class="button ghost small" href="#studio">학습 도구</a>';
  document.body.appendChild(toolbar);
  bind(); applyPrefs(); renderShare();
}

function t(){return translations[prefs.interface_language]||translations.ko;}
function applyPrefs(){
  document.documentElement.dataset.theme=prefs.theme==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):prefs.theme;
  const x=t();
  [["suiteTitle",x.title],["planTitle",x.plan],["quizTitle",x.quiz],["chatTitle",x.chat],["shareTitle",x.share],["savePlan",x.save],["startQuiz",x.start],["sendChat",x.send],["copyShare",x.copy]].forEach(([id,text])=>{const el=document.getElementById(id);if(el)el.textContent=text;});
  const focus=document.getElementById("focusArea"); if(focus) focus.value=prefs.focus;
  const weekly=document.getElementById("weeklyGoal"); if(weekly) weekly.textContent=`${prefs.daily_minutes*7}분`;
}

async function savePlan(){
  prefs.daily_minutes=Math.max(5,Math.min(180,Number(document.getElementById("dailyMinutes").value)||20));
  prefs.focus=document.getElementById("focusArea").value;
  localStorage.setItem(PREF_KEY,JSON.stringify(prefs)); applyPrefs();
  const {data:{user}}=await supabase.auth.getUser();
  if(user) await supabase.from("user_learning_preferences").upsert({user_id:user.id,...prefs,updated_at:new Date().toISOString()});
  document.getElementById("planOutput").textContent=`하루 ${prefs.daily_minutes}분 · ${document.getElementById("focusArea").selectedOptions[0].textContent} 중심 계획을 저장했습니다.`;
}

function startQuiz(){quizIndex=0;quizCorrect=0;quizAnswers=[];renderQuestion();}
function renderQuestion(){
  const box=document.getElementById("quizBox"), q=questions[quizIndex];
  if(!q){finishQuiz();return;}
  box.innerHTML=`<strong>${quizIndex+1}/${questions.length}</strong><p>${q.q}</p>${q.options.map((o,i)=>`<button class="quiz-option" data-answer="${i}">${o}</button>`).join("")}`;
  box.querySelectorAll("[data-answer]").forEach(b=>b.addEventListener("click",()=>answerQuiz(Number(b.dataset.answer))));
}
function answerQuiz(choice){
  const q=questions[quizIndex],correct=choice===q.answer; if(correct)quizCorrect++;
  quizAnswers.push({question:q.q,choice,correct});
  const box=document.getElementById("quizBox"); box.innerHTML=`<strong>${correct?"정답":"오답"}</strong><p>${q.note}</p><button class="button dark small" id="nextQuiz">다음</button>`;
  document.getElementById("nextQuiz").addEventListener("click",()=>{quizIndex++;renderQuestion();});
}
async function finishQuiz(){
  const score=Math.round(quizCorrect/questions.length*100); localStorage.setItem(QUIZ_KEY,JSON.stringify({score,date:new Date().toISOString()}));
  document.getElementById("quizBox").innerHTML=`<div class="topik-score">${score}점</div><p>${quizCorrect}/${questions.length} 정답 · 틀린 문제는 자동 복습 표현과 함께 다시 확인하세요.</p>`;
  const {data:{user}}=await supabase.auth.getUser(); if(user) await supabase.from("quiz_attempts").insert({user_id:user.id,score,total_questions:questions.length,answers:quizAnswers});
  renderShare();
}

async function sendChat(){
  const input=document.getElementById("chatInput"), text=input.value.trim(); if(!text)return;
  const log=document.getElementById("chatLog"), scenario=document.getElementById("roleScenario").selectedOptions[0].textContent;
  log.insertAdjacentHTML("beforeend",`<div class="chat-message user">${escapeHtml(text)}</div>`); input.value=""; log.scrollTop=log.scrollHeight;
  const wait=document.createElement("div");wait.className="chat-message ai";wait.textContent="답변을 만드는 중…";log.appendChild(wait);
  try{
    const response=await fetch("/api/coach",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"roleplay",text,instruction:`${scenario} 상황의 한국인 역할로 자연스럽게 1~2문장 답하고, 이어서 학습자의 문장을 더 원어민답게 고친 문장과 핵심 이유 1개를 짧게 제공하세요.`})});
    const data=await response.json(); if(!response.ok)throw new Error(data.error||"AI 응답 실패"); wait.textContent=data.reply||data.feedback||data.result||JSON.stringify(data);
  }catch(e){wait.textContent=`현재 AI가 혼잡합니다. 잠시 후 다시 시도해 주세요. (${e.message})`;}
  log.scrollTop=log.scrollHeight;
}

function renderShare(){
  let state={entries:[],checks:{}};try{state=JSON.parse(localStorage.getItem("maeil-korean-v2")||"{}")||state;}catch{}
  const today=new Intl.DateTimeFormat("en-CA").format(new Date()); const todayEntries=(state.entries||[]).filter(e=>e.date===today); const checks=state.checks?.[today]||{}; const done=Object.values(checks).filter(Boolean).length; const quiz=JSON.parse(localStorage.getItem(QUIZ_KEY)||"null");
  document.getElementById("shareCard").textContent=`오늘 한국어 기록 ${todayEntries.length}개 · 루틴 ${done}/4 완료${quiz?` · TOPIK ${quiz.score}점`:""}\n번역보다 반응, 완벽함보다 꾸준함.`;
}
async function copyShare(){const text=document.getElementById("shareCard").textContent;await navigator.clipboard.writeText(text);document.getElementById("copyShare").textContent="복사 완료";setTimeout(applyPrefs,1200);}
function escapeHtml(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function bind(){
  document.getElementById("savePlan").addEventListener("click",savePlan); document.getElementById("startQuiz").addEventListener("click",startQuiz); document.getElementById("sendChat").addEventListener("click",sendChat); document.getElementById("copyShare").addEventListener("click",copyShare);
  document.getElementById("themeToggle").addEventListener("click",()=>{prefs.theme=document.documentElement.dataset.theme==="dark"?"light":"dark";localStorage.setItem(PREF_KEY,JSON.stringify(prefs));applyPrefs();});
  document.getElementById("langToggle").addEventListener("click",()=>{prefs.interface_language=prefs.interface_language==="ko"?"zh":prefs.interface_language==="zh"?"en":"ko";localStorage.setItem(PREF_KEY,JSON.stringify(prefs));applyPrefs();});
}

inject();