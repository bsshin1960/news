// ====================================================
// 1. 상태 및 상수 정의
// ====================================================
let currentFetchSession = 0;
let lastRenderedCategory = '';

let state = {
  categories: ['정치', '경제', '증시', '과학', '날씨', '사회', '스포츠', '문화', 'AI뉴스', '건강', '연예', '산업'],
  prompt: '',
  apiKey: '',
  voiceName: '',
  speed: 1.0,
  newsList: [],
  currentNewsIndex: -1,
  isPlaying: false,
  isPaused: false,
  hasSpokenIntro: false
};

// 모의 뉴스 데이터 템플릿 (API 키 미제공 시 관심사에 따라 필터링되어 노출됨)
const MOCK_NEWS_TEMPLATES = [
  {
    id: 1,
    category: '정치',
    title: '정부, 저출생 극복을 위한 주거 및 양육 특별대책 발표',
    body: '정부가 저출생 위기 극복을 위해 신혼부부 및 다자녀 가구를 대상으로 주택 청약 기준을 대폭 완화하고, 영유아 수당 지급 기간을 확대하는 특별 정책을 발표했습니다. 이번 정책은 실질적인 가구 부담 경감을 목표로 하고 있습니다.',
    time: '오전 07:15',
    source_name: '연합뉴스',
    source_url: 'https://www.yna.co.kr/view/AKR20260713000100001?section=politics/all'
  },
  {
    id: 2,
    category: '경제',
    title: '글로벌 유가 하락 압력 속 국내 정유업계 수익성 방어 비상',
    body: '글로벌 수요 둔화 우려로 원유 가격이 배럴당 70달러선 아래로 떨어지면서 국내 정유 및 화학 대기업들이 긴급 비상 경영 회의를 소집했습니다. 환율 변동과 결합되어 하반기 마진 확보에 빨간불이 켜진 상황입니다.',
    time: '오전 07:30',
    source_name: '매일경제',
    source_url: 'https://www.mk.co.kr/news/economy/view/2026/07/130123'
  },
  {
    id: 3,
    category: '증시',
    title: '코스피, 반도체 및 초지능 부문 초강세로 사상 최초 7,000선 돌파 및 안착',
    body: '글로벌 초전도 반도체와 지능형 AI 로봇 수주 랠리에 힘입어 코스피 지수가 역사상 처음으로 7,000선을 가뿐히 돌파했습니다. 외국인과 기관의 폭발적인 매수세 속에 증시는 연일 사상 최고치 신기록을 경신하고 있습니다.',
    time: '오전 08:00',
    source_name: '한국경제',
    source_url: 'https://www.hankyung.com/finance/article/202607139999a'
  },
  {
    id: 4,
    category: '과학',
    title: '한국 연구진, 차세대 초전도체 후보 물질 발견해 학계 이목 집중',
    body: '국내 대학 연구소와 국책 연구기관 공동 연구팀이 상온 극저온 경계 영역에서 강한 반자성 효과를 보이는 신소재 합성 기술을 개발했습니다. 권위 있는 과학 저널 네이처에 게재 검토 중이며 향후 에너지 송전 혁신이 기대됩니다.',
    time: '오전 08:10',
    source_name: '동아사이언스',
    source_url: 'https://www.dongascience.com/news.php?key=202607138888'
  },
  {
    id: 5,
    category: '날씨',
    title: '기상청, 오늘 밤부터 전국 강풍 동반한 기습 폭설 및 한파 주의보령 발령',
    body: '기상청은 오늘 자정부터 중부 지방을 중심으로 순간 시속 70킬로미터 이상의 돌풍과 함께 최대 15센티미터 이상의 폭설이 내릴 것으로 예보했습니다. 내일 출근길 전국적인 빙판길 교통안전과 대중교통 이용을 신신당부했습니다.',
    time: '오전 08:15',
    source_name: '기상청 날씨누리',
    source_url: 'https://www.weather.go.kr/w/wnuri-new/html/cop/bbs/selectBoardArticle.do?bbsId=BBS_NEWS'
  },
  {
    id: 6,
    category: '사회',
    title: '경찰청, 지능형 보이스피싱 금융 범죄 차단을 위한 AI 실시간 탐지 기법 전격 도입',
    body: '경찰청은 시중 은행과 손잡고 통화 중 보이스피싱 의심 키워드와 목소리 톤의 이상 징후를 실시간 감지하여 즉시 이체를 차단하는 차세대 AI 차단 시스템을 전국 지점에 시범 적용한다고 밝혔습니다.',
    time: '오전 08:20',
    source_name: 'YTN',
    source_url: 'https://www.ytn.co.kr/_ln/0103_202607131122334455'
  },
  {
    id: 7,
    category: '스포츠',
    title: '한국 골프 대표팀, 세계 주니어 선수권에서 극적인 대역전 우승 쾌거',
    body: '한국 청소년 골프 국가대표팀이 마지막 라운드에서 침착한 버디 퍼팅 랠리를 보이며 강력한 경쟁 후보인 미국과 일본을 2타 차로 따돌리고 사상 최초 종합 단체전 금메달을 목에 걸었습니다.',
    time: '오전 08:30',
    source_name: 'SBS 스포츠',
    source_url: 'https://sports.sbs.co.kr/news?id=SP1000020260713'
  },
  {
    id: 8,
    category: '문화',
    title: '국립 미술관, 초실감 VR 기술 활용한 가상 고궁 유물 특별 기획전 개최',
    body: '문화재청과 미술관은 최첨단 레이저 스캐닝 가상현실 렌더러 기술을 활용해 조선 시대 궁궐 내부의 왕실 생활 유물을 오감으로 실감 나게 탐험할 수 있는 신규 디지털 헤리티지 전시회를 일반에 무료 개방했습니다.',
    time: '오전 08:40',
    source_name: '문화일보',
    source_url: 'https://www.munhwa.com/news/view.html?no=20260713010399'
  },
  {
    id: 9,
    category: 'AI뉴스',
    title: '국내 AI 연구소, 인간의 복합적 감정을 이해하는 감성 대화 지능 상용화 성공',
    body: '국내 연구진이 멀티모달 인식 알고리즘을 고도화하여 사용자의 미세한 얼굴 근육 떨림과 음성 파장을 실시간 판별하고, 그에 맞는 맞춤형 정서적 공감 대화를 주고받을 수 있는 지능형 반려 로봇 상용화 시스템을 성공적으로 발표했습니다.',
    time: '오전 08:50',
    source_name: '지디넷코리아',
    source_url: 'https://zdnet.co.kr/view/?no=20260713777777'
  },
  {
    id: 10,
    category: '건강',
    title: '질병관리청, 환절기 면역력 저하에 따른 호흡기 감염병 예방 주의보 발령',
    body: '질병관리청은 급격한 기온 변화로 면역력이 떨어지기 쉬운 환절기를 맞아 독감 및 백일해 등 호흡기 감염병 환자가 급증하고 있다고 경고했습니다. 외출 후 손 씻기와 실내 환기 등 예방 수칙을 준수해 달라고 당부했습니다.',
    time: '오전 09:00',
    source_name: '헬스조선',
    source_url: 'https://health.chosun.com/site/data/html_dir/2026/07/13/2026071300001.html'
  },
  {
    id: 11,
    category: '연예',
    title: '대형 기획사 신인 아이돌 그룹, 데뷔와 동시에 글로벌 음원 차트 1위 석권',
    body: '최근 데뷔한 5인조 하이브리드 콘셉트 신인 보이그룹이 데뷔 타이틀곡 발표와 동시에 국내 주요 음원 차트는 물론 빌보드 및 글로벌 스포티파이 실시간 스트리밍 순위 1위를 휩쓸며 차세대 K-POP 주역으로 떠올랐습니다.',
    time: '오전 09:10',
    source_name: '디스패치',
    source_url: 'https://www.dispatch.co.kr/202607139999'
  },
  {
    id: 12,
    category: '산업',
    title: '국내 완성차 업계, 차세대 고체 전지 탑재 전기차 생산 라인 착공',
    body: '국내 주요 완성차 및 배터리 협력사 연합이 주행 거리를 대폭 늘리고 화재 위험성을 획기적으로 낮춘 꿈의 배터리, 전고체 배터리 전기차 전용 스마트 제조 공장 라인을 국내 최초로 공식 착공하고 대량 양산 돌입을 선언했습니다.',
    time: '오전 09:20',
    source_name: '마켓인사이트',
    source_url: 'https://marketinsight.hankyung.com/article/202607130012c'
  }
];

// TTS Speech Synthesis 객체
const synth = window.speechSynthesis;
let currentUtterance = null;
let voices = [];

// ====================================================
// 2. 초기 로드 및 UI 이벤트 바인딩
// ====================================================
window.addEventListener('DOMContentLoaded', () => {
  initStorage();
  initVoices();
  initTheme(); // 테마 초기화
  bindUIEvents();
  bindKeyboardShortcuts();
  registerServiceWorker();
  
  // 첫 진입 시 자동으로 뉴스 수집 시작
  fetchNews();
  
  // 날짜 출력
  updateDateDisplay();
});

// 로컬 저장소로부터 설정 초기 로드
function initStorage() {
  const savedCategories = localStorage.getItem('news_categories');
  const savedPrompt = localStorage.getItem('news_prompt');
  const savedApiKey = localStorage.getItem('news_api_key');
  const savedVoice = localStorage.getItem('news_voice');
  const savedSpeed = localStorage.getItem('news_speed');

  if (savedCategories) {
    state.categories = JSON.parse(savedCategories);
  }
  if (savedPrompt !== null) {
    state.prompt = savedPrompt;
  }
  if (savedApiKey !== null) {
    state.apiKey = savedApiKey.trim();
  }
  if (savedVoice) {
    state.voiceName = savedVoice;
  }
  if (savedSpeed) {
    state.speed = parseFloat(savedSpeed);
  }

  // UI 컴포넌트에 바인딩
  const categoryCbs = document.querySelectorAll('input[name="categories"]');
  categoryCbs.forEach(cb => {
    cb.checked = state.categories.includes(cb.value);
  });
  
  // 전체 선택 체크박스 동기화
  const allChecked = categoryCbs.length > 0 && Array.from(categoryCbs).every(cb => cb.checked);
  const categoryAll = document.getElementById('category-all');
  if (categoryAll) {
    categoryAll.checked = allChecked;
  }

  document.getElementById('prompt-input').value = state.prompt;
  document.getElementById('api-key-input').value = state.apiKey;
  document.getElementById('speed-slider').value = state.speed;
  document.getElementById('speed-val').innerText = `${state.speed.toFixed(1)}x`;
  document.getElementById('speed-label').innerText = `${state.speed.toFixed(1)}x`;
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
  const selectedCategories = Array.from(document.querySelectorAll('input[name="categories"]:checked')).map(cb => cb.value);
  const promptValue = document.getElementById('prompt-input').value;
  const apiKeyValue = document.getElementById('api-key-input').value.trim();
  const voiceValue = document.getElementById('voice-select').value;
  const speedValue = parseFloat(document.getElementById('speed-slider').value);

  state.categories = selectedCategories;
  state.prompt = promptValue;
  state.apiKey = apiKeyValue;
  state.voiceName = voiceValue;
  state.speed = speedValue;

  localStorage.setItem('news_categories', JSON.stringify(selectedCategories));
  localStorage.setItem('news_prompt', promptValue);
  localStorage.setItem('news_api_key', apiKeyValue);
  localStorage.setItem('news_voice', voiceValue);
  localStorage.setItem('news_speed', speedValue.toString());

  // 플레이어바 목소리 퀵 드롭다운 동기화
  const playerVoiceSelect = document.getElementById('player-voice-select');
  if (playerVoiceSelect) {
    playerVoiceSelect.value = voiceValue;
  }

  // 플레이어 속도 라벨 업데이트
  document.getElementById('speed-label').innerText = `${speedValue.toFixed(1)}x`;

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
      time: formattedTime
    });
  }
  
  return results;
}

async function fetchNews() {
  currentFetchSession++;
  const thisSession = currentFetchSession;
  
  showNewsLoading();
  stopSpeech(); // 뉴스 리프레시 시 기존 재생 정지
  
  state.newsList = [];
  state.currentNewsIndex = -1;
  lastRenderedCategory = ''; // 카테고리 헤더 렌더링 추적 초기화
  
  const hasApiKey = state.apiKey.trim() !== '';
  const selectedCategories = [...state.categories];

  if (selectedCategories.length === 0) {
    renderErrorMessage('선택된 관심사 카테고리가 없습니다. 설정에서 카테고리를 선택해 주세요.');
    return;
  }

  // 사용자가 프롬프트 추가 요구사항에 입력한 뉴스의 개수를 분석 (예: "10개", "10가지" 등)
  let requestedTotal = 5; // 기본 권장 총 기사 개수
  const promptStyle = state.prompt.toLowerCase().trim();
  const numMatch = promptStyle.match(/(\d+)\s*(개|가지|항목|뉴스|소식|개씩)/);
  if (numMatch) {
    requestedTotal = parseInt(numMatch[1]);
  }
  // 각 카테고리별 요청 개수 동적 배분 (카테고리가 1개일 때 10개를 요청하면 10개 생성 시도)
  // 단, API 무료 쿼터 및 쾌속 수집을 위해 단일 카테고리당 최대 5개로 하방 조율
  const countPerCategory = Math.min(5, Math.max(1, Math.ceil(requestedTotal / selectedCategories.length)));

  // 모의 뉴스 시간차 배열
  const timeOffsets = [15, 45, 90, 150, 240, 360, 480, 600];

  // 1단계: 첫 번째 카테고리 즉각 쾌속 수집 및 낭독
  const firstCategory = selectedCategories[0];
  updatePlayerStatus('뉴스 준비 중', `첫 소식(${firstCategory})을 준비하는 중입니다...`);

  try {
    let firstNewsItems = [];
    if (hasApiKey) {
      firstNewsItems = await fetchGeminiNewsForCategory(state.apiKey, firstCategory, state.prompt, countPerCategory);
    } else {
      // 로딩 체감 가상 대기 (0.3초)
      await new Promise(resolve => setTimeout(resolve, 300));
      firstNewsItems = getMockNewsForCategory(firstCategory, timeOffsets[0], countPerCategory);
    }

    // 비동기 실행 도중 세션이 만료되었는지 확인
    if (thisSession !== currentFetchSession) return;

    // 로딩 완료 후 그리드 리프레시
    const grid = document.getElementById('news-grid');
    grid.innerHTML = '';

    // API Key 미등록 시 최상단 경고 안내 배너 추가
    if (!hasApiKey) {
      const warningBanner = document.createElement('div');
      warningBanner.className = 'news-card';
      warningBanner.style.borderColor = 'var(--accent)';
      warningBanner.style.background = 'rgba(239, 68, 68, 0.08)';
      warningBanner.style.gridColumn = '1 / -1';
      warningBanner.style.padding = '16px';
      warningBanner.style.marginBottom = '16px';
      warningBanner.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent); font-size: 18px; margin-top: 2px;"></i>
          <div>
            <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: var(--text-primary);">오프라인 모의(샘플) 뉴스 모드 구동 중</h4>
            <p style="margin: 0; font-size: 12px; color: var(--text-muted); line-height: 1.4;">
              현재 설정에 <strong>Gemini API 키가 입력되지 않아</strong> 미리 정의된 모의 뉴스(샘플 기사)가 표출되고 있습니다. 
              오늘의 실시간 24시간 속보를 직접 수집하고 상세 원문 기사를 확인하려면, 우측 상단 <strong>설정 아이콘(⚙️)</strong>을 클릭해 Gemini API 키를 입력해 주세요.
            </p>
          </div>
        </div>
      `;
      grid.appendChild(warningBanner);
    }

    if (firstNewsItems && firstNewsItems.length > 0) {
      firstNewsItems.forEach(item => {
        state.newsList.push(item);
        const newIdx = state.newsList.length - 1;
        appendNewsCard(item, newIdx);
      });

      updatePlayerStatus('낭독 대기 중', '첫 소식이 준비되어 즉시 자동 재생합니다. 다른 뉴스를 백그라운드에서 수집 중입니다...');

      // 쾌속 재생 트리거
      setTimeout(() => {
        if (thisSession === currentFetchSession && state.newsList.length > 0 && !state.isPlaying) {
          togglePlayPause();
        }
      }, 500);
    } else {
      throw new Error(`첫 소식(${firstCategory})을 가져오지 못했습니다.`);
    }

  } catch (error) {
    console.error('첫 소식 가져오기 실패:', error);
    if (thisSession === currentFetchSession) {
      renderErrorMessage(`첫 뉴스를 준비하지 못했습니다. 상세 원인: ${error.message}`);
    }
    return;
  }

  // 2단계: 나머지 카테고리 백그라운드 순차/병렬 수집 진행
  const remainingCategories = selectedCategories.slice(1);
  if (remainingCategories.length === 0) return;

  remainingCategories.forEach(async (category, sliceIdx) => {
    try {
      let items = [];
      if (hasApiKey) {
        items = await fetchGeminiNewsForCategory(state.apiKey, category, state.prompt, countPerCategory);
      } else {
        // 모의 모드: 자연스러운 슬라이드식 시간차 부착 연출 (1초 간격)
        await new Promise(resolve => setTimeout(resolve, 800 * (sliceIdx + 1)));
        items = getMockNewsForCategory(category, timeOffsets[(sliceIdx + 1) % timeOffsets.length], countPerCategory);
      }

      if (thisSession !== currentFetchSession) return;

      if (items && items.length > 0) {
        items.forEach(item => {
          state.newsList.push(item);
          const newIdx = state.newsList.length - 1;
          appendNewsCard(item, newIdx);
        });

        // 재생 진행률 바 분모 갱신을 위한 강제 호출
        if (state.isPlaying && state.currentNewsIndex !== -1) {
          updateProgressBar(state.currentNewsIndex);
        }
      }
    } catch (err) {
      console.warn(`${category} 카테고리 백그라운드 요약 실패:`, err);
    }
  });
}

// Gemini API를 사용하여 단일 카테고리에 대한 뉴스 요약 생성 (속도 극대화, 개수 동적)
async function fetchGeminiNewsForCategory(apiKey, category, prompt, count = 1) {
  // 대한민국 표준시(KST) 기준 시간 표기 생성
  const now = new Date();
  const currentLocalTimeStr = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentDate = String(now.getDate()).padStart(2, '0');

  const promptText = `
    역할: 전문 아침 뉴스 앵커 및 아나운서
    
    시간 및 검색 규정 (가장 엄격히 준수):
    현재 대한민국의 로컬 시각은 한국 표준시(KST) 기준 [ ${currentLocalTimeStr} ] 이며, 오늘은 [ 2026년 7월 13일 ] 입니다.
    1. **반드시 google_search 도구를 적극 사용해 오늘 현재 시각 기준 "최근 24시간 이내"에 대한민국 메이저 언론사 등에 실제 보도된 실시간 최신 뉴스 및 사건들만 검색하여 요약 기재해야 합니다.**
    2. 과거에 이미 학습한 옛날 데이터나 가공의 기사를 들려주어서는 절대로 안 됩니다. 무조건 오늘 실제 발생한 시사/뉴스 검색 결과만 사용하십시오.
    3. 수집된 최신 뉴스의 정확한 보도 시각을 바탕으로 JSON의 "time" 필드를 채우십시오.
    4. **출처 검증 규정 (극도로 중요 - 절대 변조 금지)**:
       - 검색한 원본 뉴스 기사의 정확한 출처 언론사명(예: 연합뉴스, YTN 등)을 "source_name"에 정확하게 적으십시오.
       - "source_url"에는 반드시 사용자가 클릭했을 때 해당 뉴스의 내용 전체를 직접 눈으로 대조하여 검증해볼 수 있는 **그 뉴스 기사의 실제 원본 URL 전체 주소**를 기입하십시오.
       - **[경고] 기사 URL 주소(예: AKR20260713028400017 등 기사 번호나 파라미터)의 글자나 숫자를 단 하나라도 네가 임의로 지어내거나 추측해서 수정(변조)해서는 절대 안 됩니다. 네가 임의로 기사 번호를 적으면 404 페이지 오류("원하시는 페이지를 찾을 수 없습니다")가 발생합니다. 반드시 google_search 검색 결과에 실제로 표시된 그 기사의 원본 링크 URL을 철자 하나 틀리지 않고 100% 똑같이 그대로 복사-붙여넣기(Copy-and-Paste)하여 출력하십시오.**
       - 네이버 홈(naver.com), 다음 홈(daum.net), 언론사 메인 홈(yna.co.kr 등)과 같은 단순 메인 도메인 주소는 사용자가 뉴스를 검증할 수 없으므로 **절대로 기재하지 마십시오.** 상세 기사 원문 주소만 검색 결과에서 그대로 복사하여 입력해야 합니다.

    요청사항: 
    사용자가 선택한 관심 분야는 [ ${category} ] 입니다.
    사용자의 추가 요구사항: "${prompt || '바쁜 아침에 핵심만 쉽게 요약해줘.'}"

    텍스트 형식 규정 (극도로 중요):
    1. 뉴스 본문("body")에는 절대로 "첫째", "둘째", "셋째", "넷째", "증시 뉴스입니다", "경제 소식입니다" 와 같은 인위적인 순서 표기 단어나 카테고리 머리말을 기재하지 마십시오.
    2. 본문("body")은 뉴스 카드로 화면에 직접 렌더링되므로, 군더더기 단어 없이 아나운서가 부드럽게 읽을 수 있는 가장 세련되고 완성도 높은 한국어 줄글 문장(2~3문장 내외)으로만 채우십시오.
    3. 중복되는 번호나 분야 소개말은 완전히 배제하고 오직 팩트 위주의 본문 내용만 기입하십시오.

    이 설정에 맞춰서 신뢰성 높은 최신 아침 뉴스 브리핑 ${count}가지를 생성하고 JSON 배열 형식으로만 반환해줘.
    반드시 아래 JSON 스키마만 정확하게 준수하여 응답해줘. 설명 문구 없이 JSON 배열 텍스트만 출력해줘:

    [
      {
        "id": 1,
        "category": "${category}",
        "title": "뉴스 제목",
        "body": "화면에 직접 표기될 격식 있고 자연스러운 줄글 형태의 뉴스 내용 (첫째/둘째 등 기호 일절 없음)",
        "time": "${currentMonth}.${currentDate} 오전 08:00",
        "source_name": "연합뉴스",
        "source_url": "https://www.yna.co.kr/view/AKR20260713000100001?section=safe/news"
      }
    ]
  `;

  // ===== 1단계: 구글 API에 직접 물어서 사용 가능한 모델 자동 탐색 =====
  let discoveredModels = [];
  
  for (const version of ['v1beta', 'v1']) {
    try {
      const listUrl = `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`;
      const listResp = await fetch(listUrl);
      if (listResp.ok) {
        const listData = await listResp.json();
        if (listData.models) {
          // generateContent를 지원하는 모델만 필터링
          const genModels = listData.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => ({ name: m.name.replace('models/', ''), version }));
          discoveredModels.push(...genModels);
        }
      }
    } catch (e) {
      console.warn(`${version} 모델 목록 조회 실패:`, e);
    }
  }

  // flash 모델을 우선하도록 정렬 (속도 빠르고 무료 쿼터 넉넉)
  discoveredModels.sort((a, b) => {
    const aFlash = a.name.includes('flash') ? 0 : 1;
    const bFlash = b.name.includes('flash') ? 0 : 1;
    if (aFlash !== bFlash) return aFlash - bFlash;
    // 최신 버전 숫자가 큰 것을 우선
    return b.name.localeCompare(a.name);
  });

  // 자동 탐색 실패 시 기본 후보 목록 사용
  if (discoveredModels.length === 0) {
    const fallbackNames = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
    for (const name of fallbackNames) {
      discoveredModels.push({ name, version: 'v1beta' });
      discoveredModels.push({ name, version: 'v1' });
    }
  }

  console.log(`🔍 [${category}] 탐색된 모델 ${discoveredModels.length}개:`, discoveredModels.map(m => `${m.version}/${m.name}`).join(', '));

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
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
    } catch (netErr) {
      throw new Error('네트워크 연결 실패: 인터넷 상태를 확인해 주세요.');
    }

    if (!response.ok) {
      let errMsg = '';
      try {
        const errJson = await response.json();
        if (errJson.error && errJson.error.message) errMsg = errJson.error.message;
      } catch (_) {}

      // 인증 오류만 즉시 중단
      if (response.status === 401 || response.status === 403) {
        throw new Error('API 키 오류: API 키가 유효하지 않거나 권한이 없습니다. 구글 AI Studio에서 키를 재발급 받으세요.');
      }

      // tools 파라미터 오류(400)일 때 tools 없이 한 번 더 재시도
      if (response.status === 400 && version === 'v1beta') {
        console.warn(`${version}/${model} tools 파라미터 오류, tools 제거 후 재시도...`);
        try {
          delete requestBody.tools;
          const retryResp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
          if (retryResp.ok) {
            response = retryResp; // 성공하면 이 응답을 사용
          } else {
            lastError = `[${version}/${model}] ${errMsg}`;
            console.warn(`모델 ${version}/${model} 재시도 실패(${retryResp.status}), 다음 모델로...`);
            continue;
          }
        } catch (_) {
          continue;
        }
      } else {
        lastError = `[${version}/${model}] ${errMsg || response.statusText}`;
        console.warn(`모델 ${version}/${model} 사용 불가(${response.status}), 다음 모델로 폴백...`);
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
          if (uri && uri.startsWith('http')) {
            verifiedUrls.push(uri);
            verifiedTitles.push(title || '');
          }
        });
      } catch (e) {
        console.warn('구글 그라운딩 메타데이터 추출 실패:', e);
      }

      // 출처 정보 필드명 강제 보정 및 안전화 조치 (품질 강화)
      return result.map((item, idx) => {
        let sourceName = item.source_name || item.sourceName || item.source || item.origin || '';
        let sourceUrl = item.source_url || item.sourceUrl || item.url || item.link || '';

        // 모델이 지어낸 가상/예제 URL 또는 환각 URL 감지 및 보정
        const isBrokenOrFakeUrl = !sourceUrl || 
                                  sourceUrl.includes('AKR20260713000100001') ||
                                  sourceUrl.includes('AKR2023') ||
                                  sourceUrl.includes('example.com') ||
                                  !sourceUrl.startsWith('http');

        if (isBrokenOrFakeUrl && verifiedUrls.length > 0) {
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

        return {
          id: item.id || 1,
          category: item.category || category,
          title: item.title || '최신 속보 브리핑',
          body: item.body || '',
          time: item.time || `${currentMonth}.${currentDate} 오전 08:00`,
          source_name: sourceName.trim(),
          source_url: sourceUrl.trim()
        };
      });
    } catch (parseErr) {
      console.error(`파싱 실패 (${model}):`, rawText);
      lastError = `JSON 파싱 실패 (${model})`;
      continue;
    }
  }

  // 모든 시도 실패
  throw new Error(`[${category}] 모든 Gemini 모델 시도 실패. 마지막 오류: ${lastError}`);
}

// 뉴스 본문에서 "첫째, 둘째" 및 "[카테고리] 뉴스입니다" 같은 불필요한 단어를 정제하는 헬퍼 함수
function cleanNewsBodyText(body, category) {
  let cleaned = body;
  
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
  
  return cleaned.trim();
}

// 로딩 화면 그리기
function showNewsLoading() {
  const grid = document.getElementById('news-grid');
  grid.innerHTML = `
    <!-- 뉴스 로딩 상태 안내 카드 -->
    <div class="news-card loading-status-card" style="text-align: center; padding: 32px; border-color: var(--glass-border-focus); margin-bottom: 8px; animation: fadeIn 0.4s ease;">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 36px; color: var(--primary); margin-bottom: 16px;"></i>
      <h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
        최신 뉴스를 불러옵니다. 잠시만 기다려 주세요.
      </h3>
      <p style="font-size: 13px; color: var(--text-muted);">
        실시간 구글 검색을 연동하여 정확한 팩트 기반의 맞춤 아침 뉴스를 정밀 요약 중입니다.
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
  const errorInfo = message ? `<p style="color: var(--accent); font-size: 13px; margin-top: 12px; font-weight: 600;">상세 원인: ${message}</p>` : '';
  grid.innerHTML = `
    <div class="news-card" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
      <i class="fa-solid fa-triangle-exclamation" style="font-size: 40px; color: var(--accent); margin-bottom: 16px;"></i>
      <h3 style="margin-bottom: 8px;">뉴스를 가져오지 못했습니다</h3>
      <p style="color: var(--text-muted); font-size: 13px;">API 키 오류 또는 인터넷 연결이 불안정할 수 있습니다. 설정 창에서 API 키를 재확인하시거나 오프라인 모드용 기본 모의 뉴스를 사용해 보세요.</p>
      ${errorInfo}
      <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 16px;">새로고침</button>
    </div>
  `;
}

// 개별 뉴스 카드를 하단에 동적으로 덧붙이는 함수 (스트리밍 점진 로딩의 핵심)
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

  const card = document.createElement('article');
  card.className = 'news-card';
  card.id = `news-card-${index}`;
  card.innerHTML = `
    <div>
      <div class="card-title-row" style="display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 12px;">
        <h2 class="card-title" style="margin: 0; flex: 1;">${news.title}</h2>
        <div class="card-title-meta" style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
          <span class="card-time" style="font-size: 12px; color: var(--text-muted); font-weight: 500;">${news.time}</span>
          <button class="btn-card-listen" data-index="${index}" style="margin: 0;">
            <i class="fa-solid fa-volume-high"></i>
          </button>
        </div>
      </div>
      <p class="card-body" style="margin-bottom: 0;">${cleanNewsBodyText(news.body, news.category)}</p>
      ${news.source_name && news.source_url ? `
        <div class="card-source" style="margin-top: 12px; padding-top: 8px; border-top: 1px dashed var(--glass-border); font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
          <i class="fa-solid fa-link" style="font-size: 10px; opacity: 0.7;"></i>
          <span>출처:</span>
          <a href="${news.source_url}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: none; font-weight: 600; transition: color 0.2s;" onmouseover="this.style.color='var(--primary-hover)'; this.style.textDecoration='underline'" onmouseout="this.style.color='var(--primary)'; this.style.textDecoration='none'">
            ${news.source_name}
          </a>
        </div>
      ` : ''}
    </div>
  `;
  grid.appendChild(card);

  // 개별 듣기 버튼 즉시 바인딩
  const btn = card.querySelector('.btn-card-listen');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'));
      playNewsAtIndex(idx);
    });
  }
}

// 화면에 뉴스 카드 배치 (초기화 및 빈 상태용)
function renderNewsList(list) {
  const grid = document.getElementById('news-grid');
  grid.innerHTML = '';

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
    } else {
      // 일시정지 실행
      synth.pause();
      state.isPaused = true;
      updatePlayerControlsUI(true, true);
    }
  } else {
    // 처음부터 재생 시작 (인트로 활성화)
    playNewsAtIndex(0, true);
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

  const news = state.newsList[index];
  
  // 낭독 텍스트 구성 (인트로 및 분야/제목 단어 제거)
  let speakText = '';
  if (index === 0 && !state.hasSpokenIntro) {
    const today = new Date();
    const month = today.getMonth() + 1;
    const date = today.getDate();
    speakText += `${month}월 ${date}일 오늘 주요 뉴스를 알려드립니다. `;
    state.hasSpokenIntro = true;
  }
  
  // 직전 카드와 동일 카테고리 여부 검사
  const isSameCategory = index > 0 && state.newsList[index - 1].category === news.category;
  
  // 본문 가공: 텍스트 클리너를 적용하여 "첫째, 둘째, 증시 뉴스입니다" 등 군더더기 전면 삭제
  let processedBody = cleanNewsBodyText(news.body, news.category);

  // 1. 카테고리가 최초로 시작할 때만 카테고리 정보 안내
  if (!isSameCategory) {
    speakText += `${news.category} 소식입니다. `;
  }
  
  // 2. [두번째 이미지 요구사항 반영]: 제목(news.title) 읽기는 완전히 생략
  // 3. 가공된 본문만 자연스럽게 추가하여 낭독
  speakText += processedBody;
  
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
        // 모든 뉴스를 읽었을 때
        stopSpeech();
        updatePlayerStatus('낭독이 모두 끝났습니다', '오늘도 활기찬 아침 보내세요!');
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
function stopSpeech(resetUI = true) {
  synth.cancel();
  
  if (resetUI) {
    state.isPlaying = false;
    state.isPaused = false;
    state.currentNewsIndex = -1;
    
    // UI 원복
    removeHighlightFromCards();
    updatePlayerControlsUI(false, false);
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
    alert('마지막 뉴스입니다.');
  }
}

// 이전 뉴스 이동
function playPrevNews() {
  if (state.newsList.length === 0) return;
  const prevIdx = state.currentNewsIndex - 1;
  if (prevIdx >= 0) {
    playNewsAtIndex(prevIdx);
  } else {
    alert('첫 번째 뉴스입니다.');
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
  document.getElementById('current-reading-title').innerText = title;
  document.getElementById('current-reading-desc').innerText = desc;
}

// ====================================================
// 6. PWA 서비스 워커 등록 & 네트워크 핸들링
// ====================================================
function registerServiceWorker() {
  // 캐싱으로 인한 최신 코드 반영 지연(구버전 캐시 크래시)을 원천 해결하기 위해 서비스 워커 및 로컬 캐시 해제
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister().then(() => {
          console.log('구버전 캐시 방지를 위해 서비스 워커가 해제되었습니다.');
        });
      }
    });

    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          caches.delete(key).then(() => {
            console.log('이전 앱 캐시 스토리지 클리어 완료:', key);
          });
        });
      });
    }
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
