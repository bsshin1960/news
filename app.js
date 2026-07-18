// ====================================================
// 1. 상태 및 상수 정의
// ====================================================
let currentFetchSession = 0;
let lastRenderedCategory = '';
let backgroundFetchPending = 0;
let readerApiRequestCount = 0;
const FAST_NEWS_MODEL_CANDIDATES = [
  { name: 'gemini-2.0-flash', version: 'v1beta' },
  { name: 'gemini-1.5-flash', version: 'v1beta' }
];
const FIRST_NEWS_MODEL_CANDIDATES = [
  { name: 'gemini-2.0-flash', version: 'v1beta' },
  { name: 'gemini-1.5-flash', version: 'v1beta' }
];
const MAX_BACKGROUND_NEWS_REQUESTS = 4;
const MAX_NEWS_FILL_ATTEMPTS = 4;
const GEMINI_MIN_REQUEST_INTERVAL_MS = 3500;
const GEMINI_QUOTA_RETRY_PADDING_MS = 1500;
const NEWS_RECENCY_HOURS = 12;
const RSS_MIN_BODY_CHARS = 300;
const RSS_MAX_ITEMS_TO_SCAN = 24;
const RSS_ARTICLE_TEXT_ATTEMPT_LIMIT = 8;
const READER_API_REQUEST_LIMIT = 32;
const NEWS_SEEN_STORAGE_KEY = 'news_seen_items_v1';
const NEWS_SEEN_LIMIT = 200;
const NEWS_SEEN_TTL_MS = NEWS_RECENCY_HOURS * 60 * 60 * 1000;
const DEFAULT_NEWS_DETAIL_CHARS = 350;
const MIN_NEWS_DETAIL_CHARS = 150;
const MAX_NEWS_DETAIL_CHARS = 500;
let nextGeminiRequestAt = 0;
let geminiRequestQueue = Promise.resolve();

// 모바일 브라우저 전력 관리 및 백그라운드 세션 유지용 변수
let wakeLock = null;
let audioCtx = null;
let silentAudioInterval = null;

// 네이버 뉴스 RSS 피드 실시간 수집 설정 (API 키 없이도 최신 뉴스 제공)
const NAVER_NEWS_RSS_FETCH_TIMEOUT_MS = 15000;
const NAVER_NEWS_CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest='
];

const NEWS_SOURCE_DOMAINS = {
  ytn: 'ytn.co.kr',
  yna: 'yna.co.kr',
  munhwa: 'munhwa.com',
  kmib: 'kmib.co.kr',
  chosun: 'chosun.com',
  joongang: 'joongang.co.kr',
  donga: 'donga.com',
  mk: 'mk.co.kr',
  hankyung: 'hankyung.com',
  khan: 'khan.co.kr',
  hani: 'hani.co.kr',
  seoul: 'seoul.co.kr',
  segye: 'segye.com',
  hankookilbo: 'hankookilbo.com',
  sedaily: 'sedaily.com',
  mt: 'mt.co.kr',
  kbs: 'kbs.co.kr',
  mbc: 'imbc.com',
  sbs: 'sbs.co.kr',
  obc: 'obsnews.co.kr',
  naver: 'naver.com',
  daum: 'daum.net',
  google: 'google.com',
  x: 'x.com'
};

function isDomainSelected(urlText) {
  if (!urlText || typeof urlText !== 'string') return false;
  if (!Array.isArray(state.sources) || state.sources.length === 0) {
    return true; // 아무것도 선택하지 않은 경우 전체 허용
  }
  try {
    const url = new URL(urlText);
    const hostname = url.hostname.toLowerCase();
    return state.sources.some(src => {
      const domain = NEWS_SOURCE_DOMAINS[src];
      return domain && (hostname === domain || hostname.endsWith('.' + domain));
    });
  } catch (_) {
    // news.google.com articles 같은 상대경로나 특수링크의 경우 우선 통과 후 최종 도메인 검증
    if (urlText.startsWith('http://') || urlText.startsWith('https://')) {
      return false;
    }
    return true;
  }
}

function getQuerySourceFilter() {
  if (!Array.isArray(state.sources) || state.sources.length === 0) {
    return '';
  }
  // 체크된 출처 중 최대 3개를 무작위로 샘플링하여 쿼리 빌드 (연합뉴스 등 특정 매체 편중 방지)
  const availableSources = [...state.sources];
  const sampleSize = Math.min(3, availableSources.length);
  const sampledSources = [];
  
  for (let i = 0; i < sampleSize; i++) {
    const randIdx = Math.floor(Math.random() * availableSources.length);
    sampledSources.push(availableSources.splice(randIdx, 1)[0]);
  }

  const domains = sampledSources.map(src => NEWS_SOURCE_DOMAINS[src]).filter(Boolean);
  if (domains.length === 0) return '';
  return ' (' + domains.map(d => `site:${d}`).join(' OR ') + ')';
}

let state = {
  categories: ['정치', '경제', '증시', '과학', '날씨', '사회', '스포츠', '문화', 'AI뉴스', '건강', '연예', '산업'],
  sources: ['ytn', 'yna', 'munhwa', 'kmib', 'chosun', 'joongang', 'donga', 'mk', 'hankyung', 'khan', 'hani', 'seoul', 'segye', 'hankookilbo', 'sedaily', 'mt', 'kbs', 'mbc', 'sbs', 'obc', 'naver', 'daum', 'google', 'x'],
  prompt: '',
  apiKey: '',
  openaiApiKey: '',
  groqApiKey: '',
  newsSourceMode: 'auto',
  voiceName: '',
  speed: 1.0,
  newsDetailChars: DEFAULT_NEWS_DETAIL_CHARS,
  newsList: [],
  currentNewsIndex: -1,
  isPlaying: false,
  isPaused: false,
  hasSpokenIntro: false,
  hasFirstNewsBeenRequested: false,
  briefingMode: 'headlines_then_body',
  briefingPhase: 'headlines',
  lastGeminiError: '',
  lastOpenaiError: '',
  lastRssError: ''
};

// 모의 뉴스 데이터 템플릿 (API 키 미제공 시 관심사에 따라 필터링되어 노출됨)
const MOCK_NEWS_TEMPLATES = [
  {
    id: 1,
    category: '정치',
    title: '정부, 저출생 주거·양육 특별대책 발표',
    body: '정부가 국가적 초비상 사태인 저출생 위기를 극복하기 위해 신혼부부 및 다자녀 가구를 대상으로 주택 청약 신청 기준을 대폭 완화하고 영유아 수당의 지급 기간과 액수를 획기적으로 확대하는 범정부 차원의 특별 종합 대책을 공식 발표했습니다. 이번 대책은 내 집 마련 기회 확대와 직접적인 현금성 지원을 결합하여 자녀 양육 가정의 실질적인 주거비 및 교육비 부담을 획기적으로 낮추는 것을 최우선 목표로 삼고 있으며, 향후 인구 구조 정상화에 긍정적인 신호탄이 될 것으로 관계자들은 크게 기대하고 있습니다.',
    time: '오전 07:15',
    source_name: '연합뉴스',
    source_url: 'https://www.yna.co.kr/view/AKR20260713000100001?section=politics/all'
  },
  {
    id: 2,
    category: '경제',
    title: '유가 급락에 정유업계 비상경영 돌입',
    body: '글로벌 제조업 경기 침체와 수요 둔화 우려가 확산되면서 국제 원유 가격이 배럴당 70달러선 아래로 급락하자 국내 주요 정유 및 석유화학 대기업들이 비상 경영 체제에 긴급 돌입하며 사장단 특별 회의를 소집했습니다. 최근 급변하는 고환율 및 원자재 공급망 불안 리스크와 맞물려 하반기 수익성 지표인 정제마진 확보에 심각한 빨간불이 켜진 상황이며, 각 기업들은 설비 가동률 조정과 불요불급한 지출 억제 등 초긴축 재정 운영 계획을 긴급 검토하여 자구책 마련에 총력을 기울이고 있습니다.',
    time: '오전 07:30',
    source_name: '매일경제',
    source_url: 'https://www.mk.co.kr/news/economy/view/2026/07/130123'
  },
  {
    id: 3,
    category: '증시',
    title: '코스피 7,000선 돌파…사상 최고치 경신',
    body: '글로벌 초전도체 기술 혁신과 지능형 AI 반도체 및 첨단 휴머노이드 로봇 분야의 대규모 수주 랠리가 연이어 보도되는 가운데, 코스피 지수가 외국인과 기관 투자가들의 강력한 동반 매수세에 힘입어 역사상 처음으로 마의 7,000선을 가뿐히 돌파하며 사상 최고 신기록을 경신했습니다. 미국 연방준비제도의 금리 기조 완화 기대감과 국내 대형 기술 기업들의 호실적 달성이 기폭제가 되었으며, 증권가에서는 상승 여력이 충분하다는 낙관론과 단기 급등에 따른 밸류에이션 부담에 유의해야 한다는 목소리가 나옵니다.',
    time: '오전 08:00',
    source_name: '한국경제',
    source_url: 'https://www.hankyung.com/finance/article/202607139999a'
  },
  {
    id: 4,
    category: '과학',
    title: '국내 연구진 초전도체 후보물질 발견',
    body: '국내 저명 대학 연구소와 정부 산하 국책 연구기관 공동 연구팀이 상온 극저온 경계 영역에서 기존 물질보다 한층 강력한 반자성 효과와 무저항 전도성을 보이는 혁신적인 초전도체 후보 물질 합성 기술을 세계 최초로 개발했습니다. 권위 있는 글로벌 과학 저널인 네이처의 최종 게재를 앞두고 있으며, 향후 무손실 에너지 초고속 송전망 및 미래형 자기부상열차, 고성능 양자컴퓨터 등의 상용화를 앞당겨 산업 생태계 전반을 통째로 바꿀 혁명적 성과로 평가받고 있습니다.',
    time: '오전 08:10',
    source_name: '동아사이언스',
    source_url: 'https://www.dongascience.com/news.php?key=202607138888'
  },
  {
    id: 5,
    category: '날씨',
    title: '오늘 밤 전국 폭설·강풍 주의보 발령',
    body: '기상청은 오늘 자정부터 중부 지방 및 수도권 영역을 중심으로 순간 풍속 시속 70킬로미터 이상의 강한 돌풍과 함께 최대 15센티미터 이상의 폭설이 내릴 것으로 예측하여 대설 특보를 긴급 발령했습니다. 내일 출근길에는 영하 10도 이하의 한파와 겹쳐 빙판길 교통 대란이 크게 우려되는 만큼 대중교통 이용을 생활화하고 시설물 붕괴 예방 및 노약자 낙상 사고 방지 등 사전 대비를 빈틈없이 해달라고 거듭 당부했습니다.',
    time: '오전 08:15',
    source_name: '기상청 날씨누리',
    source_url: 'https://www.weather.go.kr/w/wnuri-new/html/cop/bbs/selectBoardArticle.do?bbsId=BBS_NEWS'
  },
  {
    id: 6,
    category: '사회',
    title: '경찰, 보이스피싱 AI 실시간 탐지 도입',
    body: '경찰청은 금융감독원 및 시중 은행들과 협력하여 통화 중 오가는 보이스피싱 의심 단어 패턴과 발화자의 미세한 목소리 톤 변화를 실시간으로 자동 분석하여 금융 범죄 의심 징후를 감지해 이체를 자동 차단하는 차세대 범죄 방지 시스템을 정식 가동했습니다. 이 첨단 AI 시스템은 전국 주요 은행 지점에 우선 시범 적용되며, 나날이 지능화되는 보이스피싱 사기 조직들의 수법으로부터 서민들의 소중한 재산 피해를 획기적으로 예방할 수 있을 것으로 내다보고 있습니다.',
    time: '오전 08:20',
    source_name: 'YTN',
    source_url: 'https://www.ytn.co.kr/_ln/0103_202607131122334455'
  },
  {
    id: 7,
    category: '스포츠',
    title: '한국 골프 대표팀 세계 주니어 선수권 우승',
    body: '대한민국 주니어 골프 국가대표팀이 미국 플로리다에서 개최된 세계 주니어 골프 선수권 대회 마지막 라운드에서 침착하고 정교한 아이언 샷과 버디 퍼팅 랠리를 선보이며 강력한 우승 후보국인 미국과 일본을 최종 합계 2타 차로 극적으로 따돌리고 사상 최초로 종합 단체전 우승 트로피를 차지했습니다. 차세대 골프 스타들의 투지와 침착함이 만들어낸 값진 쾌거로, 향후 세계 무대에서 활약할 한국 태극전사들의 미래를 한층 밝히는 역사적 계기가 되었습니다.',
    time: '오전 08:30',
    source_name: 'SBS 스포츠',
    source_url: 'https://sports.sbs.co.kr/news?id=SP1000020260713'
  },
  {
    id: 8,
    category: '문화',
    title: '국립미술관 VR 고궁유물 기획전 개최',
    body: '문화재청과 국립현대미술관은 최첨단 고해상도 3D 스캐닝 기술과 가상현실 VR 인터랙티브 엔진을 융합하여 조선 시대 왕실 생활 유물과 실제 고궁 내부를 집에서도 손쉽게 360도로 관람할 수 있는 메타버스 기획 전시를 공식 오픈했습니다. 이번 하이브리드 전시는 오프라인 미술관 공간뿐 아니라 모바일 앱과 VR 기기를 활용해 전 세계 어디서나 무료로 입체 체험할 수 있도록 접근성을 극대화하여 대중의 뜨거운 관심을 모으고 있습니다.',
    time: '오전 08:40',
    source_name: '문화일보',
    source_url: 'https://www.munhwa.com/news/view.html?no=20260713010399'
  },
  {
    id: 9,
    category: 'AI뉴스',
    title: '국내 AI 연구소 감성대화 로봇 상용화',
    body: '국내 유수의 인공지능 연구소와 로봇 전문 벤처기업 공동 연구진이 멀티모달 센서 인식 알고리즘을 혁신적으로 고도화하여 사용자의 미세한 얼굴 표정 떨림과 음성 억양 파장을 실시간으로 자동 해독하고 감성적인 공감 대화를 완벽히 나눌 수 있는 지능형 반려 로봇 상용화 모델을 시장에 전격 발표했습니다. 이 로봇은 1인 가구 및 고령층 독거노인 가정의 고독감 해소와 우울증 예방 등 돌봄 서비스 분야에 신속하게 상용 배치될 계획입니다.',
    time: '오전 08:50',
    source_name: '지디넷코리아',
    source_url: 'https://zdnet.co.kr/view/?no=20260713777777'
  },
  {
    id: 10,
    category: '건강',
    title: '환절기 호흡기 감염병 예방 주의보 발령',
    body: '질병관리청은 최근 낮과 밤의 기온차가 10도 이상 벌어지는 환절기 기후 영향으로 면역력이 떨어지기 쉬운 취약 계층을 중심으로 독감 및 백일해 등 주요 호흡기 감염병 환자가 최근 급증함에 따라 대국민 예방 건강 주의보를 발령했습니다. 외출 후 흐르는 물에 30초 이상 손 씻기와 사람이 밀집한 장소에서의 마스크 착용, 실내 주기적 환기 등 개인위생 수칙 준수가 필수적이며 호흡기 증상 발현 시 즉시 가까운 병원을 찾아 적절한 치료를 받을 것을 강력 권고했습니다.',
    time: '오전 09:00',
    source_name: '헬스조선',
    source_url: 'https://health.chosun.com/site/data/html_dir/2026/07/13/2026071300001.html'
  },
  {
    id: 11,
    category: '연예',
    title: '신인 아이돌 데뷔 동시에 글로벌 1위',
    body: '대형 기획사가 선보인 5인조 다국적 하이브리드 콘셉트 신인 보이그룹이 데뷔 타이틀곡 음원을 공식 발표함과 동시에 국내 주요 실시간 음원 차트 정상에 등극함은 물론, 미국 빌보드 메인 차트 및 글로벌 최대 음원 스트리밍 플랫폼 스포티파이의 국가별 주간 차트 1위를 단숨에 휩쓰는 무서운 돌풍을 일으키고 있습니다. 파격적인 비주얼 아트워크와 감각적인 안무 연출이 글로벌 젠지(Gen-Z) 세대의 트렌드를 정확히 저격한 덕분으로 평가됩니다.',
    time: '오전 09:10',
    source_name: '디스패치',
    source_url: 'https://www.dispatch.co.kr/202607139999'
  },
  {
    id: 12,
    category: '산업',
    title: '완성차 업계 전고체 전기차 공장 착공',
    body: '글로벌 완성차 대기업과 국내 대표 2차전지 배터리 협력사가 손을 잡고 1회 완충 시 주행 거리를 대폭 연장하고 화재 폭발 위험성을 획기적으로 없앤 꿈의 차세대 배터리, 즉 전고체 배터리를 적용한 하이엔드 전기차 전용 스마트 제조 메가 팩토리 공장을 국내 최초로 공식 착공했습니다. 이번 스마트 팩토리 착공은 고도화된 정밀 자동화 공정을 바탕으로 2027년 본격적인 전고체 전기차 대량 양산 및 글로벌 시장 선점을 목표로 두고 있습니다.',
    time: '오전 09:20',
    source_name: '마켓인사이트',
    source_url: 'https://marketinsight.hankyung.com/article/202607130012c'
  }
];

// TTS Speech Synthesis 객체
const synth = window.speechSynthesis;
let currentUtterance = null;
let voices = [];
let ttsUnlockedByGesture = false;

// ====================================================
// 2. 초기 로드 및 UI 이벤트 바인딩
// ====================================================
window.addEventListener('DOMContentLoaded', async () => {
  await restoreSharedSettingsForThisDevice();
  initStorage();
  if (!isMobileRuntime() && (state.apiKey || state.openaiApiKey || state.groqApiKey)) {
    void persistSharedNewsSettings();
  }
  initVoices();
  initTheme(); // 테마 초기화
  bindUIEvents();
  bindKeyboardShortcuts();
  registerServiceWorker();

  // 첫 진입 시 모바일에서 터치 시 자동 재생되도록 설정
  if (isMobileRuntime()) {
    state.shouldAutoplayOnGesture = true;
  }

  // 첫 진입 시 자동으로 뉴스 수집 시작
  fetchNews();

  // 날짜 출력
  updateDateDisplay();
});

// 로컬 저장소로부터 설정 초기 로드
function normalizeNewsDetailChars(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_NEWS_DETAIL_CHARS;
  return Math.max(MIN_NEWS_DETAIL_CHARS, Math.min(MAX_NEWS_DETAIL_CHARS, parsed));
}

function getNewsDetailTargetChars() {
  return normalizeNewsDetailChars(state.newsDetailChars);
}

function getNewsDetailMaxChars() {
  return Math.min(MAX_NEWS_DETAIL_CHARS, Math.ceil(getNewsDetailTargetChars() * 1.2));
}

function getNewsDetailMinChars() {
  return Math.max(MIN_NEWS_DETAIL_CHARS, getNewsDetailTargetChars());
}

function getNewsDetailSentenceRange() {
  const target = getNewsDetailTargetChars();
  const minSentences = Math.max(4, Math.round(target / 65));
  const maxSentences = Math.max(minSentences + 2, Math.round(target / 52));
  return `${minSentences}~${maxSentences}`;
}

function getNewsDetailCharRangeText() {
  return `약 ${getNewsDetailMinChars()}~${getNewsDetailMaxChars()}자 분량`;
}
function trimNewsBodyToMaxChars(body) {
  const text = String(body || '').trim();
  const maxChars = getNewsDetailMaxChars();
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 3).trimEnd() + '...';
}

function ensureNewsBodyLength(body, meta = {}) {
  let base = String(body || '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\r?\n */g, '\n')
    .trim();
  const title = String(meta.title || '').trim();

  if (!base && title) {
    base = `${title}.`;
  }

  // RSS나 외부 텍스트 추출물 등의 대용량 본문을 설정값(500자 내외)에 맞게 문장 단위로 절삭
  const maxChars = getNewsDetailMaxChars();
  if (base.length > maxChars) {
    const sub = base.substring(0, maxChars);
    const lastSentenceIdx = Math.max(
      sub.lastIndexOf('. '),
      sub.lastIndexOf('? '),
      sub.lastIndexOf('! '),
      sub.lastIndexOf('다. ')
    );
    if (lastSentenceIdx > maxChars - 150) {
      const offset = (sub.charAt(lastSentenceIdx) === '다') ? 2 : 1;
      base = base.substring(0, lastSentenceIdx + offset).trim();
    } else {
      base = base.substring(0, maxChars - 3).trim() + '...';
    }
  }

  return base;
}
function isUsefulExtractedArticleTitle(extractedTitle, rssTitle, sourceName) {
  const extracted = String(extractedTitle || '').replace(/\s+/g, ' ').trim();
  const rss = String(rssTitle || '').replace(/\s+/g, ' ').trim();
  const source = String(sourceName || '').replace(/\s+/g, ' ').trim();
  if (!extracted) return false;
  if (source && normalizeNewsCompareText(extracted) === normalizeNewsCompareText(source)) return false;

  const genericTitles = [
    '\uB274\uC2A4',
    '\uCD5C\uC2E0\uB274\uC2A4',
    '\uC815\uCE58 \uC774\uBAA8\uC800\uBAA8',
    '\uACBD\uC81C \uC774\uBAA8\uC800\uBAA8',
    '\uC0AC\uD68C \uC774\uBAA8\uC800\uBAA8',
    '\uD3EC\uD1A0\uC2AC\uB77C\uC774\uB4DC',
    '\uC624\uB298\uC758 \uB274\uC2A4'
  ];
  const genericFragments = [
    '\uD3EC\uD1A0\uC2AC\uB77C\uC774\uB4DC',
    '\uCD5C\uC2E0\uD3EC\uD1A0',
    '\uB7AD\uD0B9\uBCC4 \uB274\uC2A4',
    '\uB124\uC774\uD2B8 \uB274\uC2A4'
  ];

  if (genericTitles.some(text => normalizeNewsCompareText(text) === normalizeNewsCompareText(extracted))) return false;
  if (genericFragments.some(text => extracted.includes(text))) return false;
  if (rss && extracted.length < Math.min(12, Math.floor(rss.length * 0.45))) return false;
  return true;
}

function isUsefulExtractedArticleBody(extractedBody, rssBody) {
  const extracted = String(extractedBody || '').replace(/\s+/g, ' ').trim();
  const rss = String(rssBody || '').replace(/\s+/g, ' ').trim();
  if (!extracted) return false;
  if (normalizeNewsCompareText(extracted) === normalizeNewsCompareText(rss)) return false;

  const genericFragments = [
    '\uCD5C\uC2E0\uD3EC\uD1A0',
    '\uB7AD\uD0B9\uBCC4 \uB274\uC2A4 \uC81C\uACF5',
    '\uD3EC\uD1A0\uC2AC\uB77C\uC774\uB4DC \uB4F1\uC758 \uCD5C\uC2E0 \uB274\uC2A4'
  ];
  if (genericFragments.some(text => extracted.includes(text))) return false;
  return extracted.length > rss.length;
}

function isNarrationUnfriendlyArticle(body, title = '') {
  const raw = String(body || '');
  const text = raw.replace(/\s+/g, ' ').trim();
  const heading = String(title || '').trim();
  if (!text) return true;

  const tableSeparators = (raw.match(/\|/g) || []).length;
  const temperatureRanges = (text.match(/-?\d{1,2}\s*[~～–-]\s*-?\d{1,2}\s*(?:도|℃)?/g) || []).length;
  const numericTokens = (text.match(/\b\d+(?:[.,]\d+)?(?:%|도|℃)?\b/g) || []).length;
  const sentenceCount = (text.match(/[.!?](?:\s|$)/g) || []).length;
  const weatherListTitle = /(세계의\s*날씨|주요\s*도시.*날씨|도시별.*날씨)/.test(heading);

  if (tableSeparators >= 6 || /(?:^|\n)\s*[-:]+\s*\|/.test(raw)) return true;
  if (temperatureRanges >= 6) return true;
  if (weatherListTitle && temperatureRanges >= 3) return true;
  if (numericTokens >= 15 && sentenceCount <= 3) return true;
  return false;
}
function isGoogleNewsUrl(value = '') {
  try {
    const url = new URL(value);
    return url.hostname === 'news.google.com' && url.pathname.includes('/articles/');
  } catch (_) {
    return false;
  }
}

function getGoogleNewsArticleId(value = '') {
  try {
    const url = new URL(value);
    return url.pathname.split('/').filter(Boolean).pop() || '';
  } catch (_) {
    return '';
  }
}

async function resolveGoogleNewsUrlClient(value = '') {
  if (!isGoogleNewsUrl(value)) return value;

  const articleId = getGoogleNewsArticleId(value);
  if (!articleId) return value;

  const pageUrl = new URL(value);
  pageUrl.searchParams.set('hl', 'ko');
  pageUrl.searchParams.set('gl', 'KR');
  pageUrl.searchParams.set('ceid', 'KR:ko');

  const corsProxies = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
  ];

  for (const proxy of corsProxies) {
    try {
      const fetchUrl = `${proxy}${encodeURIComponent(pageUrl.href)}`;
      const response = await fetch(fetchUrl);
      if (!response.ok) continue;

      let html = await response.text();
      if (proxy.includes('allorigins') && !html.trim().startsWith('<')) {
        try {
          html = JSON.parse(html).contents;
        } catch (_) {}
      }

      if (!html) continue;

      // 1. HTML 내에 직접적인 <a> 태그나 특정 패턴으로 원본 URL이 들어있는지 검색
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const anchors = doc.querySelectorAll('a');
      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        if (href.startsWith('http') && !href.includes('google.com')) {
          return href;
        }
      }

      // 2. batchExecute API 호출 시도 (CORS 프록시 사용)
      const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
      const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
      if (signature && timestamp) {
        const rpcPayload = [[[
          'Fbv4je',
          JSON.stringify([
            'garturlreq',
            [['ko', 'KR', ['FINANCE_TOP_INDICES', 'GENESIS_PUBLISHER_SECTION', 'WEB_TEST_1_0_0'], null, null, 1, 1, 'KR:ko', null, 1, null, null, null, null, null, 0, 1], 'ko', 'KR', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
            articleId,
            Number(timestamp),
            signature
          ]),
          null,
          'generic'
        ]]];

        const batchUrl = 'https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je&hl=ko&gl=KR&ceid=KR%3Ako';
        const proxyBatchUrl = `${proxy}${encodeURIComponent(batchUrl)}`;

        const batchResponse = await fetch(proxyBatchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          },
          body: `f.req=${encodeURIComponent(JSON.stringify(rpcPayload))}`
        });

        if (batchResponse.ok) {
          const responseText = await batchResponse.text();
          try {
            const jsonLine = responseText.split('\n').find(line => line.trim().startsWith('['));
            const parsed = JSON.parse(jsonLine);
            const innerText = parsed?.[0]?.[2];
            const inner = innerText ? JSON.parse(innerText) : null;
            if (inner?.[1]) return inner[1];
          } catch (_) {
            const payloadMatch = responseText.match(/\\"garturlres\\",\\"((?:\\\\.|[^\\"])*)\\"/);
            if (payloadMatch?.[1]) {
              return JSON.parse(`"${payloadMatch[1]}"`);
            }
          }
        }
      }
    } catch (e) {
      console.warn('resolveGoogleNewsUrlClient proxy error:', e);
    }
  }

  return value;
}

function decodeHtmlResponseClient(buffer, contentType = '') {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  const charset = (
    contentType.match(/charset=([^;\s]+)/i)?.[1] ||
    utf8.match(/<meta[^>]+charset=["']?([^\s"'>]+)/i)?.[1] ||
    utf8.match(/<meta[^>]+content=["'][^"']*charset=([^\s"'>;]+)/i)?.[1] ||
    ''
  ).toLowerCase();

  if (charset && (charset === 'euc-kr' || charset === 'cp949' || charset === 'ks_c_5601-1987')) {
    try {
      return new TextDecoder('euc-kr').decode(bytes);
    } catch (_) {}
  }

  // 자동 한글 깨짐 (EUC-KR 모지바케) 지능형 감지
  const hasReplacementChar = utf8.includes('\uFFFD');
  const koreanMatches = utf8.match(/[가-힣]/g);
  const koreanCount = koreanMatches ? koreanMatches.length : 0;
  const chineseMatches = utf8.match(/[\u4e00-\u9fff]/g);
  const chineseCount = chineseMatches ? chineseMatches.length : 0;

  if (hasReplacementChar || (chineseCount > 50 && chineseCount > koreanCount) || (koreanCount > 0 && koreanCount < 20)) {
    try {
      const euckr = new TextDecoder('euc-kr').decode(bytes);
      const euckrKoreanMatches = euckr.match(/[가-힣]/g);
      const euckrKoreanCount = euckrKoreanMatches ? euckrKoreanMatches.length : 0;
      if (euckrKoreanCount > koreanCount * 2) {
        return euckr;
      }
    } catch (_) {}
  }

  if (charset && charset !== 'utf-8' && charset !== 'utf8') {
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch (_) {
      return utf8;
    }
  }

  return utf8;
}

function extractTitleFromHtmlClient(htmlText) {
  if (!htmlText) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.getAttribute('content')) {
      return ogTitle.getAttribute('content').replace(/\s+/g, ' ').trim();
    }

    const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
    if (twitterTitle && twitterTitle.getAttribute('content')) {
      return twitterTitle.getAttribute('content').replace(/\s+/g, ' ').trim();
    }

    const h1 = doc.querySelector('h1');
    if (h1 && h1.textContent) {
      return h1.textContent.replace(/\s+/g, ' ').trim();
    }

    const titleTag = doc.querySelector('title');
    if (titleTag && titleTag.textContent) {
      return titleTag.textContent.replace(/\s+/g, ' ').trim();
    }

    return '';
  } catch (e) {
    console.warn('extractTitleFromHtmlClient error:', e);
    return '';
  }
}

function extractTextFromHtmlClient(htmlText) {
  if (!htmlText) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    const excludeSelectors = [
      'script', 'style', 'noscript', 'header', 'footer', 'nav', 'aside', 'iframe', 'form',
      '.footer', '.header', '.nav', '.sidebar', '#footer', '#header', '#nav', '#sidebar',
      '.aside', '.comment', '.reply', '.ads', '.ad', '.ad-box', '.ad_box', '.banner'
    ];
    excludeSelectors.forEach(sel => {
      try {
        doc.querySelectorAll(sel).forEach(el => el.remove());
      } catch (_) {}
    });

    const bodySelectors = [
      'article',
      '[itemprop="articleBody"]',
      '#articleBody',
      '#articleBodyContents',
      '#article_body',
      '#article_content',
      '#newsEndContents',
      '#artBody',
      '.article_body',
      '.article-body',
      '.news_body',
      '.article_txt',
      '.article_content',
      '.viewer',
      '.story-news',
      '.view_con',
      '.news_content',
      '.news_txt',
      '.article_view',
      '#article_view',
      '#news_body',
      '#news_content'
    ];

    let bodyText = '';
    for (const selector of bodySelectors) {
      const el = doc.querySelector(selector);
      if (el) {
        const clone = el.cloneNode(true);
        const innerExclude = ['.reporter', '.author', '.sns', '.share', '.copyright', '.caption', '.byline', 'figcaption'];
        innerExclude.forEach(sel => {
          clone.querySelectorAll(sel).forEach(subEl => subEl.remove());
        });

        const text = clone.textContent || '';
        const clean = text.replace(/\s+/g, ' ').trim();
        if (clean.length > bodyText.length) {
          bodyText = clean;
        }
      }
    }

    if (bodyText.length < 150) {
      const paragraphTexts = [];
      doc.querySelectorAll('p, div').forEach(el => {
        if (el.tagName.toLowerCase() === 'div' && el.querySelector('div')) {
          return;
        }
        const className = el.className || '';
        const idName = el.id || '';
        if (/comment|reply|footer|header|nav|menu|sidebar|banner|ad/i.test(className + ' ' + idName)) {
          return;
        }
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length >= 30) {
          paragraphTexts.push(text);
        }
      });
      if (paragraphTexts.length > 0) {
        const combined = paragraphTexts.join(' ');
        if (combined.length > bodyText.length) {
          bodyText = combined;
        }
      }
    }

    if (bodyText.length < 150) {
      const metaDesc = doc.querySelector('meta[name="description"], meta[property="og:description"]');
      if (metaDesc) {
        const content = metaDesc.getAttribute('content') || '';
        const clean = content.replace(/\s+/g, ' ').trim();
        if (clean.length > bodyText.length) {
          bodyText = clean;
        }
      }
    }

    return bodyText;
  } catch (e) {
    console.warn('extractTextFromHtmlClient error:', e);
    return '';
  }
}

function cleanReaderArticleText(value = '') {
  return String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchArticleWithReaderApi(articleUrl) {
  if (!articleUrl || readerApiRequestCount >= READER_API_REQUEST_LIMIT) {
    return { title: '', text: '', finalUrl: articleUrl };
  }

  readerApiRequestCount += 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`https://r.jina.ai/${articleUrl}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'X-Return-Format': 'markdown',
        'X-Timeout': '8'
      }
    });
    if (!response.ok) return { title: '', text: '', finalUrl: articleUrl };

    const payload = await response.json();
    const data = payload?.data || payload || {};
    const title = cleanReaderArticleText(data.title || '');
    const text = cleanReaderArticleText(data.content || data.text || '');
    const finalUrl = String(data.url || articleUrl).trim();
    return { title, text, finalUrl };
  } catch (error) {
    console.info('모바일 원문 읽기 서비스 요청 실패:', error?.message || error);
    return { title: '', text: '', finalUrl: articleUrl };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchArticleDetailsForRss(articleUrl) {
  const url = String(articleUrl || '').trim();
  if (!url) return { title: '', text: '', finalUrl: url };

  const isLocal = checkIsLocalEnvironment();

  if (isLocal) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const resp = await fetch(`/api/article-text?url=${encodeURIComponent(url)}`, { signal: controller.signal });
      clearTimeout(timer);
      if (resp.ok) {
        const data = await resp.json();
        const rawHtml = data.html || '';
        let title = String(data.title || '').replace(/\s+/g, ' ').trim();
        let text = String(data.text || '').replace(/\s+/g, ' ').trim();
        const finalUrl = String(data.finalUrl || data.resolvedUrl || url).trim();

        if (rawHtml) {
          const clientTitle = extractTitleFromHtmlClient(rawHtml);
          const clientText = extractTextFromHtmlClient(rawHtml);
          if (clientTitle) title = clientTitle;
          if (clientText && clientText.length > text.length) text = clientText;
        }

        return { title, text, finalUrl };
      }
    } catch (err) {
      console.info('로컬 RSS 원문 본문 추출 실패, CORS 프록시로 대체 시도:', err?.message || err);
    }
  }

  const resolvedUrl = await resolveGoogleNewsUrlClient(url);

  const corsProxies = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
  ];

  for (const proxy of corsProxies) {
    try {
      const fetchUrl = `${proxy}${encodeURIComponent(resolvedUrl)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) continue;

      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || '';
      let html = decodeHtmlResponseClient(arrayBuffer, contentType);

      if (proxy.includes('allorigins') && !html.trim().startsWith('<')) {
        try {
          html = JSON.parse(html).contents;
        } catch (_) {}
      }

      if (!html) continue;

      const title = extractTitleFromHtmlClient(html);
      const text = extractTextFromHtmlClient(html);

      if (title || text) {
        return {
          title: title,
          text: text,
          finalUrl: resolvedUrl
        };
      }
    } catch (err) {
      console.warn(`CORS proxy [${proxy}] fetch failed for detail url [${resolvedUrl}]:`, err?.message || err);
    }
  }

  return { title: '', text: '', finalUrl: resolvedUrl };
}
function initStorage() {
  const savedCategories = localStorage.getItem('news_categories');
  const savedPrompt = localStorage.getItem('news_prompt');
  const savedApiKey = localStorage.getItem('news_api_key');
  const savedOpenaiApiKey = localStorage.getItem('news_openai_api_key');
  const savedGroqApiKey = localStorage.getItem('news_groq_api_key');
  const savedSourceMode = localStorage.getItem('news_source_mode');
  const savedVoice = localStorage.getItem('news_voice');
  const savedSpeed = localStorage.getItem('news_speed');
  const savedDetailChars = localStorage.getItem('news_detail_chars');

  if (savedCategories) {
    state.categories = JSON.parse(savedCategories);
  }
  if (savedPrompt !== null) {
    state.prompt = savedPrompt;
  }
  if (savedApiKey !== null) {
    state.apiKey = savedApiKey.trim();
  }
  if (savedOpenaiApiKey !== null) {
    state.openaiApiKey = savedOpenaiApiKey.trim();
  }
  if (savedGroqApiKey !== null) {
    state.groqApiKey = savedGroqApiKey.trim();
  }
  if (savedSourceMode && ['auto', 'openai', 'gemini', 'groq', 'rss'].includes(savedSourceMode)) {
    state.newsSourceMode = savedSourceMode;
  }
  if (savedVoice) {
    state.voiceName = savedVoice;
  }
  if (savedSpeed) {
    state.speed = parseFloat(savedSpeed);
  }
  if (savedDetailChars) {
    state.newsDetailChars = normalizeNewsDetailChars(savedDetailChars);
  }
  if (isMobileRuntime()) {
    state.newsDetailChars = Math.max(350, state.newsDetailChars);
  }
  const savedBriefingMode = localStorage.getItem('news_briefing_mode');
  if (savedBriefingMode && ['headlines_then_body', 'headline_only', 'body_only'].includes(savedBriefingMode)) {
    state.briefingMode = savedBriefingMode;
  }
  const briefingRadio = document.querySelector(`input[name="briefing-mode"][value="${state.briefingMode}"]`);
  if (briefingRadio) {
    briefingRadio.checked = true;
  }

  // 강제 마이그레이션: 기존 1.4배속 설정이 있거나 기본값이 없을 시 1.0배속으로 자동 교정
  if (state.speed === 1.4 || !savedSpeed) {
    state.speed = 1.0;
    localStorage.setItem('news_speed', '1.0');
  }

  // UI 컴포넌트에 바인딩
  const categoryCbs = document.querySelectorAll('input[name="categories"]');
  categoryCbs.forEach(cb => {
    cb.checked = state.categories.includes(cb.value);
  });

  // 전체 선택 체크박스 동기화
  const allChecked = categoryCbs.length > 0 && Array.from(categoryCbs).every(cb => cb.checked);
  const categoryAll = document.getElementById('category-all');
  const savedSources = localStorage.getItem('news_sources');
  if (savedSources) {
    try {
      state.sources = JSON.parse(savedSources);
    } catch (_) {
      state.sources = Object.keys(NEWS_SOURCE_DOMAINS);
    }
  } else {
    state.sources = Object.keys(NEWS_SOURCE_DOMAINS);
  }

  if (!Array.isArray(state.sources)) {
    state.sources = Object.keys(NEWS_SOURCE_DOMAINS);
  }

  // 검색 뉴스 출처 바인딩
  const sourceCbs = document.querySelectorAll('input[name="sources"]');
  sourceCbs.forEach(cb => {
    cb.checked = Array.isArray(state.sources) && state.sources.includes(cb.value);
  });

  const allSourcesChecked = sourceCbs.length > 0 && Array.from(sourceCbs).every(cb => cb.checked);
  const sourceAll = document.getElementById('source-all');
  if (sourceAll) {
    sourceAll.checked = allSourcesChecked;
  }

  
  if (categoryAll) {
    categoryAll.checked = allChecked;
  }

  document.getElementById('prompt-input').value = state.prompt;
  document.getElementById('api-key-input').value = state.apiKey;
  const openaiInput = document.getElementById('openai-api-key-input');
  if (openaiInput) openaiInput.value = state.openaiApiKey;
  const groqInput = document.getElementById('groq-api-key-input');
  if (groqInput) groqInput.value = state.groqApiKey;
  const sourceModeSelect = document.getElementById('news-source-mode');
  if (sourceModeSelect) sourceModeSelect.value = state.newsSourceMode;
  document.getElementById('speed-slider').value = state.speed;
  const detailInput = document.getElementById('detail-chars-input');
  if (detailInput) detailInput.value = state.newsDetailChars;
  document.getElementById('speed-val').innerText = `${state.speed.toFixed(1)}x`;
  document.getElementById('speed-label').innerText = `${state.speed.toFixed(1)}x`;
  updateNewsSourceModeDisplay();
}

function updateNewsSourceModeDisplay() {
  const badge = document.getElementById('news-source-badge');
  if (!badge) return;

  let modeLabel = '';
  
  if (state.newsList && state.newsList.length > 0) {
    const types = new Set();
    state.newsList.forEach(item => {
      if (item.summarized_by) types.add(item.summarized_by);
      if (item.isMock || item.source_type === 'mock') {
        types.add('mock');
      } else {
        types.add(item.source_type || 'rss');
      }
    });

    const labels = [];
    if (types.has('groq')) labels.push('Groq API');
    if (types.has('openai')) labels.push('OpenAI API');
    if (types.has('gemini')) labels.push('Gemini API');
    if (types.has('rss')) labels.push('Google News RSS 피드');
    if (types.has('mock')) labels.push('임시 샘플(Mock) 뉴스');

    if (labels.length > 0) {
      modeLabel = labels.join(' + ');
    } else {
      modeLabel = '알 수 없음';
    }
  } else {
    const mode = state.newsSourceMode || 'auto';
    if (mode === 'auto') {
      const hasOpenai = (state.openaiApiKey || '').trim().length > 0;
      const hasGemini = (state.apiKey || '').trim().length > 0;
      const hasGroq = (state.groqApiKey || '').trim().length > 0;
      if (hasGroq) {
        modeLabel = '자동 선택 (RSS 원문 + Groq 300자 요약)';
      } else if (hasOpenai) {
        modeLabel = '자동 선택 (RSS 원문 + OpenAI 300자 요약)';
      } else if (hasGemini) {
        modeLabel = '자동 선택 (RSS 원문 + Gemini 300자 요약)';
      } else {
        modeLabel = '자동 선택 (Google News RSS 피드)';
      }
    } else if (mode === 'openai') {
      modeLabel = 'OpenAI API';
    } else if (mode === 'gemini') {
      modeLabel = 'Gemini API';
    } else if (mode === 'groq') {
      modeLabel = 'Groq API';
    } else if (mode === 'rss') {
      modeLabel = 'Google News RSS 피드';
    }
  }

  badge.innerText = `뉴스 수집 방식: ${modeLabel}`;
}

// 브라우저의 목소리 목록 가져오기 및 채우기
function initVoices() {
  // SpeechSynthesis는 비동기로 로드되므로 이벤트 감지 필요
  const populate = () => {
    voices = synth.getVoices();
    const select = document.getElementById('voice-select');
    const playerSelect = document.getElementById('player-voice-select');
    if (!select || !playerSelect) return;

    // 한국어 목소리 선별 (ko-KR)
    let koVoices = voices.filter(v => v.lang.includes('ko') || v.lang.includes('KO'));

    // 고품질 신경망 목소리(Natural, Neural, Google Online)가 리스트 상단에 오도록 정렬
    koVoices.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      // 0순위: 선희 (SunHi) 신경망 보이스 최우선 배치 (사용자 최적 기본값 요청)
      const aHasSunHi = aName.includes('선희') || aName.includes('sunhi');
      const bHasSunHi = bName.includes('선희') || bName.includes('sunhi');
      if (aHasSunHi && !bHasSunHi) return -1;
      if (!aHasSunHi && bHasSunHi) return 1;

      // 1순위: Edge 내장 Neural / Natural (인간 수준의 자연스러운 음성)
      const aHasNatural = aName.includes('natural') || aName.includes('neural') || aName.includes('네추럴');
      const bHasNatural = bName.includes('natural') || bName.includes('neural') || bName.includes('네추럴');
      if (aHasNatural && !bHasNatural) return -1;
      if (!aHasNatural && bHasNatural) return 1;

      // 2순위: Chrome 내장 Google 온라인 음성
      const aHasGoogle = aName.includes('google');
      const bHasGoogle = bName.includes('google');
      if (aHasGoogle && !bHasGoogle) return -1;
      if (!aHasGoogle && bHasGoogle) return 1;

      return 0;
    });

    // 한국어 목소리가 없으면 영어 등 전체 로드
    const targetVoices = koVoices.length > 0 ? koVoices : voices;

    select.innerHTML = '';
    playerSelect.innerHTML = '';
    targetVoices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.name;

      // 사용자 이해를 돕기 위해 Neural 보이스인 경우 표시 추가
      const isNeural = voice.name.toLowerCase().includes('natural') || voice.name.toLowerCase().includes('neural');
      const displayName = isNeural ? `🌟 ${voice.name} [신경망]` : voice.name;

      option.textContent = `${displayName} (${voice.lang})`;
      if (voice.name === state.voiceName) {
        option.selected = true;
      }
      select.appendChild(option);
      playerSelect.appendChild(option.cloneNode(true)); // 플레이어 퀵 설정에도 동시 주입
    });

    // 기본 목소리 설정 및 자동 마이그레이션 (선희 음성 탐지 시 강제 적용)
    const savedVoice = localStorage.getItem('news_voice');
    const sunhiVoice = targetVoices.find(v => v.name.toLowerCase().includes('선희') || v.name.toLowerCase().includes('sunhi'));

    if (sunhiVoice && (!savedVoice || (!savedVoice.toLowerCase().includes('선희') && !savedVoice.toLowerCase().includes('sunhi')))) {
      state.voiceName = sunhiVoice.name;
      localStorage.setItem('news_voice', sunhiVoice.name);
      select.value = sunhiVoice.name;
      playerSelect.value = sunhiVoice.name;
    } else if (!savedVoice && targetVoices.length > 0) {
      state.voiceName = targetVoices[0].name;
      localStorage.setItem('news_voice', state.voiceName);
      select.value = state.voiceName;
      playerSelect.value = state.voiceName;
    } else if (savedVoice) {
      select.value = savedVoice;
      playerSelect.value = savedVoice;
    }
  };

  populate();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = populate;
  }
}

// 테마 초기 로딩 및 업데이트 (기본값: 라이트 모드)
function initTheme() {
  const savedTheme = localStorage.getItem('app_theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  const toggleBtn = document.getElementById('btn-theme-toggle');
  if (!toggleBtn) return;

  if (theme === 'dark') {
    toggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    toggleBtn.title = '라이트 모드로 변경';
  } else {
    toggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    toggleBtn.title = '다크 모드로 변경';
  }
}

// 오늘 날짜 표시
function updateDateDisplay() {
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  const todayStr = new Date().toLocaleDateString('ko-KR', options);
  document.getElementById('current-date').innerText = todayStr;
}

// ====================================================
// 3. UI 및 사용자 인터랙션 이벤트 처리
// ====================================================
function bindUIEvents() {
  // --- 풀다운 메뉴 제어 ---
  const menuTriggers = document.querySelectorAll('.menu-trigger');

  menuTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const parent = trigger.parentElement;
      const isActive = parent.classList.contains('active');

      // 기존에 열려 있는 메뉴 모두 닫기
      closeAllDropdowns();

      if (!isActive) {
        parent.classList.add('active');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // 빈 공간 클릭 시 드롭다운 닫기
  document.addEventListener('click', () => {
    closeAllDropdowns();
  });

  function closeAllDropdowns() {
    document.querySelectorAll('.menu-item.dropdown').forEach(item => {
      item.classList.remove('active');
      item.querySelector('.menu-trigger').setAttribute('aria-expanded', 'false');
    });
  }

  // --- 메뉴 항목 이벤트 ---
  document.getElementById('menu-fetch').addEventListener('click', (e) => {
    e.preventDefault();
    fetchNews();
  });

  document.getElementById('menu-print').addEventListener('click', (e) => {
    e.preventDefault();
    window.print();
  });

  document.getElementById('menu-exit').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('애플리케이션 창을 닫으시겠습니까?')) {
      window.close();
      // 브라우저 탭은 스크립트에 의해 열리지 않았을 때 close되지 않는 경향이 있으므로 실패 시 안내
      alert('브라우저 정책상 창을 직접 닫을 수 없습니다. 브라우저의 탭 닫기 버튼을 이용해 주세요.');
    }
  });

  // 모달 열기들
  document.getElementById('menu-settings').addEventListener('click', (e) => {
    e.preventDefault();
    openModal('modal-settings');
  });

  document.getElementById('menu-help').addEventListener('click', (e) => {
    e.preventDefault();
    openModal('modal-help');
  });

  document.getElementById('menu-about').addEventListener('click', (e) => {
    e.preventDefault();
    openModal('modal-about');
  });

  // --- 모달 닫기 제어 ---
  document.getElementById('btn-close-settings').addEventListener('click', () => closeModal('modal-settings'));
  document.getElementById('btn-close-help').addEventListener('click', () => closeModal('modal-help'));
  document.getElementById('btn-confirm-help').addEventListener('click', () => closeModal('modal-help'));
  document.getElementById('btn-close-about').addEventListener('click', () => closeModal('modal-about'));
  document.getElementById('btn-confirm-about').addEventListener('click', () => closeModal('modal-about'));

  // --- 설정 폼 저장 및 리셋 ---
  document.getElementById('btn-save-settings').addEventListener('click', (e) => {
    e.preventDefault();
    saveSettings();
    closeModal('modal-settings');
    fetchNews(); // 설정을 바꿨으므로 뉴스를 새로 가져옴
  });

  document.getElementById('btn-reset-settings').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('설정값을 초기화하시겠습니까?')) {
      localStorage.clear();
      state.briefingMode = 'headlines_then_body';
      const defRadio = document.querySelector('input[name="briefing-mode"][value="headlines_then_body"]');
      if (defRadio) defRadio.checked = true;
      initStorage();
      initVoices();
      alert('설정이 초기화되었습니다.');
    }
  });

  // 설정 창 속도 슬라이더 실시간 라벨 변경
  const speedSlider = document.getElementById('speed-slider');
  speedSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('speed-val').innerText = `${val.toFixed(1)}x`;
  });

  // --- TTS 오디오 플레이어 조작 ---
  document.getElementById('btn-play-pause').addEventListener('click', () => {
    togglePlayPause();
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    stopSpeech();
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    playNextNews();
  });

  document.getElementById('btn-prev').addEventListener('click', () => {
    playPrevNews();
  });

  // --- 플레이어바 목소리 퀵 설정 연동 ---
  const playerVoiceSelect = document.getElementById('player-voice-select');
  if (playerVoiceSelect) {
    playerVoiceSelect.addEventListener('change', (e) => {
      const selectedVal = e.target.value;
      state.voiceName = selectedVal;
      localStorage.setItem('news_voice', selectedVal);

      // 설정 모달 내 목소리 드롭다운 동기화
      const configSelect = document.getElementById('voice-select');
      if (configSelect) {
        configSelect.value = selectedVal;
      }

      // 재생 중인 경우 새 목소리로 낭독 바로 갱신
      if (state.isPlaying) {
        const currentIndex = state.currentNewsIndex;
        stopSpeech(false); // UI 초기화 방지
        setTimeout(() => {
          playNewsAtIndex(currentIndex);
        }, 150);
      }
    });
  }

  // --- 다크/라이트 테마 변경 토글 스위치 ---
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      const themeMode = isDark ? 'dark' : 'light';
      localStorage.setItem('app_theme', themeMode);
      updateThemeIcon(themeMode);
    });
  }

  // --- 관심사 전체 선택 (Select All) 제어 ---
  const categoryAll = document.getElementById('category-all');
  const categoryInputs = document.querySelectorAll('input[name="categories"]');

  if (categoryAll) {
    categoryAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      categoryInputs.forEach(cb => {
        cb.checked = isChecked;
      });
    });
  }

  categoryInputs.forEach(cb => {
    cb.addEventListener('change', () => {
      if (categoryAll) {
        const allChecked = Array.from(categoryInputs).every(item => item.checked);
        categoryAll.checked = allChecked;
      }
    });
  });

  // --- 검색 출처 전체 선택 (Select All) 제어 ---
  const sourceAll = document.getElementById('source-all');
  const sourceInputs = document.querySelectorAll('input[name="sources"]');

  if (sourceAll) {
    sourceAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      sourceInputs.forEach(cb => {
        cb.checked = isChecked;
      });
    });
  }

  sourceInputs.forEach(cb => {
    cb.addEventListener('change', () => {
      if (sourceAll) {
        const allChecked = Array.from(sourceInputs).every(item => item.checked);
        sourceAll.checked = allChecked;
      }
    });
  });

  // --- 퀵 설정 버튼 제어 ---
  const btnQuickSettings = document.getElementById('btn-quick-settings');
  if (btnQuickSettings) {
    btnQuickSettings.addEventListener('click', () => {
      openModal('modal-settings');
    });
  }
}

// 키보드 단축키
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl + R: 뉴스 새로고침
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      fetchNews();
    }
    // Ctrl + P: PDF 인쇄
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      window.print();
    }
    // Ctrl + ,: 설정 열기
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      openModal('modal-settings');
    }
    // F1: 도움말 열기
    if (e.key === 'F1') {
      e.preventDefault();
      openModal('modal-help');
    }
  });
}

// 모달 제어 함수
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('hidden');
  }
}

// 설정 값 로컬 저장소 저장
function saveSettings() {
  const selectedSources = Array.from(document.querySelectorAll('input[name="sources"]:checked')).map(cb => cb.value);
  state.sources = selectedSources;
  localStorage.setItem('news_sources', JSON.stringify(selectedSources));

  const selectedCategories = Array.from(document.querySelectorAll('input[name="categories"]:checked')).map(cb => cb.value);
  const promptValue = document.getElementById('prompt-input').value;
  const apiKeyValue = document.getElementById('api-key-input').value.trim();
  const openaiApiKeyValue = document.getElementById('openai-api-key-input')?.value.trim() || '';
  const groqApiKeyValue = document.getElementById('groq-api-key-input')?.value.trim() || '';
  const sourceModeValue = document.getElementById('news-source-mode')?.value || 'auto';
  const voiceValue = document.getElementById('voice-select').value;
  const speedValue = parseFloat(document.getElementById('speed-slider').value);
  const detailCharsValue = normalizeNewsDetailChars(document.getElementById('detail-chars-input')?.value || DEFAULT_NEWS_DETAIL_CHARS);

  state.categories = selectedCategories;
  state.prompt = promptValue;
  state.apiKey = apiKeyValue;
  state.openaiApiKey = openaiApiKeyValue;
  state.groqApiKey = groqApiKeyValue;
  state.newsSourceMode = ['auto', 'openai', 'gemini', 'groq', 'rss'].includes(sourceModeValue) ? sourceModeValue : 'auto';
  state.voiceName = voiceValue;
  state.speed = speedValue;
  state.newsDetailChars = detailCharsValue;

  const selectedBriefingMode = document.querySelector('input[name="briefing-mode"]:checked')?.value || 'headlines_then_body';
  state.briefingMode = selectedBriefingMode;
  localStorage.setItem('news_briefing_mode', selectedBriefingMode);

  localStorage.setItem('news_categories', JSON.stringify(selectedCategories));
  localStorage.setItem('news_prompt', promptValue);
  localStorage.setItem('news_api_key', apiKeyValue);
  localStorage.setItem('news_openai_api_key', openaiApiKeyValue);
  localStorage.setItem('news_groq_api_key', groqApiKeyValue);
  localStorage.setItem('news_source_mode', state.newsSourceMode);
  localStorage.setItem('news_voice', voiceValue);
  localStorage.setItem('news_speed', speedValue.toString());
  localStorage.setItem('news_detail_chars', detailCharsValue.toString());

  // Mobile restores these values on its next load and uses the same detailed API settings as the PC.
  void persistSharedNewsSettings();

  // 플레이어바 목소리 퀵 드롭다운 동기화
  const playerVoiceSelect = document.getElementById('player-voice-select');
  if (playerVoiceSelect) {
    playerVoiceSelect.value = voiceValue;
  }

  // 플레이어 속도 라벨 업데이트
  document.getElementById('speed-label').innerText = `${speedValue.toFixed(1)}x`;

  updateNewsSourceModeDisplay();

  // 재생 중인 Utterance가 있다면 바로 속도/목소리 변경 반영
  if (synth.speaking) {
    // 진행 중인 낭독을 멈추고 현재 뉴스 카드를 다시 읽도록 유도
    const currentIndex = state.currentNewsIndex;
    stopSpeech();
    setTimeout(() => {
      playNewsAtIndex(currentIndex);
    }, 150);
  }
}

// ====================================================
// 4. 뉴스 데이터 처리 및 가져오기 로직
// ====================================================
// 카테고리 매칭 모의 뉴스를 포맷에 맞춰 반환하는 헬퍼 함수
function getMockNewsForCategory(category, minusMinutes, count = 1) {
  let templates = MOCK_NEWS_TEMPLATES.filter(item => item.category === category);
  if (templates.length === 0) {
    templates = [MOCK_NEWS_TEMPLATES[0]]; // 폴백
  }

  const promptStyle = state.prompt.toLowerCase();
  const now = new Date();

  let results = [];
  // 요청된 count 개수만큼 (템플릿이 부족하면 회전 복제) 생성
  for (let i = 0; i < count; i++) {
    const item = templates[i % templates.length];
    // 기사마다 분 단위 시차를 조금씩 주어 차별화
    const target = new Date(now.getTime() - (minusMinutes + i * 20) * 60 * 1000);
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const date = String(target.getDate()).padStart(2, '0');
    const hours = target.getHours();
    const minutes = target.getMinutes();
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
    const formattedTime = `${month}.${date} ${ampm} ${displayHours}:${displayMinutes}`;

    let modifiedBody = item.body;
    let modifiedTitle = item.title;

    // 복수 기사 구분을 위해 타이틀 뒤에 순번 꼬리표 추가 (count > 1 일 때만)
    if (count > 1) {
      modifiedTitle = `${modifiedTitle} (${i + 1})`;
    }

    if (promptStyle.includes('간단') || promptStyle.includes('요약')) {
      modifiedBody = modifiedBody.split(' ').slice(0, 15).join(' ') + '... (간단 요약 완료)';
    } else if (promptStyle.includes('격려') || promptStyle.includes('희망')) {
      modifiedBody = modifiedBody + ' 활기찬 아침, 오늘도 힘내세요!';
    } else if (promptStyle.includes('쉬운') || promptStyle.includes('초등')) {
      modifiedBody = '🤖 [쉽게 읽기] ' + modifiedBody.replace('경감', '줄임').replace('합성', '만들기').replace('경신', '뛰어넘음');
    }

    results.push({
      ...item,
      id: item.id * 100 + i, // 고유 ID 충돌 방지
      title: modifiedTitle,
      body: modifiedBody,
      time: formattedTime,
      isMock: true,
      source_type: 'mock'
    });
  }

  return results;
}

// ====================================================
// 구글 뉴스 RSS 실시간 수집 함수 (API 키 불필요)
// 로컬 환경의 경우 Vite 프록시를 사용하여 CORS 문제 없이 수집하며,
// 외부 환경의 경우 공개 CORS 프록시를 거쳐 최신 뉴스를 가져옵니다.
// ====================================================
function convertToBroadcastHonorifics(value) {
  return String(value || '')
    .replace(/이다(?=\s*[.!?]|\s*$)/gm, '입니다')
    .replace(/된다(?=\s*[.!?]|\s*$)/gm, '됩니다')
    .replace(/한다(?=\s*[.!?]|\s*$)/gm, '합니다')
    .replace(/있다(?=\s*[.!?]|\s*$)/gm, '있습니다')
    .replace(/없다(?=\s*[.!?]|\s*$)/gm, '없습니다')
    .replace(/보인다(?=\s*[.!?]|\s*$)/gm, '보입니다')
    .replace(/나선다(?=\s*[.!?]|\s*$)/gm, '나섭니다')
    .replace(/(?:했|됐|었|았|였|혔|웠|섰|졌|렸|쳤|켰|났|갔|왔)다(?=\s*[.!?]|\s*$)/gm, match => `${match.slice(0, -1)}습니다`);
}
function formatFourLineWrittenSummary(value, meta = {}) {
  const raw = String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^(?:here(?:'s| is)|analysis|reasoning|thinking)[\s\S]*?(?=[가-힣])/i, '')
    .replace(/```(?:text)?/gi, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/gm, '')
    .trim();

  const isKoreanLine = (line) => {
    const hangulCount = (line.match(/[가-힣]/g) || []).length;
    const latinCount = (line.match(/[A-Za-z]/g) || []).length;
    return hangulCount >= 10 && hangulCount > latinCount;
  };
  const isHonorificLine = (line) => /(?:습니다|입니다|됩니다)(?:[.!?]|$)/.test(line.trim());

  let lines = raw.split(/\r?\n/)
    .map(line => convertToBroadcastHonorifics(cleanNewsBodyText(line, meta.category, meta.source_name)))
    .filter(line => line && isKoreanLine(line));

  if (lines.length < 4) {
    const flat = convertToBroadcastHonorifics(cleanNewsBodyText(raw, meta.category, meta.source_name));
    if (!isKoreanLine(flat)) return '';
    lines = flat.split(/(?<=[.!?])\s+/).map(line => line.trim()).filter(isKoreanLine);
  }

  if (lines.length < 4) return '';
  if (lines.length > 4) {
    lines = [...lines.slice(0, 3), lines.slice(3).join(' ')];
  }
  return lines.every(line => isKoreanLine(line) && isHonorificLine(line)) ? lines.join('\n') : '';
}

function formatRssArticleExcerpt(articleText, meta = {}) {
  const cleaned = cleanNewsBodyText(articleText, meta.category, meta.source_name)
    .replace(/(?:사진은|사진\s*[=:])[^.?!]*(?:모습|장면)\.?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (normalizeNewsCompareText(cleaned) === normalizeNewsCompareText(meta.title)) return '';
  return convertToBroadcastHonorifics(ensureNewsBodyLength(cleaned, meta));
}
async function summarizeExtractedArticleWithApi(articleText, meta = {}) {
  const text = String(articleText || '').replace(/\s+/g, ' ').trim();
  if (text.length < RSS_MIN_BODY_CHARS) return { body: '', provider: '' };

  const prompt = [
    '다음 뉴스 기사 전체 원문을 뉴스 아나운서가 낭독하는 격식 있는 한국어 존댓말로 요약하세요.',
    '전체 분량은 290~320자로 하고, 반드시 정확히 4줄로 작성하세요.',
    '각 줄은 완결된 단문 또는 중문 한 문장으로 작성하고 줄바꿈으로만 구분하세요.',
    '한 문장은 45~80자 안에서 작성하고, 한 문장에는 하나의 핵심 정보만 담으세요.',
    '쉼표와 접속어를 반복해 여러 사실을 장문으로 이어 붙이지 마세요.',
    '친근한 대화체는 쓰지 말고 방송 뉴스체인 ~입니다, ~했습니다, ~할 전망입니다 형식을 사용하세요.',
    '네 줄에 핵심 사실, 배경과 주요 수치, 영향, 향후 전망을 각각 압축해 담으세요.',
    '기사에 없는 사실을 추가하지 말고 제목 반복, 번호, 글머리표, 출처 안내, 부연 설명을 쓰지 마세요.',
    `제목: ${meta.title || ''}`,
    `언론사: ${meta.source_name || ''}`,
    `원문: ${text.slice(0, 12000)}`
  ].join('\n');

  if (state.newsSourceMode !== 'gemini' && state.newsSourceMode !== 'openai' && (state.groqApiKey || '').trim()) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.groqApiKey.trim()}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: '모든 답변을 한국어로만 작성한다. 뉴스 아나운서가 낭독하는 격식 있는 존댓말을 사용한다. 영어 설명이나 분석·사고 과정은 출력하지 않는다. 최종 뉴스 요약 4줄만 출력한다.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_completion_tokens: 600
        })
      });
      if (response.ok) {
        const data = await response.json();
        const raw = data?.choices?.[0]?.message?.content || '';
        const body = formatFourLineWrittenSummary(raw, meta);
        if (body.length >= 220) return { body, provider: 'groq' };
      }
    } catch (error) {
      console.warn('Groq 원문 요약 실패:', error?.message || error);
    }
  }

  if (state.newsSourceMode !== 'gemini' && state.newsSourceMode !== 'groq' && (state.openaiApiKey || '').trim()) {
    try {
      const targetUrl = checkIsLocalEnvironment()
        ? '/api/openai/v1/responses'
        : 'https://api.openai.com/v1/responses';
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.openaiApiKey.trim()}`
        },
        body: JSON.stringify({ model: 'gpt-4o-mini', input: prompt })
      });
      if (response.ok) {
        const body = formatFourLineWrittenSummary(extractOpenAIOutputText(await response.json()), meta);
        if (body.length >= 220) return { body, provider: 'openai' };
      }
    } catch (error) {
      console.warn('OpenAI 원문 요약 실패:', error?.message || error);
    }
  }

  if (state.newsSourceMode !== 'openai' && state.newsSourceMode !== 'groq' && (state.apiKey || '').trim()) {
    for (const { name: model, version } of FAST_NEWS_MODEL_CANDIDATES) {
      try {
        const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${state.apiKey.trim()}`;
        const response = await rateLimitedFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (!response.ok) continue;
        const data = await response.json();
        const raw = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join(' ') || '';
        const body = formatFourLineWrittenSummary(raw, meta);
        if (body.length >= 220) return { body, provider: 'gemini' };
      } catch (error) {
        console.warn('Gemini 원문 요약 실패:', error?.message || error);
      }
    }
  }

  return { body: '', provider: '' };
}

async function fetchGoogleNewsRSS(category, count = 1, options = {}) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname);
  const siteFilter = getQuerySourceFilter();
  const query = encodeURIComponent(`${category} 최신 뉴스 when:12h${siteFilter}`);
  const targetPath = `/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko`;

  const urls = [];
  const emergencyCandidates = [];
  if (isLocal) {
    urls.push(`/api/google-news${targetPath}`);
  }

  const targetUrl = `https://news.google.com${targetPath}`;
  urls.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);
  urls.push(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
  urls.push(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);

  for (const fetchUrl of urls) {
    try {
      console.log(`📡 [${category}] Google News RSS 요청 시도: ${fetchUrl}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000); // 8초 타임아웃

      const resp = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (!resp.ok) continue;
      let xmlText = await resp.text();

      // allorigins proxy 등의 응답 래핑 해제 (JSON 형태인 경우)
      if (fetchUrl.includes('allorigins') && !xmlText.trim().startsWith('<')) {
        try {
          const jsonObj = JSON.parse(xmlText);
          xmlText = jsonObj.contents;
        } catch (_) {}
      }

      if (!xmlText || (!xmlText.includes('<rss') && !xmlText.includes('<channel'))) continue;

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const items = xmlDoc.querySelectorAll('item');
      if (items.length === 0) continue;

const result = [];
      const fallbackResult = [];
      let articleTextAttempts = 0;

      for (let i = 0; i < items.length && i < RSS_MAX_ITEMS_TO_SCAN; i++) {
        const item = items[i];
        const rawTitle = item.querySelector('title')?.textContent || '';
        let link = (item.querySelector('link')?.textContent || '').trim();

        // 1차 도메인 검증 (RSS source tag 도메인 우선 검증)
        const sourceTag = item.querySelector('source');
        const sourceUrlAttr = sourceTag ? sourceTag.getAttribute('url') : '';
        const rssSourceName = (sourceTag?.textContent || '').trim();
        const initialCheckUrl = sourceUrlAttr || link;
        if (!isDomainSelected(initialCheckUrl)) {
          continue;
        }

        const pubDate = item.querySelector('pubDate')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const publishedAt = pubDate ? new Date(pubDate) : null;
        if (!publishedAt || Number.isNaN(publishedAt.getTime()) || !isDateWithinNewsRecency(publishedAt)) {
          continue;
        }

        let title = rawTitle.trim();
        let sourceName = '뉴스 원문';
        const lastDashIndex = title.lastIndexOf(' - ');
        if (lastDashIndex !== -1) {
          sourceName = title.substring(lastDashIndex + 3).trim();
          title = title.substring(0, lastDashIndex).trim();
        }
        if (rssSourceName) sourceName = rssSourceName;

        const cleanDesc = description.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
        let articleBodyText = cleanDesc;
        if (articleBodyText.length < RSS_MIN_BODY_CHARS && articleTextAttempts < RSS_ARTICLE_TEXT_ATTEMPT_LIMIT) {
          articleTextAttempts += 1;
          const articleDetails = await fetchArticleDetailsForRss(link.trim());
          if (isUsefulExtractedArticleTitle(articleDetails.title, title, sourceName)) {
            title = articleDetails.title;
          }
          if (isUsefulExtractedArticleBody(articleDetails.text, articleBodyText)) {
            articleBodyText = articleDetails.text;
          }
          if (articleDetails.finalUrl) {
            link = articleDetails.finalUrl;
          }
          // 2차 도메인 검증 (최종 리다이렉트 해결 후 검증)
          if (!isDomainSelected(link)) {
            continue;
          }
        }

        const isShortRssBody = articleBodyText.length < RSS_MIN_BODY_CHARS;
        if (isShortRssBody) {
          console.info(`[${category}] RSS 본문이 ${RSS_MIN_BODY_CHARS}자 미만이지만 300자 이상 후보가 없을 때 예비로 사용:`, rawTitle.trim());
        }

        let timeStr = '오늘';
        try {
          const d = new Date(pubDate);
          if (!isNaN(d.getTime())) {
            const h = d.getHours();
            timeStr = `${d.getMonth() + 1}.${d.getDate()} ${h >= 12 ? '오후' : '오전'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
          }
        } catch (_) {}

        const displayBody = cleanNewsBodyText(articleBodyText, category, sourceName);
        const displayTitle = cleanNewsBodyText(title, category, sourceName);
        const genericPortalTitle = /^(?:google|최신|전체|전체[｜|]\s*리스트|네이버\s*증권|동아일보)$/i.test(displayTitle.replace(/^[-–—]\s*/, '').trim());
        if (!displayTitle || genericPortalTitle) {
          console.info('기사 제목이 아닌 포털·목록 항목을 제외합니다:', displayTitle);
          continue;
        }

        if (isNarrationUnfriendlyArticle(articleBodyText, displayTitle)) {
          console.info('표·수치 목록형 기사라 낭독 후보에서 제외합니다:', displayTitle);
          continue;
        }

        const bodyMatchesTitle = normalizeNewsCompareText(displayBody) === normalizeNewsCompareText(displayTitle);

        // Google News RSS sometimes returns the headline itself as its description.
        // It is not an article body, so never render it as one on mobile.
        if (bodyMatchesTitle) {
          console.info('원문 추출 실패로 RSS 제목·설명을 안전 후보로 보관합니다:', displayTitle);
          if (!/(세계의\s*날씨|주요\s*도시.*날씨|도시별.*날씨)/.test(displayTitle)) {
            emergencyCandidates.push({
              id: Date.now() + i + Math.floor(Math.random() * 1000),
              category,
              title: displayTitle,
              body: `${displayTitle} 관련 최신 소식이 RSS를 통해 확인됐습니다. 원문 본문을 불러오기 어려워 RSS가 제공한 기사 정보를 먼저 전해드립니다.`,
              time: timeStr,
              source_name: sourceName,
              source_url: link.trim(),
              source_home_url: sourceUrlAttr,
              source_type: 'rss',
              summarized_by: 'rss',
              is_short_rss_body: true
            });
          }
          continue;
        }

        if (sourceName && displayBody) {
          let body = ensureNewsBodyLength(displayBody || displayTitle, {
            title: displayTitle,
            source_name: sourceName,
            category,
            time: timeStr,
            source_type: 'rss'
          });

          const rssNewsItem = {
            id: Date.now() + i + Math.floor(Math.random() * 1000),
            category: category,
            title: displayTitle,
            body: body,
            time: timeStr,
            source_name: sourceName,
            source_url: link.trim(),
            source_home_url: sourceUrlAttr,
            source_type: 'rss',
            raw_article_body: articleBodyText,
            summarized_by: '',
            is_short_rss_body: isShortRssBody
          };

          if (isShortRssBody) {
            fallbackResult.push(rssNewsItem);
          } else {
            result.push(rssNewsItem);
          }
        }
      }

      if (result.length > 0 || fallbackResult.length > 0) {
        const pool = result.length > 0 ? result : fallbackResult;
        if (result.length === 0) {
          state.lastRssError = `[${category}] RSS 요약 ${RSS_MIN_BODY_CHARS}자 이상 후보가 없어 짧은 최신 RSS 후보로 표시합니다`;
          console.warn(state.lastRssError);
        }
        const selected = selectRandomUnseenNewsItems(pool, count);
        const hasSummaryApi = Boolean((state.groqApiKey || '').trim() || (state.openaiApiKey || '').trim() || (state.apiKey || '').trim());
        const finalized = [];

        // Select first, then summarize only the articles that will actually be shown.
        for (const item of selected) {
          const rawArticleBody = String(item.raw_article_body || item.body || '').trim();
          const rssExcerpt = formatRssArticleExcerpt(rawArticleBody, item) || item.body;
          if (hasSummaryApi) {
            const summary = await summarizeExtractedArticleWithApi(rawArticleBody, item);
            if (summary.body) {
              item.body = ensureNewsBodyLength(summary.body, item);
              item.summarized_by = summary.provider;
              item.is_short_rss_body = false;
            } else {
              item.body = rssExcerpt;
              item.summarized_by = 'rss';
              console.warn('모든 요약 API가 실패하여 실제 RSS 원문 앞부분을 표시합니다:', item.title);
            }
          } else {
            item.body = rssExcerpt;
            item.summarized_by = 'rss';
          }
          delete item.raw_article_body;
          finalized.push(item);
        }

        console.log(`✅ [${category}] Google News RSS 수집 성공 (${finalized.length}/${pool.length}건, 긴 본문 ${result.length}건, 예비 ${fallbackResult.length}건)`);
        return finalized;
      }
    } catch (e) {
      if (e?.code === 'RSS_API_SUMMARY_FAILED') throw e;
      console.warn(`⚠️ Proxy [${fetchUrl}] 수집 실패:`, e.message);
    }
  }

  if (emergencyCandidates.length > 0) {
    const selectedEmergency = selectRandomUnseenNewsItems(emergencyCandidates, count);
    if (selectedEmergency.length > 0) {
      state.lastRssError = `[${category}] 원문 추출이 어려워 RSS가 제공한 실제 기사 정보를 표시합니다`;
      console.warn(state.lastRssError);
      return selectedEmergency;
    }
  }

  // 모든 프록시 실패 시 → 모의 뉴스 폴백
  state.lastRssError = `[${category}] 최근 ${NEWS_RECENCY_HOURS}시간 이내이며 RSS 요약 ${RSS_MIN_BODY_CHARS}자 이상인 뉴스가 없습니다`;
  console.warn(`[${category}] 최근 ${NEWS_RECENCY_HOURS}시간 이내이며 RSS 요약 ${RSS_MIN_BODY_CHARS}자 이상인 뉴스가 없습니다`);
  return [];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractRetryDelayMs(message = '') {
  const match = String(message).match(/retryDelay['"]?s*:s*['"]?(\d+(?:\.\d+)?)s/i) || String(message).match(/retry ins*(\d+(?:\.\d+)?)s/i);
  if (!match) return 0;
  return Math.ceil(Number(match[1]) * 1000) + GEMINI_QUOTA_RETRY_PADDING_MS;
}

async function waitForGeminiRequestSlot() {
  const previous = geminiRequestQueue;
  let release;
  geminiRequestQueue = new Promise(resolve => { release = resolve; });
  await previous;

  const now = Date.now();
  const waitMs = Math.max(0, nextGeminiRequestAt - now);
  if (waitMs > 0) await sleep(waitMs);

  nextGeminiRequestAt = Date.now() + GEMINI_MIN_REQUEST_INTERVAL_MS;
  return release;
}

async function rateLimitedFetch(url, options) {
  const release = await waitForGeminiRequestSlot();
  try {
    return await fetch(url, options);
  } finally {
    release();
  }
}
function isMobileRuntime() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

// A phone and the PC use different localStorage stores even when they open the
// same Vite server. Restore the PC's generation settings before the first fetch.
async function restoreSharedSettingsForThisDevice() {
  if (!isMobileRuntime() || !checkIsLocalEnvironment()) return;

  try {
    const response = await fetch('/api/settings', { cache: 'no-store' });
    if (!response.ok) return;

    const shared = await response.json();
    const mappings = {
      categories: 'news_categories',
      sources: 'news_sources',
      prompt: 'news_prompt',
      apiKey: 'news_api_key',
      openaiApiKey: 'news_openai_api_key',
      groqApiKey: 'news_groq_api_key',
      newsSourceMode: 'news_source_mode',
      newsDetailChars: 'news_detail_chars',
      briefingMode: 'news_briefing_mode'
    };

    Object.entries(mappings).forEach(([settingKey, storageKey]) => {
      if (shared[settingKey] === undefined || shared[settingKey] === null) return;
      const value = Array.isArray(shared[settingKey])
        ? JSON.stringify(shared[settingKey])
        : String(shared[settingKey]);
      localStorage.setItem(storageKey, value);
    });
  } catch (error) {
    console.info('Shared settings are unavailable; using this device settings.', error?.message || error);
  }
}

async function persistSharedNewsSettings() {
  if (!checkIsLocalEnvironment()) return;

  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categories: state.categories,
        sources: state.sources,
        prompt: state.prompt,
        apiKey: state.apiKey,
        openaiApiKey: state.openaiApiKey,
        groqApiKey: state.groqApiKey,
        newsSourceMode: state.newsSourceMode,
        newsDetailChars: state.newsDetailChars,
        briefingMode: state.briefingMode
      })
    });
  } catch (error) {
    console.info('Could not share settings with other devices.', error?.message || error);
  }
}

function checkIsLocalEnvironment() {
  return window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1' ||
         /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname) ||
         window.location.hostname.endsWith('.local') ||
         window.location.port !== '';
}


function getNewsErrorAdvice(message = '') {
  const text = String(message);
  const advice = [];

  if (isMobileRuntime()) {
    advice.push('휴대폰 브라우저는 PC와 설정 저장소가 분리되어 있어 Gemini API 키를 휴대폰에서도 한 번 입력해야 합니다.');
  }
  if (!navigator.onLine) {
    advice.push('현재 브라우저가 오프라인 상태로 감지됩니다. 와이파이 또는 모바일 데이터를 확인해 주세요.');
  }
  if (/API 키|API key|key/i.test(text)) {
    advice.push('설정 창에서 Gemini API 키가 비어 있지 않은지, 앞뒤 공백 없이 저장됐는지 확인해 주세요.');
  }
  if (/429|quota|한도|rate/i.test(text)) {
    advice.push('Gemini 무료 요청 한도에 도달했습니다. 앱이 자동 대기 후 재시도하지만, 한도가 계속 막히면 1분 정도 뒤 다시 시도해야 합니다.');
  }
  if (/네트워크|Failed to fetch|Network|인터넷/i.test(text)) {
    advice.push('휴대폰에서 이 앱 주소에 접속한 뒤 외부 HTTPS 요청이 가능한지 확인해 주세요. 회사/공공 와이파이에서는 Google API가 차단될 수 있습니다.');
  }
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    advice.push('휴대폰에서 PC 개발 서버를 HTTP로 접속 중입니다. 일부 모바일 브라우저 기능이 제한될 수 있습니다.');
  }

  return advice;
}
function getKstDateInfo(date = new Date()) {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: parts.month,
    date: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    label: `${Number(parts.year)}년 ${Number(parts.month)}월 ${Number(parts.day)}일`
  };
}

function parseKoreanNewsTimeToDate(timeText, reference = new Date()) {
  if (!timeText || typeof timeText !== 'string') return null;

  const refKst = getKstDateInfo(reference);
  const match = timeText.match(/(?:(\d{4})[.\-/년]\s*)?(\d{1,2})[.\-/월]\s*(\d{1,2})일?\s*(오전|오후)?\s*(\d{1,2})[:시]\s*(\d{1,2})?/);
  if (!match) return null;

  const year = match[1] ? Number(match[1]) : refKst.year;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ampm = match[4];
  let hour = Number(match[5]);
  const minute = match[6] ? Number(match[6]) : 0;

  if (ampm === '오후' && hour < 12) hour += 12;
  if (ampm === '오전' && hour === 12) hour = 0;

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
}

function isDateWithinNewsRecency(date, now = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const diffMs = now.getTime() - date.getTime();
  const futureToleranceMs = 5 * 60 * 1000;
  const maxAgeMs = NEWS_RECENCY_HOURS * 60 * 60 * 1000;
  return diffMs >= -futureToleranceMs && diffMs <= maxAgeMs;
}
function isRecentNewsTime(timeText, now = new Date()) {
  const parsed = parseKoreanNewsTimeToDate(timeText, now);
  if (!parsed) return false;
  return isDateWithinNewsRecency(parsed, now);
}

function isLikelyDetailedArticleUrl(urlText) {
  try {
    const url = new URL(urlText);
    const host = url.hostname.replace(/^www\./, '');
    const normalizedPath = url.pathname.replace(/\/+$/, '');
    const isHomeUrl = normalizedPath === '' || normalizedPath === '/';
    const blockedHosts = ['naver.com', 'daum.net'];

    if (blockedHosts.includes(host) || urlText.includes('example.com')) return false;
    if (urlText.includes('AKR20260713000100001')) return false;
    if (isHomeUrl && !url.search) return false;

    return /^https?:$/.test(url.protocol);
  } catch (_) {
    return false;
  }
}
function buildBackgroundNewsPlan(categories, remainingTotal) {
  const plan = [];
  if (remainingTotal <= 0 || categories.length === 0) return plan;

  const activeCategories = categories.slice(0, Math.min(categories.length, MAX_BACKGROUND_NEWS_REQUESTS, remainingTotal));
  const overfetchTotal = remainingTotal + Math.min(remainingTotal, activeCategories.length);

  for (let i = 0; i < overfetchTotal; i++) {
    const category = activeCategories[i % activeCategories.length];
    let entry = plan.find(item => item.category === category);
    if (!entry) {
      entry = { category, count: 0 };
      plan.push(entry);
    }
    entry.count += 1;
  }

  return plan;
}
function normalizeNewsCompareText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeNewsCompareUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    url.hash = '';
    [...url.searchParams.keys()].forEach(key => {
      if (/^(utm_|fbclid|gclid|ocid|ref|source)/i.test(key)) {
        url.searchParams.delete(key);
      }
    });
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`.toLowerCase();
  } catch (_) {
    return normalizeNewsCompareText(raw);
  }
}

function getNewsCompareKey(item) {
  const urlKey = normalizeNewsCompareUrl(item?.source_url);
  if (urlKey) return `url:${urlKey}`;

  const titleKey = normalizeNewsCompareText(item?.title);
  return titleKey ? `title:${titleKey}` : '';
}

function getRecentSeenNewsMap() {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(NEWS_SEEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const entries = Object.entries(parsed || {})
      .filter(([, seenAt]) => Number.isFinite(seenAt) && now - seenAt <= NEWS_SEEN_TTL_MS)
      .sort((a, b) => b[1] - a[1])
      .slice(0, NEWS_SEEN_LIMIT);
    return Object.fromEntries(entries);
  } catch (_) {
    return {};
  }
}

function saveRecentSeenNewsMap(seenMap) {
  try {
    const entries = Object.entries(seenMap || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, NEWS_SEEN_LIMIT);
    localStorage.setItem(NEWS_SEEN_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (_) {}
}

function isRecentlySeenNewsItem(item) {
  const key = getNewsCompareKey(item);
  if (!key) return false;
  return Boolean(getRecentSeenNewsMap()[key]);
}

function rememberSeenNewsItem(item) {
  const key = getNewsCompareKey(item);
  if (!key) return;

  const seenMap = getRecentSeenNewsMap();
  seenMap[key] = Date.now();
  saveRecentSeenNewsMap(seenMap);
}

function shuffleNewsItems(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function selectRandomUnseenNewsItems(items, count) {
  const validItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (validItems.length === 0) return [];

  const unseenItems = validItems.filter(item => !isRecentlySeenNewsItem(item));
  const pool = unseenItems.length > 0 ? unseenItems : validItems;
  return shuffleNewsItems(pool).slice(0, count);
}
function isDuplicateNewsItem(candidate) {
  const candidateUrl = normalizeNewsCompareUrl(candidate?.source_url);
  const candidateTitle = normalizeNewsCompareText(candidate?.title);
  const candidateBodyHead = normalizeNewsCompareText(candidate?.body).slice(0, 180);

  return state.newsList.some(existing => {
    const existingUrl = normalizeNewsCompareUrl(existing?.source_url);
    if (candidateUrl && existingUrl && candidateUrl === existingUrl) return true;

    const existingTitle = normalizeNewsCompareText(existing?.title);
    if (candidateTitle && existingTitle && candidateTitle === existingTitle) return true;

    const existingBodyHead = normalizeNewsCompareText(existing?.body).slice(0, 180);
    return candidateBodyHead.length >= 80 && existingBodyHead.length >= 80 && candidateBodyHead === existingBodyHead;
  });
}

function appendFetchedNewsItems(items, targetTotal) {
  if (!Array.isArray(items) || items.length === 0) return 0;

  let appended = 0;
  for (const item of items) {
    if (state.newsList.length >= targetTotal) break;
    if (isDuplicateNewsItem(item)) {
      console.info('중복 뉴스는 건너뜁니다:', item?.title || item?.source_url || item?.category);
      continue;
    }
    const grid = document.getElementById('news-grid');
    if (state.newsList.length === 0 && grid) {
      grid.innerHTML = '';
    }
    state.newsList.push(item);
    rememberSeenNewsItem(item);
    const newIdx = state.newsList.length - 1;
    appendNewsCard(item, newIdx);
    appended += 1;
  }

  if (appended > 0 && state.isPlaying && state.currentNewsIndex !== -1) {
    updateProgressBar(state.currentNewsIndex);
  }

  return appended;
}
function getPreferredNewsSources() {
  const mode = state.newsSourceMode || 'auto';
  if (mode === 'rss') return ['rss'];
  if (mode === 'openai') return ['rss', 'openai'];
  if (mode === 'gemini') return ['rss', 'gemini'];
  if (mode === 'groq') return ['rss'];

  const sources = ['rss'];
  if ((state.groqApiKey || '').trim()) return sources;
  if ((state.openaiApiKey || '').trim()) sources.push('openai');
  if ((state.apiKey || '').trim()) sources.push('gemini');
  return sources;
}

function getNewsSourceLabel(source) {
  if (source === 'openai') return 'OpenAI API';
  if (source === 'gemini') return 'Gemini API';
  if (source === 'groq') return 'Groq API';
  return 'Google News RSS';
}

async function fetchNewsItemsForCategory(category, count = 1, options = {}) {
  let lastError = null;
  for (const source of getPreferredNewsSources()) {
    try {
      if (source === 'openai') {
        if (!state.openaiApiKey) throw new Error('OpenAI API Key가 비어 있습니다.');
        return await fetchOpenAINewsForCategory(state.openaiApiKey, category, options.prompt || state.prompt, count, options);
      }
      if (source === 'gemini') {
        if (!state.apiKey) throw new Error('Gemini API Key가 비어 있습니다.');
        return await fetchGeminiNewsForCategory(state.apiKey, category, options.prompt || state.prompt, count, options);
      }
      return await fetchGoogleNewsRSS(category, count, options);
    } catch (err) {
      lastError = err;
      const message = err?.message || String(err);
      if (source === 'openai') state.lastOpenaiError = message;
      if (source === 'gemini') state.lastGeminiError = message;
      if (source === 'rss') state.lastRssError = message;
      console.warn(`${getNewsSourceLabel(source)} 수집 실패, 다음 방식으로 전환:`, err);
    }
  }
  throw lastError || new Error('모든 뉴스 수집 방식이 실패했습니다.');
}

function extractOpenAIOutputText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  const parts = [];
  (data?.output || []).forEach(item => {
    (item?.content || []).forEach(content => {
      if (typeof content?.text === 'string') parts.push(content.text);
    });
  });
  return parts.join('\n').trim();
}

async function fetchOpenAINewsForCategory(apiKey, category, prompt, count = 1) {
  const now = new Date();
  const kstInfo = getKstDateInfo(now);
  const detailChars = getNewsDetailTargetChars();
  const detailCharRange = getNewsDetailCharRangeText();
  const detailSentenceRange = getNewsDetailSentenceRange();
  const isLocal = checkIsLocalEnvironment();
  const targetUrl = isLocal
    ? '/api/openai/v1/responses'
    : 'https://api.openai.com/v1/responses';

  const siteFilter = getQuerySourceFilter();
  const siteRestriction = siteFilter ? ` 검색 시 반드시 다음 언론사 필터를 쿼리에 포함하고, 검색된 해당 언론사 뉴스 기사만을 대상으로 하십시오: ${siteFilter}` : '';
  const input = `오늘은 ${kstInfo.label}입니다. 한국 기준 최근 12시간 이내에 실제 보도된 ${category} 최신 뉴스 ${count}건을 찾아 JSON 배열로만 답하세요.${siteRestriction} 각 항목은 id, category, title, body, time, source_name, source_url 필드를 포함해야 합니다. body는 ${detailSentenceRange}문장, ${detailCharRange}, 약 ${detailChars}자 기준으로 작성하되 같은 내용을 반복하지 마세요. source_url은 실제 기사 원문 URL이어야 합니다. 추가 요구사항: ${prompt || '핵심을 친절하게 설명해 주세요.'}`;

  const resp = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search' }],
      input
    })
  });

  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const errJson = await resp.json();
      detail = errJson.error?.message || JSON.stringify(errJson);
    } catch (_) {}
    throw new Error(`OpenAI API 오류 ${resp.status}: ${detail}`);
  }

  const data = await resp.json();
  const rawText = extractOpenAIOutputText(data);
  if (!rawText) throw new Error('OpenAI 응답에 텍스트가 없습니다.');

  let jsonString = rawText;
  const block = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (block) jsonString = block[1].trim();
  const arrayMatch = jsonString.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) jsonString = arrayMatch[0];

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (_) {
    throw new Error('OpenAI 응답 JSON 파싱 실패');
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const normalizedItems = list.map((item, idx) => ({
    id: item.id || Date.now() + idx,
    category: item.category || category,
    title: item.title || '최신 뉴스',
    body: ensureNewsBodyLength(item.body || '', { title: item.title, source_name: item.source_name || item.sourceName, category: item.category || category, time: item.time }),
    time: item.time || `${kstInfo.month}.${kstInfo.date}`,
    source_name: item.source_name || item.sourceName || '뉴스 원문',
    source_url: item.source_url || item.sourceUrl || item.url || '',
    source_type: 'openai'
  })).filter(item => item.body && item.source_url && isDomainSelected(item.source_url) && isRecentNewsTime(item.time, now));

  return selectRandomUnseenNewsItems(normalizedItems, count);
}
async function fetchFirstNewsFast(categories, prompt, targetTotal, sessionId) {
  if (sessionId !== currentFetchSession || state.newsList.length > 0) return;
  const hasOpenAI = Boolean((state.openaiApiKey || '').trim());
  const hasGemini = Boolean((state.apiKey || '').trim());
  if (!hasOpenAI && !hasGemini) return;

  const category = categories[0];
  if (!category) return;
  state.hasFirstNewsBeenRequested = true;

  let timer;
  try {
    const request = state.newsSourceMode === 'openai' && hasOpenAI
      ? fetchOpenAINewsForCategory(state.openaiApiKey, category, prompt, 1)
      : state.newsSourceMode === 'gemini' && hasGemini
        ? fetchGeminiNewsForCategory(state.apiKey, category, prompt, 1, { fastFirst: true })
        : hasOpenAI
          ? fetchOpenAINewsForCategory(state.openaiApiKey, category, prompt, 1)
          : fetchGeminiNewsForCategory(state.apiKey, category, prompt, 1, { fastFirst: true });

    const timeout = new Promise(resolve => {
      timer = setTimeout(() => resolve([]), 9000);
    });
    const items = await Promise.race([request, timeout]);
    if (sessionId !== currentFetchSession || !Array.isArray(items) || items.length === 0) return;

    const appended = appendFetchedNewsItems(items, targetTotal);
    if (appended > 0) {
      updatePlayerStatus('첫 뉴스 준비 완료', '나머지 최신 뉴스는 백그라운드에서 계속 수집하고 있습니다.');
    }
  } catch (error) {
    console.info('10초 이내 첫 뉴스 우선 요청 실패, 백그라운드 수집을 계속합니다:', error?.message || error);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFirstTwoRssNews(categories, prompt, targetTotal, sessionId) {
  const priorityCount = Math.min(2, targetTotal);
  let attempts = 0;

  while (sessionId === currentFetchSession && state.newsList.length < priorityCount && attempts < categories.length * 3) {
    const category = categories[attempts % categories.length];
    attempts += 1;
    try {
      const items = await fetchNewsItemsForCategory(category, 1, { prompt, fastFirst: state.newsList.length === 0 });
      if (sessionId !== currentFetchSession) return;
      const appended = appendFetchedNewsItems(items, targetTotal);
      if (appended > 0) {
        updatePlayerStatus(
          state.newsList.length === 1 ? '첫 뉴스 준비 완료' : '두 번째 뉴스 준비 완료',
          state.newsList.length === 1
            ? '두 번째 최신 뉴스를 계속 검색하고 요약하고 있습니다.'
            : '나머지 최신 뉴스는 백그라운드에서 계속 수집하고 있습니다.'
        );
      }
    } catch (error) {
      state.lastRssError = error?.message || String(error);
      console.warn(`${category} 우선 뉴스 검색 실패:`, error);
    }
  }
}
async function fetchRemainingNewsByPlan(apiKey, categoryCounts, prompt, targetTotal, sessionId, attempt = 0) {
  if (sessionId !== currentFetchSession || state.newsList.length >= targetTotal) return;

  const queue = [];
  for (const [category, count] of Object.entries(categoryCounts)) {
    for (let i = 0; i < count; i++) {
      queue.push(category);
    }
  }

  if (queue.length === 0) return;
  if (attempt >= MAX_NEWS_FILL_ATTEMPTS) {
    if (sessionId === currentFetchSession && state.newsList.length === 0) {
      renderErrorMessage(`최근 ${NEWS_RECENCY_HOURS}시간 이내 조건을 만족하는 뉴스를 찾지 못했습니다. 설정에서 카테고리를 줄이거나 뉴스 로드 방식을 RSS/API 자동으로 바꿔 주세요.`);
    }
    return;
  }

  const shuffledQueue = shuffleNewsItems(queue);
  const missingCount = targetTotal - state.newsList.length;
  const workerCount = Math.min(MAX_BACKGROUND_NEWS_REQUESTS, shuffledQueue.length, Math.max(1, missingCount));

  updatePlayerStatus(
    attempt === 0 ? '실시간 뉴스 수집 중' : '뉴스 보충 검색 중',
    attempt === 0
      ? `검색되는 뉴스부터 바로 표시하고 읽어 드립니다. 나머지 ${missingCount}개 뉴스는 백그라운드에서 계속 찾는 중입니다...`
      : `부족한 ${missingCount}개 뉴스를 추가로 검색하고 있습니다...`
  );

  backgroundFetchPending += shuffledQueue.length;

  async function runWorker() {
    while (sessionId === currentFetchSession && state.newsList.length < targetTotal && shuffledQueue.length > 0) {
      const category = shuffledQueue.shift();
      try {
        const items = await fetchNewsItemsForCategory(category, 1, { prompt, fastFirst: false });
        if (sessionId !== currentFetchSession) return;

        const appended = appendFetchedNewsItems(items, targetTotal);
        if (appended > 0 && !state.isPlaying) {
          updatePlayerStatus('뉴스 준비 완료', '재생 버튼을 누르면 먼저 도착한 최신 뉴스부터 읽어 드립니다.');
          if (!ttsUnlockedByGesture) continue;
          setTimeout(() => {
            if (sessionId === currentFetchSession && state.newsList.length > 0 && !state.isPlaying) {
              playNewsAtIndex(0, true);
            }
          }, 120);
        }
      } catch (err) {
        state.lastRssError = err?.message || String(err);
        console.warn(`${category} 카테고리 뉴스 검색 실패:`, err);
      } finally {
        backgroundFetchPending = Math.max(0, backgroundFetchPending - 1);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  if (sessionId !== currentFetchSession || state.newsList.length >= targetTotal) return;

  const stillMissing = targetTotal - state.newsList.length;
  if (stillMissing > 0) {
    const remainingCats = Object.keys(categoryCounts);
    const retryPlan = {};
    remainingCats.forEach(cat => retryPlan[cat] = 0);
    for (let i = 0; i < stillMissing; i++) {
      retryPlan[remainingCats[i % remainingCats.length]]++;
    }
    await fetchRemainingNewsByPlan(apiKey, retryPlan, prompt, targetTotal, sessionId, attempt + 1);
  }
}

async function fetchNews() {
  currentFetchSession++;
  const thisSession = currentFetchSession;

  showNewsLoading();
  stopSpeech();

  state.newsList = [];
  state.currentNewsIndex = -1;
  state.hasFirstNewsBeenRequested = false;
  state.briefingPhase = (state.briefingMode === 'body_only') ? 'details' : 'headlines';
  state.lastGeminiError = '';
  state.lastOpenaiError = '';
  state.lastRssError = '';
  backgroundFetchPending = 0;
  readerApiRequestCount = 0;
  lastRenderedCategory = '';

  const selectedCategories = [...state.categories];

  if (selectedCategories.length === 0) {
    renderErrorMessage('선택한 관심사 카테고리가 없습니다. 설정에서 카테고리를 선택해 주세요.');
    return;
  }

  let requestedTotal = 5;
  const promptStyle = state.prompt.toLowerCase().trim();
  const numMatch = promptStyle.match(/(\d+)\s*(개|가지|항목|뉴스|소식|개씩)/);
  if (numMatch) {
    requestedTotal = parseInt(numMatch[1], 10);
  }
  requestedTotal = Math.max(selectedCategories.length, Math.min(20, requestedTotal));

  const categoryCounts = {};
  selectedCategories.forEach(cat => categoryCounts[cat] = 0);
  for (let i = 0; i < requestedTotal; i++) {
    const cat = selectedCategories[i % selectedCategories.length];
    categoryCounts[cat]++;
  }
  updatePlayerStatus('실시간 뉴스 수집 중', `${getNewsSourceLabel(getPreferredNewsSources()[0])}로 선택한 카테고리의 최신 뉴스를 동시에 검색하는 중입니다...`);
  const prefersRssSummary = state.newsSourceMode === 'groq'
    || (state.newsSourceMode === 'auto' && Boolean((state.groqApiKey || '').trim()));

  // Append the first RSS summary immediately, then prioritize the second card.
  const initialNewsPromise = prefersRssSummary
    ? fetchFirstTwoRssNews(selectedCategories, state.prompt, requestedTotal, thisSession)
    : Promise.resolve(void fetchFirstNewsFast(selectedCategories, state.prompt, requestedTotal, thisSession));

  initialNewsPromise.then(() => fetchRemainingNewsByPlan(state.apiKey, categoryCounts, state.prompt, requestedTotal, thisSession))
    .catch(err => {
      if (thisSession !== currentFetchSession) return;
      state.lastRssError = err?.message || String(err);
      if (state.newsList.length === 0) {
        renderErrorMessage(`최근 ${NEWS_RECENCY_HOURS}시간 이내 조건을 만족하는 뉴스를 찾지 못했습니다. 설정에서 카테고리를 줄이거나 뉴스 로드 방식을 RSS/API 자동으로 바꿔 주세요.`);
      }
    });
}

// Gemini API를 사용하여 단일 카테고리에 대한 뉴스 요약 생성 (속도 극대화, 개수 동적)
async function fetchGeminiNewsForCategory(apiKey, category, prompt, count = 1, options = {}) {
  const siteFilter = getQuerySourceFilter();
  const siteConstraint = siteFilter ? `\\n    3. **구글 실시간 검색 시 반드시 다음 언론사 필터링 연산자를 쿼리 끝에 붙여 검색하십시오: ${siteFilter}**` : '';
  // 대한민국 표준시(KST) 기준 시간 표기 생성
  const now = new Date();
  const kstInfo = getKstDateInfo(now);
  const currentLocalTimeStr = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const currentMonth = kstInfo.month;
  const currentDate = kstInfo.date;
  const detailChars = getNewsDetailTargetChars();
  const detailCharRange = getNewsDetailCharRangeText();
  const detailSentenceRange = getNewsDetailSentenceRange();

  const promptText = `
    역할: 전문 오늘의 뉴스 앵커 및 아나운서

    시간 및 검색 규정 (가장 엄격히 준수):
    현재 대한민국의 로컬 시각은 한국 표준시(KST) 기준 [ ${currentLocalTimeStr} ] 이며, 오늘은 [ ${kstInfo.label} ] 입니다.
    1. **반드시 google_search 도구를 적극 사용해 오늘 현재 시각 기준 "최근 12시간 이내"에 대한민국 메이저 언론사 등에 실제 보도된 실시간 최신 뉴스 및 사건들만 검색하여 요약 기재해야 합니다.**
    2. 구글 실시간 검색 시 \`[ ${category} ${kstInfo.label} 최신 뉴스 ]\` 또는 \`[ ${kstInfo.label} 오늘 ${category} 주요 뉴스 ]\` 와 같이 정확한 연도와 오늘 날짜를 구글 검색 쿼리에 반드시 명시하여 12시간이 지나지 않은 최신 속보만 수집하도록 강제하십시오.${siteConstraint}
    3. 과거에 이미 학습한 옛날 데이터나 가공의 기사, 혹은 12시간이 지난 과거 날짜의 뉴스는 절대로 들려주어서는 안 됩니다. 무조건 오늘 실제 발생한 시사/뉴스 검색 결과만 사용하십시오.
    4. 수집된 최신 뉴스의 정확한 보도 시각을 바탕으로 JSON의 "time" 필드를 채우십시오.
    5. **출처 검증 규정 (극도로 중요 - 절대 변조 금지)**:
       - 검색한 원본 뉴스 기사의 정확한 출처 언론사명(예: 연합뉴스, YTN 등)을 "source_name"에 정확하게 적으십시오.
       - "source_url"에는 반드시 사용자가 클릭했을 때 해당 뉴스의 내용 전체를 직접 눈으로 대조하여 검증해볼 수 있는 **그 뉴스 기사의 실제 원본 URL 전체 주소**를 기입하십시오.
       - **[경고] 기사 URL 주소(예: AKR20260713028400017 등 기사 번호나 파라미터)의 글자나 숫자를 단 하나라도 네가 임의로 지어내거나 추측해서 수정(변조)해서는 절대 안 됩니다. 네가 임의로 기사 번호를 적으면 404 페이지 오류("원하시는 페이지를 찾을 수 없습니다")가 발생합니다. 반드시 google_search 검색 결과에 실제로 표시된 그 기사의 원본 링크 URL을 철자 하나 틀리지 않고 100% 똑같이 그대로 복사-붙여넣기(Copy-and-Paste)하여 출력하십시오.**
       - 네이버 홈(naver.com), 다음 홈(daum.net), 언론사 메인 홈(yna.co.kr 등)과 같은 단순 메인 도메인 주소는 사용자가 뉴스를 검증할 수 없으므로 **절대로 기재하지 마십시오.** 상세 기사 원문 주소만 검색 결과에서 그대로 복사하여 입력해야 합니다.

    요청사항:
    사용자가 선택한 관심 분야는 [ ${category} ] 입니다.
    사용자의 추가 요구사항: "${prompt || '바쁜 아침에 핵심만 쉽게 요약해줘.'}"

    텍스트 형식 및 분량 확대 규정 (극도로 중요):
    1. 뉴스 본문("body")에는 절대로 "첫째", "둘째", "셋째", "넷째", "증시 뉴스입니다", "경제 소식입니다" 와 같은 인위적인 순서 표기 단어나 카테고리 머리말을 기재하지 마십시오.
    2. 본문("body")은 뉴스 카드로 화면에 직접 렌더링되고 그대로 낭독되므로, 아나운서가 부드럽게 읽을 수 있는 한국어 줄글 ${detailSentenceRange}문장(${detailCharRange})으로 작성하십시오. 기존보다 20% 더 풍부하게 적되 같은 사실이나 표현을 반복하지 말아야 하며, 핵심 사실과 발생 배경, 관련 수치나 관계자 반응, 시장·사회적 영향, 사용자가 알아야 할 후속 전망을 매우 구체적으로 풍성하게 포함하십시오.
    3. 중복되는 번호나 분야 소개말은 완전히 배제하고 오직 팩트 위주의 본문 내용만 기입하십시오. 단순 요약 한두 문장으로 끝내지 말고, 문장마다 새로운 정보를 담고, 앞 문장과 같은 내용을 다른 표현으로 되풀이하지 마십시오.
    4. **제목("title")은 반드시 15자 이내의 짧은 한줄 요약 헤드라인으로 작성하십시오.** 예시: "코스피 7천선 돌파", "유가 급락 비상경영". 길고 장황한 제목은 절대 금지입니다.

    이 설정에 맞춰서 신뢰성 높은 최신 오늘의 뉴스 브리핑 ${count}가지를 생성하고 JSON 배열 형식으로만 반환해줘.
    반드시 아래 JSON 스키마만 정확하게 준수하여 응답해줘. 설명 문구 없이 JSON 배열 텍스트만 출력해줘:

    [
      {
        "id": 1,
        "category": "${category}",
        "title": "15자 이내 한줄 요약 제목",
        "body": "화면에 직접 표기될 격식 있고 자연스러운 ${detailSentenceRange}문장의 줄글 뉴스 내용 (약 ${detailChars}자 분량. 핵심 사실, 배경, 구체적 수치, 파급 영향, 전망 포함. 첫째/둘째 등 기호 일절 없음. 설정된 추가 요구사항 프롬프트를 반드시 지키며 작성)",
        "time": "${currentMonth}.${currentDate} 오전 08:00",
        "source_name": "연합뉴스",
        "source_url": "검색 결과에서 복사한 실제 상세 기사 URL"
      }
    ]
  `;

  // 빠른 로드를 위해 매 카테고리마다 모델 목록 API를 조회하지 않고 검색 지원 Flash 모델을 바로 시도한다.
  const discoveredModels = options.fastFirst ? FIRST_NEWS_MODEL_CANDIDATES : FAST_NEWS_MODEL_CANDIDATES;
  console.log(`⚡ [${category}] 빠른 검색 모델 ${discoveredModels.length}개 시도:`, discoveredModels.map(m => `${m.version}/${m.name}`).join(', '));
  // ===== 2단계: 탐색된 모델로 순차적 뉴스 생성 시도 =====
  let lastError = '사용 가능한 Gemini 모델을 찾지 못했습니다.';

  for (const { name: model, version } of discoveredModels) {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{ parts: [{ text: promptText }] }]
    };

    // v1beta에서만 실시간 검색 그라운딩 시도
    if (version === 'v1beta') {
      requestBody.tools = [{ google_search: {} }];
    }

    let response;
    try {
      response = await rateLimitedFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
    } catch (netErr) {
      throw new Error(`네트워크 연결 실패: 인터넷 상태를 확인해 주세요. 상세: ${netErr.message || netErr}`);
    }

    if (!response.ok) {
      let errMsg = '';
      try {
        const errJson = await response.json();
        errMsg = errJson.error?.message || JSON.stringify(errJson);
      } catch (_) {}

      // 인증 오류만 즉시 중단 (잘못된 API 키)
      if (response.status === 401 || response.status === 403) {
        throw new Error(`API 키 오류: API 키가 유효하지 않거나 권한이 없습니다. 구글 AI Studio에서 키를 재발급 받으세요. (상세: ${errMsg || response.statusText})`);
      }



      // 검색 도구 없이도 여전히 에러라면, 다음 폴백 모델로 즉각 이동
      if (!response.ok) {
        lastError = `[${version}/${model}] 에러 코드 ${response.status} (상세: ${errMsg || response.statusText})`;
        console.warn(`모델 ${version}/${model} 사용 실패로 다음 모델 폴백...`, lastError);

        // 429 한도 초과의 경우 다음 모델 진입 전 3.5초간 안전 대기 제공 (속도 제약 완화)
        if (response.status === 429) {
          await sleep(3500);
        }
        continue;
      }
    }
    // 성공한 경우 파싱 진행
    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
      // text 파트가 없을 수도 있음 (검색 그라운딩 결과만 반환된 경우)
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        const textPart = data.candidates[0].content.parts.find(p => p.text);
        if (!textPart) {
          lastError = `모델 ${model}: 텍스트 응답 없음`;
          continue;
        }
      } else {
        lastError = `모델 ${model}: 유효한 응답 없음`;
        continue;
      }
    }

    const rawText = data.candidates[0].content.parts.find(p => p.text)?.text?.trim()
                  || data.candidates[0].content.parts[0].text?.trim();

    if (!rawText) {
      lastError = `모델 ${model}: 빈 응답`;
      continue;
    }

    let jsonString = rawText;
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
    const match = jsonString.match(jsonBlockRegex);
    if (match) jsonString = match[1].trim();

    const arrayRegex = /\[\s*\{[\s\S]*\}\s*\]/;
    const arrayMatch = jsonString.match(arrayRegex);
    if (arrayMatch) jsonString = arrayMatch[0].trim();

    try {
      let result = JSON.parse(jsonString);
      console.log(`✅ 성공: ${version}/${model} 모델로 [${category}] 뉴스 수신 완료`);

      // 단일 객체인 경우 배열화
      if (!Array.isArray(result)) {
        result = [result];
      }

      // 구글 실시간 검색 그라운딩 공식 메타데이터에서 신뢰할 수 있는 상세 기사 URL 목록 추출
      let verifiedUrls = [];
      let verifiedTitles = [];
      try {
        const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        chunks.forEach(chunk => {
          const uri = chunk.web?.uri;
          const title = chunk.web?.title;
          if (uri && isLikelyDetailedArticleUrl(uri) && !verifiedUrls.includes(uri)) {
            verifiedUrls.push(uri);
            verifiedTitles.push(title || '');
          }
        });
      } catch (e) {
        console.warn('구글 그라운딩 메타데이터 추출 실패:', e);
      }

      if (verifiedUrls.length === 0) {
        lastError = `모델 ${model}: 검색 근거가 없어 최신 뉴스 여부를 검증할 수 없음`;
        continue;
      }

      // 출처 정보 필드명 강제 보정 및 안전화 조치 (품질 강화)
      const normalizedItems = result.map((item, idx) => {
        let sourceName = item.source_name || item.sourceName || item.source || item.origin || '';
        let sourceUrl = item.source_url || item.sourceUrl || item.url || item.link || '';

        // 모델이 지어낸 가상/예제 URL 또는 환각 URL 감지 및 보정
        const isBrokenOrFakeUrl = !sourceUrl ||
                                  sourceUrl.includes('AKR20260713000100001') ||
                                  sourceUrl.includes('AKR2023') ||
                                  sourceUrl.includes('example.com') ||
                                  !sourceUrl.startsWith('http');

        if ((isBrokenOrFakeUrl || !isLikelyDetailedArticleUrl(sourceUrl)) && verifiedUrls.length > 0) {
          // 구글 검색 실제 출처에서 실존하는 전체 URL 주소를 가져와 강제 덮어쓰기
          sourceUrl = verifiedUrls[idx % verifiedUrls.length];
        }

        // 출처 언론사명도 비어있거나 기본값인 경우 보정
        if (!sourceName.trim() || sourceName.includes('출처')) {
          if (sourceUrl.includes('yna.co.kr')) sourceName = '연합뉴스';
          else if (sourceUrl.includes('ytn.co.kr')) sourceName = 'YTN';
          else if (sourceUrl.includes('mk.co.kr')) sourceName = '매일경제';
          else if (sourceUrl.includes('hankyung.com')) sourceName = '한국경제';
          else if (sourceUrl.includes('naver.com')) sourceName = '네이버 뉴스';
          else if (sourceUrl.includes('daum.net')) sourceName = '다음 뉴스';
          else if (sourceUrl.includes('zdnet.co.kr')) sourceName = '지디넷코리아';
          else if (sourceUrl.includes('sbs.co.kr')) sourceName = 'SBS';
          else if (sourceUrl.includes('kbs.co.kr')) sourceName = 'KBS';
          else if (sourceUrl.includes('mbc.co.kr')) sourceName = 'MBC';
          else if (verifiedTitles[idx % verifiedTitles.length]) {
            const titleText = verifiedTitles[idx % verifiedTitles.length];
            const matchName = titleText.match(/\[(.*?)\]/) || titleText.match(/-\s*(.*?)$/);
            sourceName = matchName ? matchName[1].trim() : '뉴스 원문';
          } else {
            sourceName = sourceName || '뉴스 원문';
          }
        }

        const isRecent = isRecentNewsTime(item.time, now);
        if (!isRecent) {
          item.isExpired = true;
        }

        return {
          id: item.id || 1,
          category: item.category || category,
          title: item.title || '최신 속보 브리핑',
          body: ensureNewsBodyLength(item.body || '', { title: item.title, source_name: sourceName, category: item.category || category, time: item.time }),
          time: item.time,
          source_name: sourceName.trim(),
          source_url: sourceUrl.trim(),
          isExpired: item.isExpired || false,
          source_type: 'gemini'
        };
      });

      const verifiedItems = normalizedItems.filter(item => !item.isExpired && isLikelyDetailedArticleUrl(item.source_url) && isDomainSelected(item.source_url) && item.body && item.body.trim());
      if (verifiedItems.length === 0) {
        lastError = `모델 ${model}: 최근 12시간 이내의 검증된 실시간 뉴스가 없거나 필터링됨`;
        continue;
      }

      return selectRandomUnseenNewsItems(verifiedItems, count);
    } catch (parseErr) {
      console.error(`파싱 실패 (${model}):`, rawText);
      lastError = `JSON 파싱 실패 (${model})`;
      continue;
    }
  }

  // 모든 시도 실패
  throw new Error(`[${category}] 모든 Gemini 모델 시도 실패. 마지막 오류: ${lastError}`);
}

// 임시 샘플(Mock) 뉴스 노출 여부에 따라 상단 경고 배너를 업데이트하는 함수
function updateMockWarningBanner() {
  const banner = document.getElementById('mock-warning-banner');
  if (banner) {
    banner.remove();
  }
  updateNewsSourceModeDisplay();
}

// 뉴스 본문에서 "첫째, 둘째" 및 "[카테고리] 뉴스입니다" 같은 불필요한 단어를 정제하는 헬퍼 함수
function decodeHtmlEntities(text) {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

function replaceAmpersand(text) {
  if (!text) return '';
  return text.replace(/&/g, (match, offset, string) => {
    let prevChar = '';
    for (let i = offset - 1; i >= 0; i--) {
      const char = string.charAt(i);
      if (!/\s/.test(char)) {
        prevChar = char;
        break;
      }
    }
    if (!prevChar) return '와';
    const code = prevChar.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const batchim = (code - 0xAC00) % 28;
      return batchim > 0 ? '과' : '와';
    }
    const lastCharLower = prevChar.toLowerCase();
    if (/[013678lmnr]/.test(lastCharLower)) {
      return '과';
    }
    return '와';
  });
}

function cleanNewsBodyText(body, category, sourceName = '') {
  let cleaned = decodeHtmlEntities(body);

  if (category) {
    const categoryIntroRegex = new RegExp(`^${category}\\s*(뉴스|소식)입니다\\.?\\s*`, 'i');
    cleaned = cleaned.replace(categoryIntroRegex, '');
  }

  // 일반적인 "OO 뉴스/소식입니다" 제거
  cleaned = cleaned.replace(/^[가-힣]{2,4}\s*(뉴스|소식)입니다\.?\s*/i, '');

  // 시작 부분의 첫째, 둘째 제거
  cleaned = cleaned.replace(/^(첫째|둘째|셋째|넷째|다섯째),?\s*/g, '');

  // 문장 중간의 ". 둘째, " 등 제거
  cleaned = cleaned.replace(/([.?!]\s+)(첫째|둘째|셋째|넷째|다섯째),?\s*/g, '$1');

  // RSS 요약 끝에 붙는 출처/도메인 꼬리 제거: "... 나섰다. 4jhinews.com" 같은 형태
  cleaned = cleaned.replace(/\s*(?:[-–—|·•]\s*)?(?:출처\s*[:：]?\s*)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\.[a-z]{2,})?\s*$/i, '');
  cleaned = cleaned.replace(/\s*(?:[-–—|·•]\s*)?(?:뉴스|연합뉴스|뉴시스|네이트|구글뉴스|Google\s*News)\s*$/i, '');
  if (sourceName) {
    const escapedSource = String(sourceName).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escapedSource) {
      cleaned = cleaned.replace(new RegExp(`\\s*(?:[-–—|·•]\\s*)?${escapedSource}\\s*$`, 'i'), '');
    }
  }
  // "[ ]", "( )", "< >" 안의 내용 전체 삭제 (한글/영어 모두 포함)
  cleaned = cleaned.replace(/\s*\[[^\]]*\]/g, '');
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '');
  cleaned = cleaned.replace(/\s*<[^>]*>/g, '');

  // 연월일 및 시각 날짜 패턴 제거 (예: 2026-07-17 09:50 송고, 2026년07월17일 09시50 등)
  cleaned = cleaned.replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}[:시]\d{1,2}(?:\s*분)?(?:\s*[가-힣]{2,4})?/g, ' ');
  cleaned = cleaned.replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일\s*(?:\s*\d{1,2}\s*시\s*\d{1,2}\s*분?)?/g, ' ');
  cleaned = cleaned.replace(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\.?\b/g, ' ');

  // 이메일 주소 제거 (예: dwise@yna.co.kr -> 삭제)
  cleaned = cleaned.replace(/\s*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\s*/g, ' ');

  // 기자 이름 및 "기자" 단어 제거 (예: 김민지 기자, 홍길동 기자 =, 취재기자 등)
  cleaned = cleaned.replace(/[가-힣]{2,4}\s*기자(?:\s*=)?\s*/g, ' ');

  // "=" 특수 문자 제거 (예: = -> 삭제)
  cleaned = cleaned.replace(/=/g, ' ');

  // "&" 문자를 앞 단어의 받침 여부에 따라 "와" 또는 "과"로 대체
  cleaned = replaceAmpersand(cleaned);

  // 공백 정규화
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.trim();
}

// 로딩 화면 그리기
function showNewsLoading() {
  const banner = document.getElementById('mock-warning-banner');
  if (banner) banner.remove();
  const grid = document.getElementById('news-grid');
  grid.innerHTML = `
    <!-- 뉴스 로딩 상태 안내 카드 -->
    <div class="news-card loading-status-card" style="text-align: center; padding: 32px; border-color: var(--glass-border-focus); margin-bottom: 8px; animation: fadeIn 0.4s ease;">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 36px; color: var(--primary); margin-bottom: 16px;"></i>
      <h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
        최신 뉴스를 불러옵니다. 잠시만 기다려 주세요.
      </h3>
      <p style="font-size: 13px; color: var(--text-muted);">
        실시간 구글 검색을 연동하여 정확한 팩트 기반의 맞춤 오늘의 뉴스를 정밀 요약 중입니다.
      </p>
    </div>

    <div class="news-skeleton">
      <div class="skeleton-title"></div>
      <div class="skeleton-content"></div>
      <div class="skeleton-content"></div>
      <div class="skeleton-footer"></div>
    </div>
  `;
}

// 에러 화면
function renderErrorMessage(message = '') {
  const grid = document.getElementById('news-grid');
  const adviceList = getNewsErrorAdvice(message);
  const errorInfo = message ? `<p style="color: var(--accent); font-size: 13px; margin-top: 12px; font-weight: 600; line-height: 1.6; word-break: break-word;">상세 원인: ${message}</p>` : '';
  const adviceInfo = adviceList.length > 0 ? `
    <div style="text-align: left; max-width: 760px; margin: 16px auto 0; color: var(--text-muted); font-size: 13px; line-height: 1.7;">
      ${adviceList.map(item => `<p style="margin: 6px 0;">• ${item}</p>`).join('')}
    </div>
  ` : '';
  grid.innerHTML = `
    <div class="news-card" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
      <i class="fa-solid fa-triangle-exclamation" style="font-size: 40px; color: var(--accent); margin-bottom: 16px;"></i>
      <h3 style="margin-bottom: 8px;">뉴스를 가져오지 못했습니다</h3>
      <p style="color: var(--text-muted); font-size: 13px; line-height: 1.6;">API 키, 요청 한도, 모바일 네트워크 상태 중 하나가 원인일 수 있습니다. 아래 상세 원인과 점검 항목을 확인해 주세요.</p>
      ${errorInfo}
      ${adviceInfo}
      <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 16px;">새로고침</button>
    </div>
  `;
}

// 개별 뉴스 카드를 하단에 동적으로 덧붙이는 함수 (스트리밍 점진 로딩의 핵심)
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSafeNewsUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch (_) {
    return '';
  }
}
function appendNewsCard(news, index) {
  const grid = document.getElementById('news-grid');
  if (!grid) return;

  // 이전 카테고리와 다르면 그룹 헤더 추가 (박스 밖 왼쪽 위)
  if (news.category !== lastRenderedCategory) {
    const groupHeader = document.createElement('div');
    groupHeader.className = 'category-group-header';
    groupHeader.innerHTML = `
      <span class="category-group-title ${news.category}">${news.category}</span>
      <span class="category-group-line"></span>
    `;
    grid.appendChild(groupHeader);
    lastRenderedCategory = news.category;
  }

  const safeUrl = getSafeNewsUrl(news.source_url);
  const safeSourceHomeUrl = getSafeNewsUrl(news.source_home_url);
  const sourceName = escapeHtml(news.source_name || '뉴스 원문');
  const articleHost = safeUrl ? new URL(safeUrl).hostname.replace(/^www\./, '') : '';
  const displayHostUrl = articleHost === 'news.google.com' && safeSourceHomeUrl ? safeSourceHomeUrl : safeUrl;
  const sourceHost = displayHostUrl ? escapeHtml(new URL(displayHostUrl).hostname.replace(/^www\./, '')) : '';
  const sourceHtml = safeUrl
    ? `<a class="news-source-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(safeUrl)}">${sourceName}${sourceHost ? ` (${sourceHost})` : ''}</a>`
    : `<span class="news-source-text">${sourceName}</span>`;
  const displayTitle = cleanNewsBodyText(news.title, news.category, news.source_name);
  const displayBody = cleanNewsBodyText(news.body, news.category, news.source_name);
  const shouldShowBody = (state.briefingMode === 'body_only') || (displayBody && normalizeNewsCompareText(displayBody) !== normalizeNewsCompareText(displayTitle));
  
  let initialDisplay = 'none';
  let initialOpacity = '0';
  if (state.briefingMode === 'body_only') {
    initialDisplay = 'block';
    initialOpacity = '1';
  }

  const bodyHtml = shouldShowBody
    ? `<p class="card-body" id="card-body-${index}" style="display: ${initialDisplay}; opacity: ${initialOpacity};">${escapeHtml(displayBody)}</p>`
    : '';

  const card = document.createElement('article');
  card.className = 'news-card';
  card.id = `news-card-${index}`;
  card.innerHTML = `
    <div>
      <div class="card-title-row" style="display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 12px;">
        <h2 class="card-title" style="margin: 0; flex: 1;">${escapeHtml(displayTitle)}</h2>
        <div class="card-title-meta" style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
          <span class="card-time" style="font-size: 12px; color: var(--text-muted); font-weight: 500;">${escapeHtml(news.time)}</span>
          <button class="btn-card-listen" data-index="${index}" style="margin: 0;">
            <i class="fa-solid fa-volume-high"></i>
          </button>
        </div>
      </div>
      ${bodyHtml}
      <div class="card-source">출처: ${sourceHtml}</div>
    </div>
  `;
  grid.appendChild(card);

  // 카드 클릭 시 본문 토글 (모바일 편의성 향상)
  card.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target.closest('button') || e.target.closest('.btn-card-listen')) {
      return;
    }
    toggleCardBody(index);
  });

  // 개별 듣기 버튼 즉시 바인딩
  const btn = card.querySelector('.btn-card-listen');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'));
      if (state.briefingMode === 'headline_only') {
        state.briefingPhase = 'headlines';
      } else {
        state.briefingPhase = 'details';
      }
      playNewsAtIndex(idx);
    });
  }
  updateMockWarningBanner();
}

// 화면에 뉴스 카드 배치 (초기화 및 빈 상태용)
function renderNewsList(list) {

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="news-card" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
        <i class="fa-solid fa-folder-open" style="font-size: 40px; color: var(--text-muted); margin-bottom: 16px;"></i>
        <h3>표시할 뉴스가 없습니다</h3>
        <p style="color: var(--text-muted); font-size: 13px;">설정에서 더 많은 관심 카테고리를 선택해 보세요.</p>
      </div>
    `;
    return;
  }

  list.forEach((news, index) => {
    appendNewsCard(news, index);
  });
  updateMockWarningBanner();
}

// ====================================================
// 5. TTS 음성 합성 및 플레이어 제어 로직
// ====================================================
function togglePlayPause() {
  if (state.newsList.length === 0) return;

  if (state.isPlaying) {
    if (state.isPaused) {
      // 일시정지 해제
      synth.resume();
      state.isPaused = false;
      updatePlayerControlsUI(true, false);
      
      requestWakeLock();
      startSilentAudioHack();
    } else {
      // 일시정지 실행
      synth.pause();
      state.isPaused = true;
      updatePlayerControlsUI(true, true);
      
      releaseWakeLock();
      stopSilentAudioHack();
    }
  } else {
    // 처음부터 재생 시작 (인트로 활성화)
    state.briefingPhase = (state.briefingMode === 'body_only') ? 'details' : 'headlines';
    state.hasSpokenIntro = false;
    playNewsAtIndex(0, true);
  }
}

function continueWhenNextNewsArrives(index) {
  if (!state.isPlaying || state.isPaused) return;

  if (index + 1 < state.newsList.length) {
    playNewsAtIndex(index + 1);
    return;
  }

  if (backgroundFetchPending > 0) {
    updatePlayerStatus('다음 뉴스 준비 중', '나머지 뉴스를 불러오는 중입니다. 잠시 후 이어서 읽습니다...');
    setTimeout(() => continueWhenNextNewsArrives(index), 900);
    return;
  }

  // 더 이상 재생할 뉴스가 없을 때
  if (state.briefingMode === 'headlines_then_body' && state.briefingPhase === 'headlines') {
    updatePlayerStatus('상세 브리핑 준비 중', '잠시 후 각 뉴스의 상세 내용을 전해드립니다...');
    
    // 헤드라인 종료 후 본문 상세 브리핑 시작 전 3초 대기 (20초 이하 규정)
    setTimeout(() => {
      if (!state.isPlaying || state.isPaused) return;

      state.briefingPhase = 'details';
      state.hasSpokenIntro = false;
      
      // 과도기 인트로 낭독
      const transitionUtterance = new SpeechSynthesisUtterance("이어서 각 뉴스의 상세 내용을 전해드립니다.");
      const selectedVoice = voices.find(v => v.name === state.voiceName);
      if (selectedVoice) {
        transitionUtterance.voice = selectedVoice;
      }
      transitionUtterance.rate = state.speed;
      transitionUtterance.pitch = 1.0;
      
      transitionUtterance.onend = () => {
        setTimeout(() => {
          if (state.isPlaying && !state.isPaused) {
            playNewsAtIndex(0);
          }
        }, 100);
      };
      
      transitionUtterance.onerror = () => {
        if (state.isPlaying && !state.isPaused) {
          playNewsAtIndex(0);
        }
      };
      
      currentUtterance = transitionUtterance;
      synth.speak(transitionUtterance);
    }, 3000);
  } else {
    stopSpeech();
    updatePlayerStatus('낭독이 모두 끝났습니다', '오늘도 활기찬 아침 보내세요!');
  }
}
// 특정 뉴스 낭독 시작
function playNewsAtIndex(index, isPlaylistStart = false) {
  if (index < 0 || index >= state.newsList.length) {
    stopSpeech();
    return;
  }

  // 기존 진행 중인 음성 삭제
  stopSpeech(false); // UI 초기화 방지를 위해 flag 전달

  state.isPlaying = true;
  state.isPaused = false;
  state.currentNewsIndex = index;

  // 모바일 환경 최적화 기기 잠금 방지 및 백그라운드 활성 킵
  requestWakeLock();
  startSilentAudioHack();

  const news = state.newsList[index];

  // 낭독 텍스트 구성 (인트로 및 분야/제목 단어 제거)
  let speakText = '';
  if (index === 0 && !state.hasSpokenIntro) {
    const today = new Date();
    const month = today.getMonth() + 1;
    const date = today.getDate();
    if (state.briefingMode === 'headline_only') {
      speakText += `${month}월 ${date}일 헤드라인뉴스입니다. `;
    } else if (state.briefingMode === 'body_only') {
      speakText += `${month}월 ${date}일 오늘 뉴스 상세 브리핑을 시작하겠습니다. `;
    } else {
      // headlines_then_body
      if (state.briefingPhase === 'headlines') {
        speakText += `${month}월 ${date}일 헤드라인뉴스입니다. `;
      } else {
        speakText += `${month}월 ${date}일 오늘 뉴스 상세 브리핑을 시작하겠습니다. `;
      }
    }
    state.hasSpokenIntro = true;
  }

  // 직전 카드와 동일 카테고리 여부 검사
  const isSameCategory = index > 0 && state.newsList[index - 1].category === news.category;

  // 본문 가공: 텍스트 클리너를 적용하여 "첫째, 둘째, 증시 뉴스입니다" 등 군더더기 전면 삭제
  const processedTitle = cleanNewsBodyText(news.title, news.category, news.source_name);
  const processedBody = cleanNewsBodyText(news.body, news.category, news.source_name);
  const shouldReadBody = (state.briefingMode === 'body_only') || (processedBody && normalizeNewsCompareText(processedBody) !== normalizeNewsCompareText(processedTitle));

  // 1. 카테고리가 최초로 시작할 때만 카테고리 정보 안내 (헤드라인 페이즈는 생략)
  if (!isSameCategory && state.briefingPhase !== 'headlines') {
    speakText += `${news.category} 소식입니다. `;
  }

  // 2. 제목/본문 추가 (헤드라인 페이즈는 제목만, 상세 페이즈는 본문만 낭독)
  if (state.briefingPhase === 'headlines') {
    speakText += processedTitle;
  } else {
    const bodyEl = document.getElementById(`card-body-${index}`);
    if (bodyEl) {
      bodyEl.style.display = 'block';
      bodyEl.offsetHeight; // Reflow
      bodyEl.style.opacity = '1';
    }
    if (shouldReadBody) {
      speakText += processedBody;
    } else {
      speakText += processedTitle;
    }
  }

  currentUtterance = new SpeechSynthesisUtterance(speakText);

  // 음성 설정 적용
  const selectedVoice = voices.find(v => v.name === state.voiceName);
  if (selectedVoice) {
    currentUtterance.voice = selectedVoice;
  }
  currentUtterance.rate = state.speed;
  currentUtterance.pitch = 1.0;

  // 이벤트 정의
  currentUtterance.onstart = () => {
    highlightReadingCard(index);
    updatePlayerStatus(news.title, `[${news.category}] 뉴스를 읽어드리는 중입니다...`);
    updatePlayerControlsUI(true, false);
    updateProgressBar(index);
  };

  currentUtterance.onend = () => {
    // 낭독이 끝나면 다음 뉴스로 자동 이동
    if (state.isPlaying && !state.isPaused) {
      if (index + 1 < state.newsList.length) {
        playNewsAtIndex(index + 1);
      } else {
        continueWhenNextNewsArrives(index);
      }
    }
  };

  currentUtterance.onerror = (e) => {
    console.error('SpeechSynthesisUtterance error:', e);
    // iOS/Safari 등 브라우저 정책상 제스처 없이 오디오가 재생 차단되었을 때 등에 대처
    if (e.error !== 'interrupted') {
      stopSpeech();
    }
  };

  // 낭독 개시
  synth.speak(currentUtterance);
}

// 낭독 정지
function hideAllCardBodies() {
  document.querySelectorAll('.card-body').forEach(bodyEl => {
    bodyEl.style.opacity = '0';
    bodyEl.style.display = 'none';
  });
}

function showAllCardBodies() {
  document.querySelectorAll('.card-body').forEach(bodyEl => {
    bodyEl.style.display = 'block';
    bodyEl.style.opacity = '1';
  });
}

function toggleCardBody(index) {
  const bodyEl = document.getElementById(`card-body-${index}`);
  if (bodyEl) {
    if (bodyEl.style.display === 'none') {
      bodyEl.style.display = 'block';
      bodyEl.offsetHeight; // Reflow
      bodyEl.style.opacity = '1';
    } else {
      bodyEl.style.display = 'none';
      bodyEl.style.opacity = '0';
    }
  }
}


function stopSpeech(resetUI = true) {
  synth.cancel();

  if (resetUI) {
    state.isPlaying = false;
    state.isPaused = false;
    state.currentNewsIndex = -1;
    state.briefingPhase = (state.briefingMode === 'body_only') ? 'details' : 'headlines';

    // UI 원복
    removeHighlightFromCards();
    if (state.briefingMode !== 'body_only') {
      hideAllCardBodies();
    } else {
      showAllCardBodies();
    }
    updatePlayerControlsUI(false, false);
    
    // 모바일 환경 최적화 기기 잠금 방지 해제 및 백그라운드 해제
    releaseWakeLock();
    stopSilentAudioHack();
    updatePlayerStatus('낭독 중지됨', '재생 버튼을 누르면 첫 뉴스부터 재생합니다.');
    document.getElementById('player-progress').style.width = '0%';
  }
}

// 다음 뉴스 이동
function playNextNews() {
  if (state.newsList.length === 0) return;
  const nextIdx = state.currentNewsIndex + 1;
  if (nextIdx < state.newsList.length) {
    playNewsAtIndex(nextIdx);
  } else {
    if (state.briefingMode === 'headlines_then_body' && state.briefingPhase === 'headlines') {
      state.briefingPhase = 'details';
      state.hasSpokenIntro = false;
      playNewsAtIndex(0);
    } else {
      alert('마지막 뉴스입니다.');
    }
  }
}

// 이전 뉴스 이동
function playPrevNews() {
  if (state.newsList.length === 0) return;
  const prevIdx = state.currentNewsIndex - 1;
  if (prevIdx >= 0) {
    playNewsAtIndex(prevIdx);
  } else {
    if (state.briefingMode === 'headlines_then_body' && state.briefingPhase === 'details') {
      state.briefingPhase = 'headlines';
      state.hasSpokenIntro = false;
      playNewsAtIndex(state.newsList.length - 1);
    } else {
      alert('첫 번째 뉴스입니다.');
    }
  }
}

// 읽고 있는 뉴스 카드 디자인 강조 및 스크롤
function highlightReadingCard(index) {
  removeHighlightFromCards();

  const card = document.getElementById(`news-card-${index}`);
  if (card) {
    card.classList.add('reading');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function removeHighlightFromCards() {
  document.querySelectorAll('.news-card').forEach(card => {
    card.classList.remove('reading');
  });
}

// 플레이어 컨트롤 영역 아이콘 등 UI 상태 변경
function updatePlayerControlsUI(playing, paused) {
  const playPauseBtn = document.getElementById('btn-play-pause');
  const speechIcon = document.getElementById('speech-icon');
  const visualizer = document.getElementById('visualizer');

  if (playing && !paused) {
    playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    speechIcon.classList.add('playing');
    visualizer.classList.add('active');
  } else {
    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    speechIcon.classList.remove('playing');
    visualizer.classList.remove('active');
  }
}

// 재생 프로그레스 진행률 바 업데이트
function updateProgressBar(index) {
  const total = state.newsList.length;
  if (total === 0) return;
  const progressPercent = ((index + 1) / total) * 100;
  document.getElementById('player-progress').style.width = `${progressPercent}%`;
}

// 플레이어 안내 텍스트 출력
function updatePlayerStatus(title, desc) {
  const titleEl = document.getElementById('current-reading-title');
  const descEl = document.getElementById('current-reading-desc');
  if (titleEl) titleEl.innerText = title;
  if (descEl) descEl.innerText = desc;
}

// ====================================================
// 6. PWA 서비스 워커 등록 & 네트워크 핸들링
// ====================================================
// 모바일 기기 화면 꺼짐 방지 (Wake Lock API)
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Screen Wake Lock acquired.');
    }
  } catch (err) {
    console.warn('Wake Lock request failed:', err.message);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().then(() => {
      wakeLock = null;
      console.log('Screen Wake Lock released.');
    });
  }
}

// 모바일 백그라운드 자바스크립트 수면 차단용 무음 오디오 활성화
function startSilentAudioHack() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (!silentAudioInterval) {
      silentAudioInterval = setInterval(() => {
        if (audioCtx && audioCtx.state === 'running') {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          gain.gain.setValueAtTime(0.0001, audioCtx.currentTime); // 무음에 가까운 볼륨
          osc.start();
          osc.stop(audioCtx.currentTime + 0.1);
        }
      }, 1000);
      console.log('Mobile background audio hack started.');
    }
  } catch (e) {
    console.warn('Silent audio hack failed:', e);
  }
}

function stopSilentAudioHack() {
  if (silentAudioInterval) {
    clearInterval(silentAudioInterval);
    silentAudioInterval = null;
  }
  if (audioCtx && audioCtx.state !== 'closed') {
    audioCtx.close().then(() => {
      audioCtx = null;
    });
  }
  console.log('Mobile background audio hack stopped.');
}

// 모바일 브라우저 오디오 오토플레이 제한 잠금 해제
function unlockTtsOnMobile() {
  ttsUnlockedByGesture = true;
  if (window.speechSynthesis) {
    const silentUtterance = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(silentUtterance);
    console.log('Mobile TTS unlocked via user gesture.');
  }
  document.removeEventListener('click', unlockTtsOnMobile);
  document.removeEventListener('touchstart', unlockTtsOnMobile);

  if (state.shouldAutoplayOnGesture && state.newsList.length > 0 && !state.isPlaying) {
    state.shouldAutoplayOnGesture = false;
    playNewsAtIndex(0, true);
  }
}
document.addEventListener('click', unlockTtsOnMobile);
document.addEventListener('touchstart', unlockTtsOnMobile);

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=20260718_v64')
        .then((registration) => {
          console.log('서비스 워커가 성공적으로 등록되었습니다. Scope:', registration.scope);

          // 서비스 워커 업데이트가 발견되었을 때 감지
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('새로운 업데이트가 가능합니다. 페이지를 새로고침하세요.');
                }
              };
            }
          };
        })
        .catch((error) => {
          console.error('서비스 워커 등록 실패:', error);
        });
    });
  }

  // 네트워크 온라인/오프라인 감지
  window.addEventListener('online', () => {
    document.getElementById('offline-badge').classList.add('hidden');
  });
  window.addEventListener('offline', () => {
    document.getElementById('offline-badge').classList.remove('hidden');
  });

  if (!navigator.onLine) {
    document.getElementById('offline-badge').classList.remove('hidden');
  }
}

// PWA 설치 배너 흐름
let deferredPrompt;
function initInstallPrompt() {
  const installBanner = document.getElementById('install-banner');
  const btnInstall = document.getElementById('btn-install');
  const btnCloseBanner = document.getElementById('btn-close-banner');

  window.addEventListener('beforeinstallprompt', (e) => {
    // 브라우저 기본 설치 안내 창 차단
    e.preventDefault();
    deferredPrompt = e;

    // 로컬 스토리지 상의 배너 닫기 유무 파악
    const bannerClosed = localStorage.getItem('install_banner_closed');
    if (!bannerClosed) {
      installBanner.classList.remove('hidden');
    }
  });

  btnInstall.addEventListener('click', () => {
    if (!deferredPrompt) return;

    installBanner.classList.add('hidden');
    deferredPrompt.prompt();

    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('사용자가 앱 설치를 수락했습니다.');
      } else {
        console.log('사용자가 앱 설치를 취소했습니다.');
      }
      deferredPrompt = null;
    });
  });

  btnCloseBanner.addEventListener('click', () => {
    installBanner.classList.add('hidden');
    // 사용자가 한 번 닫으면 7일 동안 보이지 않도록 쿠키 대용 로직 설정
    localStorage.setItem('install_banner_closed', Date.now().toString());
  });

  // 앱이 성공적으로 설치되었을 때
  window.addEventListener('appinstalled', () => {
    console.log('애플리케이션이 성공적으로 설치되었습니다.');
    installBanner.classList.add('hidden');
    deferredPrompt = null;
  });
}
