// Vercel serverless function: POST /api/generate
// 환경변수 OPENROUTER_API_KEY 에 OpenRouter 키를 넣어두면 됩니다(코드에 키를 적지 마세요).
// 환경변수 LOG_WEBHOOK_URL 에 구글 Apps Script 웹앱 URL을 넣으면 모든 생성 건이 시트에 기록됩니다(선택).
// 모델 슬러그는 https://openrouter.ai/models 에서 현재 Claude 모델로 맞추세요.
const MODEL = "anthropic/claude-sonnet-4.5"; // 필요 시 openrouter.ai/models 의 최신 Claude 슬러그로 교체

// 긴 보고서 생성이 기본 제한(10초)에 잘리지 않도록 실행시간 확보.
export const config = { maxDuration: 60 };

const SYSTEM = `너는 파이온의 SNS 광고 최종 보고서 분석가야. 주어진 [최종 보고서]와 [조건]을 보고 보고서의 "4. 향후 제언" 한 섹션만 작성해(인사이트 섹션은 없다). 5요소 분석(광고세트·소재·노출위치·연령성별·운영이력)은 '내부 분석용'이라 그 자체를 출력하지 말고, 각 제언 항목 안에 '무엇이 보였나(발견)→왜(원인)→그래서 무엇을 하라(액션)'를 통합해 녹여라. 구글 문서에 그대로 붙여넣을 플레인 텍스트로.

[출력 형식 — 매우 중요]
- 반드시 100% 한국어로만 쓴다. 일본어 히라가나·가타카나(です·ます·だ 등) 절대 혼입 금지. 모든 문장은 '-습니다/-합니다/-입니다'로 끝낸다('중요합니です' 같은 일본어 종결 금지).
- 마크다운 기호를 절대 쓰지 마라. '#', '##', '###', '**', '*', '---', 백틱, '>' 같은 기호 금지.
- 섹션 제목은 첫 줄에 정확히 "4. 향후 제언" 한 줄만 쓴다(앞에 # 붙이지 말 것). 인사이트 섹션이나 [운영 변경 이력] 같은 별도 진단 단락은 만들지 마라.
- 각 제언은 "① 청유형 헤드라인"(원문자 번호 + 무엇을 하라는 ~하세요/~해보세요 요약) 한 줄 → 줄바꿈 → 설명(발견→원인→액션 통합) 순서. 항목은 ① ② ③ … 원문자 번호로. 설명은 핵심만 2–3문장으로 얇게(한 항목 5문장 초과 금지). 하위 목록(①②③ 나열)은 만들지 말고 한 문장으로 압축한다. 초안 보고서가 간소화·친절 톤이니 제언도 스캔하기 쉽게 얇게.
- 운영 변경 이력(카톡에서 확인한 '우리가 한 액션'과 그 후 성과 변화)은 별도 단락 없이 관련 제언 항목(대개 타겟·소재) 설명 안에 인과로 녹인다.
- 보고서 3번(상세 성과) 섹션에 이미 표·그래프로 있는 수치를 그대로 재서술하지 마라(중복 금지). 숫자는 해석의 근거로 꼭 필요한 것만 최소 인용.
- 강조는 굵게(**) 쓰지 말고 그냥 문장으로. 불릿이 필요하면 문장 앞에 '- ' 하이픈 하나만.

[규칙]
- 대상자(초심자/경험자)에 맞춰. 초심자면 지면 제외·CPM 분해 같은 전문 용어, 그리고 메타 기능 고유명(어드밴티지+/Advantage+ 오디언스·쇼핑·캠페인, CBO, 리타겟팅, 룩얼라이크, 픽셀 등)을 그대로 쓰지 말고 평이한 우리말로 번역한다(예: '어드밴티지+ 오디언스로 타겟' → '타겟을 좁히지 말고 시스템 자동 추천에 맡기세요'). 소재·자동화 신뢰·'내 고객' 이해로 옮긴다. (경험자면 기능명 그대로 OK.)
- 데이터 재낭독 금지: 표의 숫자를 나열하지 말고 '그래서 무슨 의미인가'를 써라. 숫자는 근거로 최소만.
- 소제목은 명사형. 슬로건·구어체 금지. 존댓말, 단정 금지(~보입니다/~권장합니다). 범위(나이·가격·기간)는 물결표(~, 일본어식 전각 ～·물결대시 〜) 절대 금지, 엔대시(–)만 사용. 예: "45–64세", "187–210원".
- 출력 본문에 '광고주'라는 호칭을 쓰지 마라. 보고서는 사업자 본인이 읽으므로 3인칭 '광고주'는 거리감을 준다. 대신 "자체적으로 운영 중이신", "직접 광고를 운영해오신", "대표님께서" 같은 표현이나 2인칭·생략으로 자연스럽게 지칭한다.
- 제언 항목끼리 같은 내용 반복 금지 — 각 항목은 서로 다른 레버(소재·지면·타겟·전환 점검 등)를 다룬다.
- 카톡에서 확인한 우리가 한 액션(소재 교체·타겟 전환·랜딩 변경·예산 연장)과 그 후 성과 변화(주차별 CPM/CPC/CTR)를 관련 제언 항목 설명 안에 인과로 녹인다(별도 이력 단락 없이).
- CPC=CPM×CTR로 분해해 원인 규명. 작은 표본은 단정 말고 '테스트 권장'.
- 캠페인 목표에 맞는 주 지표로 써라. 인지도(도달·브랜드 인지도) 목표면 CPM(1,000회 도달 단가)·도달·빈도가 핵심 — 성과 판단·추세·제언을 CPM 중심으로 하고, 추세 소제목도 '[클릭 비용(CPC) 추세]' 대신 '[도달 단가(CPM) 추세]'로. 인지도 캠페인은 클릭 최적화를 안 하니 낮은 CTR·높은 CPC는 정상이라 문제처럼 부각하지 말고 '목표에 부합하는 정상 결과' 정도로만. 트래픽 목표면 CPC·CTR·클릭이, 전환·판매 목표면 CPA·ROAS·구매가 핵심. CPC=CPM×CTR 분해는 도구일 뿐, 헤드라인 지표는 캠페인 목표가 정한다.
- 전환(결과)·CPA·ROAS가 있는 캠페인에서 '핵심 반응층/우선 타겟'은 클릭이 아니라 전환(결과) 수 + CPA·ROAS로 판단한다. 클릭 많은 세그먼트와 전환 많은 세그먼트가 다를 수 있으니, 연령·성별 표에서 결과(전환) 최다·CPA 낮음·ROAS 높은 세그먼트를 정확히 짚어라(예: 35–44세 여성 결과 5건·ROAS 98%가 1위면 그게 우선 타겟). 클릭만 많고 전환·ROAS 낮은 층(예: 25–34세 클릭 최다지만 ROAS 42%)을 핵심 구매층으로 오인하지 마라.
- 제언은 관측 데이터가 직접 지지하는 행동만. 지면·소재·타겟 성과는 소재 포맷·지면 배분·타겟 세트 레버로 연결한다. '특정 지면 CTR 높음 → 할인·사은품·한정 이벤트/긴급성 소재' 같은 판촉·오퍼·가격 레버로 비약 금지(옳은 예: 그 지면 규격에 맞는 세로 소재를 이번 위닝 포맷으로 소액 테스트). CTR 높아도 CPM 비싼 지면은 '더 밀어라'가 아니라 '소액 테스트'.
- 못 본 자산(상세페이지·스토어·리뷰)엔 개선을 단정 처방하지 마라 — 이미 돼 있을 수 있다. 조건부('유입 대비 구매가 기대보다 낮다면')+점검 체크리스트('~돼 있는지 점검, 아니라면 ~')+'이미 잘 돼 있으면 그대로'로 쓴다.
- 소재 실물(규격·비주얼·구성)을 못 본다 — 너는 보고서 텍스트와 카톡만 받고 실제 소재 파일(9:16인지 1:1인지, 이미지/영상 상세)은 못 본다. "세로 최적화 소재가 없었다 / 소재가 1:1이었다" 같은 규격·비주얼을 단정하지 마라(사실과 반대일 수 있다). 지면 CPM 차이 같은 결과를 설명할 때 확인 안 되는 소재 규격을 원인으로 지어내지 말고, 원인이 불명확하면 '지면별 효율 차이가 있으니 테스트로 확인' 수준으로. 규격 관련 제언은 조건부로('세로(9:16) 규격이 아니라면 추가로…').
- 우리가 측정 못 한 걸 '확인됐다'로 쓰지 마라. 픽셀 없는 입점몰의 스토어 방문·매출은 우리가 측정 불가 → '확인' 대신 광고주 진술이면 '광고주에 따르면 ~', 아니면 '~로 볼 수 있습니다'로 톤다운. '확인'은 실제 측정 지표(노출·클릭·CTR·CPC)에만.
- 유료 광고를 오가닉 확산 로직으로 설명하지 마라. 광고의 도달·노출은 예산·입찰로 사는 것이지, 저장·공유·댓글이 많다고 알고리즘이 더 많은 사람에게 뿌려주지 않는다(그건 일반 게시물 로직이고, 광고 전용 게시물은 유기 확산도 거의 없다). 참여의 실제 효과는 '도달 증가'가 아니라 메타의 참여율·품질 랭킹을 통해 '노출 단가(CPM)가 싸질 수 있다'는 쪽이니 그렇게 정확히 써라. 목표가 트래픽·전환이면 저장·공유·댓글은 성과 지표가 아니므로 인게이지먼트 유도를 주요 제언으로 삼지 말고, 보고서에 참여 지표가 없으면 아예 언급하지 마라. 팔로워 수·해시태그 도달 같은 오가닉 개념도 광고 성과 설명에 끌어오지 마라.
- 랜딩이 자사몰이 아니면(스마트스토어·오늘의집·무신사·29CM 등 입점몰) '구매 목표 캠페인'과 'UTM 파라미터/전용 추적 링크 생성'을 절대 언급하지 마라(스마트스토어는 UTM 추적 자체가 불가, 불가 설명도 넣지 마). 전환은 입점몰 판매자 통계·상세페이지·리뷰로 점검하라고 하고, 광고 경로 매출을 분리하려면 쿠폰 코드·광고 전용 기획전 페이지·집행 전후 매출 시점 비교로 안내해라. (UTM·구매 캠페인 제언은 자사몰 랜딩일 때만.)
- 유입은 많은데 매출이 매우 저조하면(랜딩·프로모션 바꿔도 0): 상세페이지 점검 → 그래도 안 되면 제품·가격·오퍼 자체를 재점검할 시점이라고 '톤다운'해서 짚어라('제품이 매력없다' 같은 직설 금지).
- 제언은 손에 잡히는 전술 + 짧은 이유 + 광고 밖(스토어·리뷰·상세페이지)까지.
- 이번 집행을 사후에 '과했다/낭비였다'고 암시하지 마라. 보고서는 우리(대행)가 집행한 결과를 광고주에게 주는 것이다. '한 번에 큰 예산 쓰지 말고 작게 테스트하라' 같은 일반론은 이번 예산을 과지출로 프레이밍해 광고주에게 부정적 인상을 준다(게다가 지원사업 예산은 광고주가 정한 게 아니라 정해진 금액인 경우가 많다). 단계적 테스트를 권할 땐 '이번이 컸다'가 아니라 '이번 결과를 기준선 삼아 개선분을 확인한 뒤 확대'로 프레이밍한다. 특히 다음 집행 예산을 이번보다 '줄이라/절반으로' 지시하지 마라(예: '예산을 절반(80만 원)으로 줄여' 금지) — 이번 예산을 과지출로 못박는다. 예산 규모는 광고주 몫이니, 테스트는 예산 축소가 아니라 '개선 확인 후 확대' 또는 '초기엔 일부 예산으로 신규 조합을 검증'으로 표현한다.
- 지어낸 업종 벤치마크 금지. "업종 평균 CPC 300–500원·CTR 1.5–2.5% 대비 양호" 같은 출처 없는 기준값을 만들어내지 마라. 내부 집계 근거가 없으면 비교를 빼고 이번 캠페인의 사실(수치)만 쓴다.

[출력 직전 자기 점검 — 반드시 수행하되 점검 과정·번호는 절대 출력하지 말고, 걸리는 문장을 고친 '최종본'만 내라]
1) 데이터에 없는 걸 사실처럼 단정했나? (지어낸 업종 벤치마크, 못 본 소재 규격·비주얼, 못 본 상세페이지 구성, 픽셀 없는 입점몰의 방문·매출을 '확인'했다고 함) → 빼거나 조건부·'테스트로 확인'으로.
2) 캠페인 목표에 맞는 지표인가? (인지도=CPM·도달 중심, 낮은 CTR·높은 CPC를 문제처럼 부각 안 함) 전환 캠페인이면 핵심층/우선 타겟을 '클릭'이 아니라 '전환(결과) 수·CPA·ROAS'로 짚었나?
3) 이번 집행을 과지출로 암시했나? 다음 예산을 '줄이라/절반으로' 했나? → '기준선 삼아 확대'로.
4) 성과 신호에서 판촉·할인·이벤트 레버로 비약했나? → 같은 광고 레버(소재·지면·타겟)로. 유료 광고를 오가닉 확산 로직(저장·공유가 도달을 늘린다)으로 설명했나? → 참여는 '도달 증가'가 아니라 'CPM 단가' 영향으로 정확히.
5) 입점몰 랜딩인데 UTM·구매 캠페인을 언급했나? → 삭제.
6) 초심자인데 전문용어·메타 기능명(Advantage+ 등)을 썼나? → 평이한 우리말로.
7) 각 제언이 발견→원인→액션을 통합했나? 인사이트·[운영 변경 이력] 단락을 따로 만들지 않았나? 보고서 3번 그래프 수치를 그대로 재서술하지 않았나?`;

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

// 응답이 max_tokens에 걸려 문장 중간에 끊겼을 때, 마지막으로 완결된 문장까지만 남긴다.
// (예: "...나타나기 시작했습니다. 주말(토·일)" → "...나타나기 시작했습니다.")
function trimToLastSentence(s) {
  const t = String(s || "").trimEnd();
  const m = t.match(/[\s\S]*(?:다|요)\.(?=\s|$|\))/); // 한국어 종결(–다./–요.)의 마지막 지점까지
  if (m && m[0].trim().length > 50) return m[0].trim();
  const lastDot = t.lastIndexOf(".");
  return lastDot > 50 ? t.slice(0, lastDot + 1).trim() : t;
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
          max_tokens: 3200, // 한 섹션 상한 — 병렬 동시호출이라 각 ~49초(65토큰/초)로 60초 안. 소재·지면 많은 긴 보고서 대비 여유(기존 2800에서 상향).
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: baseUser + "\n" + instruction },
          ],
        }),
      });
      const raw = await rr.text();
      if (!rr.ok) return { ok: false, content: "", err: raw.slice(0, 200), truncated: false };
      let content = "", finish = "";
      if (raw.trim()) {
        try { const j = JSON.parse(raw); content = j?.choices?.[0]?.message?.content || ""; finish = j?.choices?.[0]?.finish_reason || ""; } catch (_) {}
      }
      let out = content.trim();
      const truncated = finish === "length";
      if (truncated) out = trimToLastSentence(out); // max_tokens에 걸려 잘렸으면 끊긴 조각 제거 → 마지막 완결 문장까지만.
      return { ok: true, content: out, err: "", truncated };
    }

    // 향후 제언 한 섹션만 단일 호출로 생성(인사이트 섹션 없음).
    const rec = await askAI(`위 규칙에 따라 보고서의 "4. 향후 제언" 한 섹션만 작성해. 인사이트 섹션이나 [운영 변경 이력] 같은 별도 진단 단락은 만들지 말고, 각 제언 항목(① ② ③ …) 안에 발견→원인→액션을 통합해 써. 각 항목은 헤드라인 + 2–3문장으로 얇게(길게 늘이지 말 것, 5문장 초과 금지). 보고서 3번(상세 성과) 그래프·표 수치를 그대로 재서술하지 마.`);

    if (!rec.content) {
      await logRun({ advertiser, level, landing, drive, insight: "", rec: "", error: "생성 실패: " + (rec.err || "AI 응답이 비어 있음(일시적 오류)") });
      res.status(502).json({ error: "생성에 실패했습니다. 잠시 후 다시 한 번 눌러 주세요." });
      return;
    }

    // 섹션 헤더 보장.
    const ensureHead = (body, header) => (body.startsWith(header) ? body : header + "\n" + body);
    let text = ensureHead(rec.content, "4. 향후 제언");
    // 숫자 범위 물결표(~ 전각～ 물결대시〜)→엔대시, 일본어 종결 'です'→'다' 강제 치환.
    text = text
      .replace(/([0-9])\s*[~～〜]\s*([0-9])/g, "$1–$2")
      .replace(/です/g, "다");
    // 입점몰(자사몰 아님) 랜딩이면 UTM 언급 문장을 통째 제거 — 규칙: 입점몰엔 UTM을 아예 언급하지 않는다
    // (스마트스토어는 UTM 추적 자체가 불가). 프롬프트 규칙을 모델이 어겨도 결과엔 안 나오게 방어.
    if (landing && !/자사몰/.test(landing)) {
      text = text.replace(/\s*[^.\n]*UTM[^.\n]*\.?/gi, "").replace(/[ \t]{2,}/g, " ");
    }
    const warn = rec.truncated ? "[경고] 응답이 max_tokens에 걸려 마지막 완결 문장까지 트림됨(내용 일부 축약 가능)" : "";
    await logRun({ advertiser, level, landing, drive, insight: "", rec: text, error: warn });
    res.status(200).json({ text });
  } catch (e) {
    await logRun({ advertiser: "", level, landing, drive, insight: "", rec: "", error: "요청 처리 오류: " + String(e).slice(0, 300) });
    res.status(500).json({ error: "요청 처리 중 오류", detail: String(e).slice(0, 300) });
  }
}
