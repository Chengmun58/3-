import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SYSTEM_PROMPT = `한국어 원어민 수준의 몰입형 일일 학습 콘텐츠를 JSON으로 생성하세요. 실제 한국 사회·문화·여행·언어 자료를 바탕으로 하되 원문을 복사하지 말고 학습용으로 새롭게 작성하세요. 출력 필드: title, theme, reading, expressions, mz_expressions, speaking_task, writing_task, review_task, difficulty, source_urls. expressions와 mz_expressions는 [{"expression":"","meaning":"","example":""}] 형식입니다.`;

function extractText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  return (data.output || []).flatMap(item => item.content || []).filter(part => part.type === "output_text").map(part => part.text).join("\n");
}

function stripFence(text) {
  return text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "GET 또는 POST만 지원합니다." });
  if (!process.env.OPENAI_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) {
    return res.status(500).json({ error: "서버 환경 변수가 부족합니다." });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  const { data: existing } = await supabase.from("daily_lessons").select("id").eq("lesson_date", date).maybeSingle();
  if (existing) return res.status(200).json({ ok: true, skipped: true, lesson_date: date });

  const { data: sources } = await supabase.from("content_sources").select("name,url,category").eq("is_active", true).limit(5);
  const sourceText = (sources || []).map(item => `${item.name} | ${item.category} | ${item.url}`).join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-5-mini",
      instructions: SYSTEM_PROMPT,
      input: `오늘 날짜: ${date}\n사용 가능한 출처:\n${sourceText}\n\n중급 학습자용으로 20분 분량의 일일 수업을 생성하세요. 정치·의료·법률·금융처럼 고위험 주제는 피하세요.`,
      max_output_tokens: 2200
    })
  });

  const payload = await response.json();
  if (!response.ok) return res.status(response.status).json({ error: payload?.error?.message || "OpenAI 요청 실패" });

  let lesson;
  try { lesson = JSON.parse(stripFence(extractText(payload))); }
  catch { return res.status(502).json({ error: "AI JSON 응답을 해석하지 못했습니다." }); }

  const row = {
    lesson_date: date,
    title: lesson.title,
    theme: lesson.theme,
    reading: lesson.reading,
    expressions: lesson.expressions || [],
    mz_expressions: lesson.mz_expressions || [],
    speaking_task: lesson.speaking_task,
    writing_task: lesson.writing_task,
    review_task: lesson.review_task,
    difficulty: lesson.difficulty || "intermediate",
    source_urls: lesson.source_urls || (sources || []).map(item => item.url),
    status: "published",
    generated_by: "openai"
  };

  const { data, error } = await supabase.from("daily_lessons").insert(row).select("lesson_date,title").single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, lesson: data });
}
