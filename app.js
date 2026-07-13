// ====================================================
// 1. 상태 및 상수 정의
// ====================================================
let state = {
  categories: ['정치', '경제', '증시', '과학', '날씨', '사회', '스포츠', '문화', 'AI뉴스'],
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
    time: '오전 07:15'
  },
  {
    id: 2,
    category: '경제',
    title: '글로벌 유가 하락 압력 속 국내 정유업계 수익성 방어 비상',
    body: '글로벌 수요 둔화 우려로 원유 가격이 배럴당 70달러선 아래로 떨어지면서 국내 정유 및 화학 대기업들이 긴급 비상 경영 회의를 소집했습니다. 환율 변동과 결합되어 하반기 마진 확보에 빨간불이 켜진 상황입니다.',
    time: '오전 07:30'
  },
  {
    id: 3,
    category: '증시',
    title: '코스피, 반도체 및 초지능 부문 초강세로 사상 최초 7,000선 돌파 및 안착',
    body: '글로벌 초전도 반도체와 지능형 AI 로봇 수주 랠리에 힘입어 코스피 지수가 역사상 처음으로 7,000선을 가뿐히 돌파했습니다. 외국인과 기관의 폭발적인 매수세 속에 증시는 연일 사상 최고치 신기록을 경신하고 있습니다.',
    time: '오전 08:00'
  },
  {
    id: 4,
    category: '과학',
    title: '한국 연구진, 차세대 초전도체 후보 물질 발견해 학계 이목 집중',
    body: '국내 대학 연구소와 국책 연구기관 공동 연구팀이 상온 극저온 경계 영역에서 강한 반자성 효과를 보이는 신소재 합성 기술을 개발했습니다. 권위 있는 과학 저널 네이처에 게재 검토 중이며 향후 에너지 송전 혁신이 기대됩니다.',
    time: '오전 08:10'
  },
  {
    id: 5,
    category: '날씨',
    title: '기상청, 오늘 밤부터 전국 강풍 동반한 기습 폭설 및 한파 주의보령 발령',
    body: '기상청은 오늘 자정부터 중부 지방을 중심으로 순간 시속 70킬로미터 이상의 돌풍과 함께 최대 15센티미터 이상의 폭설이 내릴 것으로 예보했습니다. 내일 출근길 전국적인 빙판길 교통안전과 대중교통 이용을 신신당부했습니다.',
    time: '오전 08:15'
  },
  {
    id: 6,
    category: '사회',
    title: '경찰청, 지능형 보이스피싱 금융 범죄 차단을 위한 AI 실시간 탐지 기법 전격 도입',
    body: '경찰청은 시중 은행과 손잡고 통화 중 보이스피싱 의심 키워드와 목소리 톤의 이상 징후를 실시간 감지하여 즉시 이체를 차단하는 차세대 AI 차단 시스템을 전국 지점에 시범 적용한다고 밝혔습니다.',
    time: '오전 08:20'
  },
  {
    id: 7,
    category: '스포츠',
    title: '한국 골프 대표팀, 세계 주니어 선수권에서 극적인 대역전 우승 쾌거',
    body: '한국 청소년 골프 국가대표팀이 마지막 라운드에서 침착한 버디 퍼팅 랠리를 보이며 강력한 경쟁 후보인 미국과 일본을 2타 차로 따돌리고 사상 최초 종합 단체전 금메달을 목에 걸었습니다.',
    time: '오전 08:30'
  },
  {
    id: 8,
    category: '문화',
    title: '국립 미술관, 초실감 VR 기술 활용한 가상 고궁 유물 특별 기획전 개최',
    body: '문화재청과 미술관은 최첨단 레이저 스캐닝 가상현실 렌더러 기술을 활용해 조선 시대 궁궐 내부의 왕실 생활 유물을 오감으로 실감 나게 탐험할 수 있는 신규 디지털 헤리티지 전시회를 일반에 무료 개방했습니다.',
    time: '오전 08:40'
  },
  {
    id: 9,
    category: 'AI뉴스',
    title: '국내 AI 연구소, 인간의 복합적 감정을 이해하는 감성 대화 지능 상용화 성공',
    body: '국내 연구진이 멀티모달 인식 알고리즘을 고도화하여 사용자의 미세한 얼굴 근육 떨림과 음성 파장을 실시간 판별하고, 그에 맞는 맞춤형 정서적 공감 대화를 주고받을 수 있는 지능형 반려 로봇 상용화 시스템을 성공적으로 발표했습니다.',
    time: '오전 08:50'
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
async function fetchNews() {
  showNewsLoading();
  stopSpeech(); // 뉴스 리프레시 시 기존 재생 정지
  
  const hasApiKey = state.apiKey.trim() !== '';

  // 현재 시각 기준 상대적 동적 시간을 반환하는 헬퍼 함수 (12시간 이내)
  const getDynamicTime = (minusMinutes) => {
    const now = new Date();
    const target = new Date(now.getTime() - minusMinutes * 60 * 1000);
    const hours = target.getHours();
    const minutes = target.getMinutes();
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${ampm} ${displayHours}:${displayMinutes}`;
  };

  // 모의 뉴스별 현재 시각 기준 상대적 시간차 배열 (분 단위, 모두 12시간 = 720분 이내)
  const timeOffsets = [15, 45, 90, 150, 240, 360, 480, 600];

  try {
    if (hasApiKey) {
      // Gemini API가 제공된 경우 실시간 요약 뉴스 로드
      state.newsList = await fetchGeminiNews(state.apiKey, state.categories, state.prompt);
    } else {
      // API Key가 없는 경우 모의 데이터를 기반으로 필터링 및 조작
      // 로딩 딜레이 체감용 1.2초 대기
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      let filtered = MOCK_NEWS_TEMPLATES.filter(item => state.categories.includes(item.category));
      
      // 만약 선택된 카테고리가 아예 없다면 전체 노출
      if (filtered.length === 0) {
        filtered = [...MOCK_NEWS_TEMPLATES];
      }

      // 사용자가 입력한 요구사항(프롬프트)에 맞춰 텍스트를 커스터마이징 (재미 요소 추가)
      const promptStyle = state.prompt.toLowerCase();
      state.newsList = filtered.map((item, idx) => {
        let modifiedBody = item.body;
        let modifiedTitle = item.title;
        
        if (promptStyle.includes('간단') || promptStyle.includes('요약')) {
          modifiedBody = modifiedBody.split(' ').slice(0, 15).join(' ') + '... (간단 요약 완료)';
        } else if (promptStyle.includes('격려') || promptStyle.includes('희망')) {
          modifiedBody = modifiedBody + ' 활기찬 아침, 오늘도 힘내세요!';
        } else if (promptStyle.includes('쉬운') || promptStyle.includes('초등')) {
          modifiedBody = '🤖 [쉽게 읽기] ' + modifiedBody.replace('경감', '줄임').replace('합성', '만들기').replace('경신', '뛰어넘음');
        }

        // 현재 시각 기준 12시간 이내의 실시간 동적 시간 부여
        const dynamicTime = getDynamicTime(timeOffsets[idx % timeOffsets.length]);

        return {
          ...item,
          title: modifiedTitle,
          body: modifiedBody,
          time: dynamicTime
        };
      });
    }

    // 증시, 경제 등 동일 항목은 연속해서 묶이도록 카테고리별 정렬 수행
    state.newsList.sort((a, b) => a.category.localeCompare(b.category, 'ko'));

    renderNewsList(state.newsList);
    state.currentNewsIndex = -1;
    updatePlayerStatus('낭독 대기 중', '뉴스 수집이 완료되었습니다.');

    // 뉴스 로드 완료 직후 자동 재생 트리거 시도
    setTimeout(() => {
      if (state.newsList.length > 0 && !state.isPlaying) {
        togglePlayPause();
      }
    }, 600);
    
  } catch (error) {
    console.error('뉴스 가져오기 실패:', error);
    renderErrorMessage(error.message);
  }
}

// Gemini API를 사용하여 뉴스 요약 생성
async function fetchGeminiNews(apiKey, categories, prompt) {
  const currentLocalTimeStr = new Date().toLocaleString('ko-KR');

  const promptText = `
    역할: 전문 아침 뉴스 앵커 및 아나운서
    
    시간 제한 규정 (가장 중요):
    현재 사용자의 로컬 시각은 [ ${currentLocalTimeStr} ] 입니다.
    반드시 이 기준 시각으로부터 최대 12시간 이내(현재 시각 기준 12시간 전부터 현재 시각 사이)에 발생한 실제 최신 뉴스나 트렌디한 브리핑만 가져와야 합니다. 
    12시간이 경과한 옛날 과거 뉴스는 절대로 포함해서는 안 되며, 들려주어서도 안 됩니다. 무조건 12시간 이내의 최신성 정보만 취급하세요.

    요청사항: 
    사용자가 선택한 관심 분야는 다음과 같습니다: [${categories.join(', ')}].
    사용자의 추가 요구사항: "${prompt || '바쁜 아침에 핵심만 쉽게 요약해줘.'}"

    텍스트 형식 규정 (극도로 중요):
    1. 뉴스 본문("body")에는 절대로 "첫째", "둘째", "셋째", "넷째", "증시 뉴스입니다", "경제 소식입니다" 와 같은 인위적인 순서 표기 단어나 카테고리 머리말을 기재하지 마십시오.
    2. 본문("body")은 뉴스 카드로 화면에 직접 렌더링되므로, 군더더기 단어 없이 아나운서가 부드럽게 읽을 수 있는 가장 세련되고 완성도 높은 한국어 줄글 문장(2~3문장 내외)으로만 채우십시오.
    3. 중복되는 번호나 분야 소개말은 완전히 배제하고 오직 팩트 위주의 본문 내용만 기입하십시오.

    이 설정에 맞춰서 신뢰성 높은 최신 아침 뉴스 브리핑 5가지를 생성하고 JSON 배열 형식으로만 반환해줘.
    반드시 아래 JSON 스키마만 정확하게 준수하여 응답해줘. 설명 문구 없이 JSON 배열 텍스트만 출력해줘:

    [
      {
        "id": 1,
        "category": "정치",
        "title": "뉴스 제목",
        "body": "화면에 직접 표기될 격식 있고 자연스러운 줄글 형태의 뉴스 내용 (첫째/둘째 등 기호 일절 없음)",
        "time": "오전 08:00"
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

  console.log(`🔍 탐색된 모델 ${discoveredModels.length}개:`, discoveredModels.map(m => `${m.version}/${m.name}`).join(', '));

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
      const result = JSON.parse(jsonString);
      console.log(`✅ 성공: ${version}/${model} 모델로 뉴스 수신 완료`);
      return result;
    } catch (parseErr) {
      console.error(`파싱 실패 (${model}):`, rawText);
      lastError = `JSON 파싱 실패 (${model})`;
      continue;
    }
  }

  // 모든 시도 실패
  throw new Error(`모든 Gemini 모델 시도 실패. 마지막 오류: ${lastError}`);
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

// 화면에 뉴스 카드 배치
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

  let lastCategory = '';
  list.forEach((news, index) => {
    // 이전 카테고리와 다르면 그룹 헤더 추가 (박스 밖 왼쪽 위)
    if (news.category !== lastCategory) {
      const groupHeader = document.createElement('div');
      groupHeader.className = 'category-group-header';
      groupHeader.innerHTML = `
        <span class="category-group-title ${news.category}">${news.category}</span>
        <span class="category-group-line"></span>
      `;
      grid.appendChild(groupHeader);
      lastCategory = news.category;
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
      </div>
    `;
    grid.appendChild(card);
  });

  // 개별 듣기 버튼 바인딩
  document.querySelectorAll('.btn-card-listen').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'));
      playNewsAtIndex(idx);
    });
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
