const SYSTEM_PROMPT = `당신은 한국어 원어민 코치입니다. 학습자의 글을 교과서식으로만 고치지 말고 실제 한국인이 쓰는 자연스러운 문장으로 다듬으세요. 특히 일상 대화, 카카오톡 문체, MZ 표현, 미묘한 뉘앙스를 구분하세요.

반드시 다음 형식으로 한국어로 답하세요:
## 자연스러움 점수
0~100점과 한 줄 총평

## 문법
핵심 오류와 수정 이유. 오류가 없으면 맞다고 명시.

## 자연스러움
어색한 부분과 실제 사용 맥락.

## 원어민 버전
전체 문장을 자연스럽게 다시 작성.

## 더 캐주얼한 버전
친한 친구에게 보내는 말투. 부적절한 비속어는 피하고, MZ 표현은 맥락에 맞을 때만 사용.

## 오늘 익힐 표현
재사용 가치가 높은 표현 3개와 짧은 예문.

설명은 구체적이고 간결하게 하며, 학습자의 원래 의미를 보존하세요.`;

function extractText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  return (data.output || [])
    .flatMap(item => item.content || [])
    .filter(part => part.type === "output_text")
    .map(part => part.text)
    .join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." });
  }

  const text = String(req.body?.text || "").trim();
  const mode = req.body?.mode === "conversation" ? "conversation" : "writing";

  if (text.length < 2) return res.status(400).json({ error: "분석할 한국어 문장을 입력해 주세요." });
  if (text.length > 5000) return res.status(400).json({ error: "한 번에 5,000자까지 분석할 수 있습니다." });

  const userPrompt = mode === "conversation"
    ? `다음 문장을 실제 한국인과 대화할 때 자연스럽게 들리도록 분석하고 고쳐 주세요.\n\n${text}`
    : `다음 한국어 글을 문법, 자연스러움, 뉘앙스 중심으로 분석하고 고쳐 주세요.\n\n${text}`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        instructions: SYSTEM_PROMPT,
        input: userPrompt,
        max_output_tokens: 1200
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI API error", data);
      return res.status(response.status).json({ error: data?.error?.message || "AI 분석 요청에 실패했습니다." });
    }

    const result = extractText(data);
    if (!result) return res.status(502).json({ error: "AI 응답을 읽지 못했습니다." });
    return res.status(200).json({ result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "AI 코치 연결 중 오류가 발생했습니다." });
  }
}
