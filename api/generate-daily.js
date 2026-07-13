import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

const SYSTEM_PROMPT = `한국어 원어민 수준의 몰입형 일일 학습 콘텐츠를 JSON으로 생성하세요. 실제 한국 사회·문화·여행·언어 자료를 바탕으로 하되 원문을 복사하지 말고 학습용으로 새롭게 작성하세요. 출력 필드: title, theme, reading, expressions, mz_expressions, speaking_task, writing_task, review_task, difficulty, source_urls. expressions와 mz_expressions는 [{"expression":"","meaning":"","example":""}] 형식입니다.`;

function stripFence(text) {
  return String(text || "").replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
}

function extractOpenAIText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text)
    .join("\n");
}

function extractGeminiText(data) {
  return (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n");
}

async function generateWithGemini(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
          maxOutputTokens: 2200
        }
      })
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Gemini 요청 실패");
  return extractGeminiText(data);
}

async function generateWithOpenAI(prompt) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      instructions: SYSTEM_PROMPT,
      input: prompt,
      max_output_tokens: 2200
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI 요청 실패");
  return extractOpenAIText(data);
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "GET 또는 POST만 지원합니다." });
  }

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return res.status(500).json({ error: "Supabase 환경 변수가 필요합니다." });
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY 또는 OPENAI_API_KEY가 필요합니다." });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  try {
    const { data: existing, error: existingError } = await supabase
      .from("daily_lessons")
      .select("id")
      .eq("lesson_date", date)
      .limit(1);

    if (existingError) throw existingError;
    if (existing?.length) {
      return res.status(200).json({ ok: true, skipped: true, lesson_date: date });
    }

    const { data: sources, error: sourcesError } = await supabase
      .from("content_sources")
      .select("name,url,category")
      .eq("is_active", true)
      .limit(5);

    if (sourcesError) throw sourcesError;

    const sourceText = (sources || [])
      .map((item) => `${item.name} | ${item.category} | ${item.url}`)
      .join("\n");

    const prompt = `오늘 날짜: ${date}\n사용 가능한 출처:\n${sourceText}\n\n중급 학습자용으로 20분 분량의 일일 수업을 생성하세요. 정치·의료·법률·금융처럼 고위험 주제는 피하세요.`;
    const rawText = process.env.GEMINI_API_KEY
      ? await generateWithGemini(prompt)
      : await generateWithOpenAI(prompt);

    let lesson;
    try {
      lesson = JSON.parse(stripFence(rawText));
    } catch {
      return res.status(502).json({ error: "AI JSON 응답을 해석하지 못했습니다." });
    }

    const row = {
      title: lesson.title,
      theme: lesson.theme,
      reading: lesson.reading,
      expressions: lesson.expressions || [],
      mz_expressions: lesson.mz_expressions || [],
      speaking_task: lesson.speaking_task,
      writing_task: lesson.writing_task,
      review_task: lesson.review_task,
      difficulty: lesson.difficulty || "intermediate",
      source_urls: lesson.source_urls || (sources || []).map((item) => item.url)
    };

    const { data: inserted, error: insertError } = await supabase
      .rpc("insert_daily_lesson", { payload: row })
      .single();

    if (insertError) throw insertError;
    return res.status(200).json({ ok: true, provider: process.env.GEMINI_API_KEY ? "gemini" : "openai", lesson: inserted });
  } catch (error) {
    console.error("daily lesson generation failed", error);
    return res.status(500).json({ error: error.message || "일일 수업 생성 실패" });
  }
}
