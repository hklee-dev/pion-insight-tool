// Vercel serverless function: POST /api/generate
// 환경변수 OPENROUTER_API_KEY 에 OpenRouter 키를 넣어두면 됩니다(코드에 키를 적지 마세요).
// 환경변수 LOG_WEBHOOK_URL 에 구글 Apps Script 웹앱 URL을 넣으면 모든 생성 건이 시트에 기록됩니다(선택).
// 모델 슬러그는 https://openrouter.ai/models 에서 현재 Claude 모델로 맞추세요.
const MODEL = "anthropic/claude-sonnet-4.5"; // 필요 시 openrouter.ai/models 의 최신 Claude 슬러그로 교체

// 긴 보고서 생성이 기본 제한(10초)에 잘리지 않도록 실행시간 확보.
export const config = { maxDuration: 60 };

const SYSTEM = `너는 파이온의 SNS 광고 최종 보고서 분석가야. 주어진 [최종 보고서]와 [조건]을 보고 보고서의 "4. 인사이트"와 "5. 향후 제언"만 작성해. 구글 문서에 그대로 붙여넣을 플레인 텍스트로.

[출력 형식 — 매우 중요]
- 반드시 100% 한국어로만 쓴다. 일본어 히라가나·가타카나(です·ます·だ 등) 절대 혼입 금지. 모든 문장은 '-습니다/-합니다/-입니다'로 끝낸다('중요합니です' 같은 일본어 종결 금지).
- 마크다운 기호를 절대 쓰지 마라. '#', '##', '###', '**', '*', '---', 백틱, '>' 같은 기호 금지.
- 섹션 제목은 정확히 "4. 인사이트" 와 "5. 향후 제언" 두 줄로만 쓴다(앞에 # 붙이지 말 것).
- 인사이트 소제목은 대괄호 명사형으로: [운영 변경 이력], [소재], [노출 지면], [반응 고객층], [클릭 비용(CPC) 추세]. (## 같은 기호 없이 대괄호 그대로) [다음 단계]는 넣지 마 — 다음 할 일·실행 제안은 5번 제언에서만 쓴다(4번은 진단만).
- 제언 항목은 ① ② ③ ④ ⑤ 원문자 번호로 시작한다.
- 강조는 굵게(**) 쓰지 말고 그냥 문장으로. 불릿이 필요하면 문장 앞에 '- ' 하이픈 하나만.

[규칙]
- 대상자(초심자/경험자)에 맞춰. 초심자면 지면 제외·CPM 분해 같은 전문 용어 대신 소재·자동화 신뢰·'내 고객' 이해로 번역.
- 데이터 재낭독 금지: 표의 숫자를 나열하지 말고 '그래서 무슨 의미인가'를 써라. 숫자는 근거로 최소만.
- 소제목은 명사형. 슬로건·구어체 금지. 존댓말, 단정 금지(~보입니다/~권장합니다). 범위(나이·가격·기간)는 물결표(~, 일본어식 전각 ～·물결대시 〜) 절대 금지, 엔대시(–)만 사용. 예: "45–64세", "187–210원".
- 출력 본문에 '광고주'라는 호칭을 쓰지 마라. 보고서는 사업자 본인이 읽으므로 3인칭 '광고주'는 거리감을 준다. 대신 "자체적으로 운영 중이신", "직접 광고를 운영해오신", "대표님께서" 같은 표현이나 2인칭·생략으로 자연스럽게 지칭한다.
- 인사이트=진단, 제언=처방. 같은 내용 반복 금지.
- [운영 변경 이력]을 4번 맨 앞에: 카톡에서 우리가 한 액션(소재 교체·타겟 전환·랜딩 변경·예산 연장)을 시점별로, 액션 후 성과 변화(주차별 CPC/CTR)를 인과로.
- CPC=CPM×CTR로 분해해 원인 규명. 작은 표본은 단정 말고 '테스트 권장'.
- 제언은 관측 데이터가 직접 지지하는 행동만. 지면·소재·타겟 성과는 소재 포맷·지면 배분·타겟 세트 레버로 연결한다. '특정 지면 CTR 높음 → 할인·사은품·한정 이벤트/긴급성 소재' 같은 판촉·오퍼·가격 레버로 비약 금지(옳은 예: 그 지면 규격에 맞는 세로 소재를 이번 위닝 포맷으로 소액 테스트). CTR 높아도 CPM 비싼 지면은 '더 밀어라'가 아니라 '소액 테스트'.
- 못 본 자산(상세페이지·스토어·리뷰)엔 개선을 단정 처방하지 마라 — 이미 돼 있을 수 있다. 조건부('유입 대비 구매가 기대보다 낮다면')+점검 체크리스트('~돼 있는지 점검, 아니라면 ~')+'이미 잘 돼 있으면 그대로'로 쓴다.
- 우리가 측정 못 한 걸 '확인됐다'로 쓰지 마라. 픽셀 없는 입점몰의 스토어 방문·매출은 우리가 측정 불가 → '확인' 대신 광고주 진술이면 '광고주에 따르면 ~', 아니면 '~로 볼 수 있습니다'로 톤다운. '확인'은 실제 측정 지표(노출·클릭·CTR·CPC)에만.
- 랜딩이 자사몰이 아니면(스마트스토어·오늘의집·무신사·29CM 등 입점몰) '구매 목표 캠페인'과 'UTM 파라미터/전용 추적 링크 생성'을 절대 언급하지 마라(스마트스토어는 UTM 추적 자체가 불가, 불가 설명도 넣지 마). 전환은 입점몰 판매자 통계·상세페이지·리뷰로 점검하라고 하고, 광고 경로 매출을 분리하려면 쿠폰 코드·광고 전용 기획전 페이지·집행 전후 매출 시점 비교로 안내해라. (UTM·구매 캠페인 제언은 자사몰 랜딩일 때만.)
- 유입은 많은데 매출이 매우 저조하면(랜딩·프로모션 바꿔도 0): 상세페이지 점검 → 그래도 안 되면 제품·가격·오퍼 자체를 재점검할 시점이라고 '톤다운'해서 짚어라('제품이 매력없다' 같은 직설 금지).
- 제언은 손에 잡히는 전술 + 짧은 이유 + 광고 밖(스토어·리뷰·상세페이지)까지.`;

function extractDocId(link) {
  const m = String(link || "").match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// 보고서 본문에서 광고주(회사)명 추출 — 폼에 입력받지 않으므로 문서에서 가져온다.
function extractAdvertiser(text) {
  const lines = String(text || "").split(/[\r\n]+/).map((s) => s.trim()).filter((s) => s);
  const fi = lines.findIndex((l) => /Final Report/i.test(l));
  if (fi >= 0 && lines[fi + 1] && !/^Prepared by/i.test(lines[fi + 1])) return lines[fi + 1];
  const ni = lines.findIndex((l) => /님$/.test(l) && l.length < 30);
  if (ni > 0) return lines[ni - 1];
  return "";
}

// 생성 결과를 4번 인사이트 / 5번 제언 두 부분으로 분리 (제목 줄 제거).
function splitSections(text) {
  const t = String(text || "");
  const m5 = "5. 향후 제언";
  const i = t.indexOf(m5);
  let p4 = i >= 0 ? t.slice(0, i) : t;
  let p5 = i >= 0 ? t.slice(i) : "";
  const h4 = "4. 인사이트";
  if (p4.indexOf(h4) === 0) p4 = p4.slice(h4.length);
  if (p5.indexOf(m5) === 0) p5 = p5.slice(m5.length);
  return { p4: p4.trim(), p5: p5.trim() };
}

async function fetchGoogleDoc(link) {
  const docId = extractDocId(link);
  if (!docId) return { error: "올바른 구글 문서 링크가 아닙니다." };
  const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const r = await fetch(url, { redirect: "follow" });
  const text = await r.text();
  if (!r.ok || /<html|<!DOCTYPE|accounts\.google\.com|ServiceLogin|Sign in|로그인/i.test(text.slice(0, 3000))) {
    return { error: "구글 문서를 열 수 없습니다. 문서 공유를 '링크가 있는 모든 사용자 · 뷰어'로 설정한 뒤 다시 시도하세요." };
  }
  if (!text.trim()) return { error: "문서 내용이 비어 있습니다." };
  return { text };
}

// 모든 생성 건을 구글 시트(Apps Script 웹훅)에 기록 — 성공/실패 상관없이. best-effort.
async function logRun(payload) {
  const url = process.env.LOG_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });
  } catch (_) { /* 로깅 실패해도 생성에는 영향 없음 */ }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const body = req.body || {};
  const drive = body.drive || "";
  const csv = body.csv || "";
  const level = body.level || "";
  const landing = body.landing || "";
  try {
    if (!drive.trim()) { res.status(400).json({ error: "최종 보고서 구글 문서 링크를 입력하세요." }); return; }
    if (!csv.trim()) { res.status(400).json({ error: "광고주 카톡 CSV 내용이 비어 있습니다." }); return; }

    const doc = await fetchGoogleDoc(drive);
    if (doc.error) {
      await logRun({ advertiser: "", level, landing, drive, insight: "", rec: "", error: doc.error });
      res.status(400).json({ error: doc.error }); return;
    }
    const advertiser = extractAdvertiser(doc.text);

    const baseUser =
      `[대상자] ${level || "초심자"}\n` +
      `[랜딩] ${landing || "미지정"}\n\n` +
      `[최종 보고서]\n${doc.text}\n\n` +
      `[광고주 카톡 (CSV: DATE,USER,MESSAGE)]\n${csv}\n`;

    // 인사이트(4)와 제언(5)을 별도 호출로 "병렬" 생성한다.
    // 각 섹션이 짧아 60초 제한 안에서 완결되므로 긴 보고서에서도 짤리지 않는다(병렬이라 벽시계는 둘 중 느린 쪽).
    async function askAI(instruction) {
      const rr = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2800, // 한 섹션 상한 — 병렬이라 각 ~40초, 벽시계 ~45초로 60초 안. 한 섹션 완결엔 충분.
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: baseUser + "\n" + instruction },
          ],
        }),
      });
      const raw = await rr.text();
      if (!rr.ok) return { ok: false, content: "", err: raw.slice(0, 200) };
      let content = "";
      if (raw.trim()) { try { content = JSON.parse(raw)?.choices?.[0]?.message?.content || ""; } catch (_) {} }
      return { ok: true, content: content.trim(), err: "" };
    }

    const [ins, rec] = await Promise.all([
      askAI(`이번 응답에는 "4. 인사이트"만 작성해. "5. 향후 제언"은 별도로 작성되니 여기서는 절대 쓰지 마. 인사이트는 진단(무엇이 보였고 왜 그런가)까지만. [다음 단계]·다음 할 일·실행 제안 소제목은 넣지 마 — 그건 제언(5번) 몫이다.`),
      askAI(`이번 응답에는 "5. 향후 제언"만 작성해. "4. 인사이트"는 별도로 작성되니 진단을 길게 재서술하지 말고, 바로 실행 제언(① ② ③ …)만 써.`),
    ]);

    if (!ins.content || !rec.content) {
      const err = ins.err || rec.err || "AI 응답이 비어 있음(일시적 오류)";
      await logRun({ advertiser, level, landing, drive, insight: "", rec: "", error: "생성 실패: " + err });
      res.status(502).json({ error: "생성에 실패했습니다. 잠시 후 다시 한 번 눌러 주세요." });
      return;
    }

    // 섹션 헤더 보장 후 결합.
    const ensureHead = (body, header) => (body.startsWith(header) ? body : header + "\n" + body);
    let text = ensureHead(ins.content, "4. 인사이트") + "\n\n" + ensureHead(rec.content, "5. 향후 제언");
    // 숫자 범위 물결표(~ 전각～ 물결대시〜)→엔대시, 일본어 종결 'です'→'다' 강제 치환.
    text = text
      .replace(/([0-9])\s*[~～〜]\s*([0-9])/g, "$1–$2")
      .replace(/です/g, "다");
    const parts = splitSections(text);
    await logRun({ advertiser, level, landing, drive, insight: parts.p4, rec: parts.p5, error: "" });
    res.status(200).json({ text });
  } catch (e) {
    await logRun({ advertiser: "", level, landing, drive, insight: "", rec: "", error: "요청 처리 오류: " + String(e).slice(0, 300) });
    res.status(500).json({ error: "요청 처리 중 오류", detail: String(e).slice(0, 300) });
  }
}
