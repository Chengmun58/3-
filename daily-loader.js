import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function setText(id, value) {
  const element = document.getElementById(id);
  if (element && value) element.textContent = value;
}

async function loadTodayLesson() {
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data, error } = await supabase
    .from("daily_lessons")
    .select("lesson_date,title,theme,reading,expressions,mz_expressions,speaking_task,writing_task,source_urls")
    .eq("lesson_date", today)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return;

  setText("readingTitle", data.title || data.theme);
  setText("readingBody", data.reading);
  setText("reactionPrompt", data.speaking_task);
  setText("writingTopic", data.writing_task);

  if (Array.isArray(data.expressions) && data.expressions[0]) {
    const item = data.expressions[0];
    setText("dailyPhrase", item.expression || item.word || item.phrase);
    setText("dailyMeaning", item.meaning || item.definition);
    setText("dailyExample", item.example);
  }

  const mzList = document.getElementById("mzList");
  if (mzList && Array.isArray(data.mz_expressions)) {
    mzList.replaceChildren();
    for (const item of data.mz_expressions) {
      const row = document.createElement("div");
      const strong = document.createElement("strong");
      const span = document.createElement("span");
      strong.textContent = item.expression || item.word || item.phrase || "";
      span.textContent = item.meaning || item.definition || item.example || "";
      row.append(strong, span);
      mzList.append(row);
    }
    setText("mzCount", `${data.mz_expressions.length}개`);
  }

  document.body.dataset.lessonSource = "supabase";
}

loadTodayLesson();
