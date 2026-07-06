// Vercel serverless function: POST /api/generate
// 환경변수 OPENROUTER_API_KEY 에 OpenRouter 키를 넣어두면 됩니다(코드에 키를 적지 마세요).
// 모델 슬러그는 https://openrouter.ai/models 에서 현재 Claude 모델로 맞추세요.
const MODEL = "anthropic/claude-sonnet-4.5"; // 필요 시 openrouter.ai/models 의 최신 Claude 슬러그로 교체

const SYSTEM = `너는 파이온의 SNS 광고 최종 보고서 분석가야. 주어진 [최종 보고서]와 [조건]을 보고 보고서의 "4. 인사이트"와 "5. 향후 제언"만 작성해. 구글 문서에 그대로 붙여넣을 플레인 텍스트로.

[출력 형식 — 매우 중요]
- 마크다운 기호를 절대 쓰지 마라. '#', '##', '###', '**', '*', '---', 백틱, '>' 같은 기호 금지.
- 섹션 제목은 정확히 "4. 인사이트" 와 "5. 향후 제언" 두 줄로만 쓴다(앞에 # 붙이지 말 것).
- 인사이트 소제목은 대괄호 명사형으로: [운영 변경 이력], [소재], [노출 지면], [반응 고객층], [클릭 비용(CPC) 추세], [다음 단계]. (## 같은 기호 없이 대괄호 그대로)
- 제언 항목은 ① ② ③ ④ ⑤ 원문자 번호로 시작한다.
- 강조는 굵게(**) 쓰지 말고 그냥 문장으로. 불릿이 필요하면 문장 앞에 '- ' 하이픈 하나만.

[규칙]
- 대상자(초심자/경험자)에 맞춰. 초심자면 지면 제외·CPM 분해 같은 전문 용어 대신 소재·자동화 신뢰·'내 고객' 이해로 번역.
- 데이터 재낭독 금지: 표의 숫자를 나열하지 말고 '그래서 무슨 의미인가'를 써라. 숫자는 근거로 최소만.
- 소제목은 명사형. 슬로건·구어체 금지. 존댓말, 단정 금지(~보입니다/~권장합니다). 범위 표기는 물결표 대신 엔대시(–).
- 인사이트=진단, 제언=처방. 같은 내용 반복 금지.
- [운영 변경 이력]을 4번 맨 앞에: 카톡에서 우리가 한 액션(소재 교체·타겟 전환·랜딩 변경·예산 연장)을 시점별로, 액션 후 성과 변화(주차별 CPC/CTR)를 인과로.
- CPC=CPM×CTR로 분해해 원인 규명. 작은 표본은 단정 말고 '테스트 권장'.
- 랜딩이 자사몰이 아니면(스마트스토어·오늘의집·무신사·29CM 등 입점몰) '구매 목표 캠페인'을 절대 언급하지 마라(불가 설명도 넣지 마). 전환은 입점몰 판매자 통계·상세페이지·리뷰로 점검하라고.
- 유입은 많은데 매출이 매우 저조하면(랜딩·프로모션 바꿔도 0): 상세페이지 점검 → 그래도 안 되면 제품·가격·오퍼 자체를 재점검할 시점이라고 '톤다운'해서 짚어라('제품이 매력없다' 같은 직설 금지).
- 제언은 손에 잡히는 전술 + 짧은 이유 + 광고 밖(스토어·리뷰·상세페이지)까지.`;

function extractDocId(link) {
  const m = String(link || "").match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function fetchGoogleDoc(link) {
  const docId = extractDocId(link);
  if (!docId) return { error: "올바른 구글 문서 링크가 아닙니다." };
  const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const r = await fetch(url, { redirect: "follow" });
  const text = await r.text();
  // 로그인 페이지(HTML)가 오면 = 공유가 '링크가 있는 모든 사용자'가 아님
  if (!r.ok || /<html|<!DOCTYPE|accounts\.google\.com|ServiceLogin|Sign in|로그인/i.test(text.slice(0, 3000))) {
    return { error: "구글 문서를 열 수 없습니다. 문서 공유를 '링크가 있는 모든 사용자 · 뷰어'로 설정한 뒤 다시 시도하세요." };
  }
  if (!text.trim()) return { error: "문서 내용이 비어 있습니다." };
  return { text };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    const { drive, csv, level, landing } = req.body || {};
    if (!drive || !String(drive).trim()) { res.status(400).json({ error: "최종 보고서 구글 문서 링크를 입력하세요." }); return; }
    if (!csv || !String(csv).trim()) { res.status(400).json({ error: "광고주 카톡 CSV 내용이 비어 있습니다." }); return; }

    const doc = await fetchGoogleDoc(drive);
    if (doc.error) { res.status(400).json({ error: doc.error }); return; }

    const user =
      `[대상자] ${level || "초심자"}\n` +
      `[랜딩] ${landing || "미지정"}\n\n` +
      `[최종 보고서]\n${doc.text}\n\n` +
      `[광고주 카톡 (CSV: DATE,USER,MESSAGE)]\n${csv}\n\n` +
      `위 규칙에 따라 "4. 인사이트"와 "5. 향후 제언"만, 마크다운 기호 없이 플레인 텍스트로 작성해줘.`;

    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      res.status(502).json({ error: "생성 서버 오류", detail: t.slice(0, 500) });
      return;
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || "(생성 결과가 비어 있습니다)";
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "요청 처리 중 오류", detail: String(e).slice(0, 300) });
  }
}
