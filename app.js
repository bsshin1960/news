// ====================================================
// 1. 상태 및 상수 정의
// ====================================================
let state = {
  categories: ['정치', '경제', '증시', '과학'],
  prompt: '',
  apiKey: '',
  voiceName: '',
  speed: 1.0,
  newsList: [],
  currentNewsIndex: -1,
  isPlaying: false,
  isPaused: false
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
    category: '정치',
    title: '국회, 신산업 육성을 위한 규제 샌드박스 연장 법안 통과',
    body: '국회 본회의에서 자율주행 및 드론 배송 등 신산업 분야의 도심 테스트를 3년간 연장 허용하는 규제 완화 특별법 개정안이 통과되었습니다. 여야 합의에 따라 발 빠르게 처리되며 스타트업 업계는 환영의 뜻을 표명했습니다.',
    time: '오전 08:25'
  },
  {
    id: 6,
    category: '경제',
    title: '중소 벤처기업 자금 조달 창구 확대를 위한 정책 자금 조기 집행',
    body: '금융위원회는 고금리로 어려움을 겪고 있는 소상공인과 중소 벤처기업을 대상으로 한 저금리 대환 대출 및 상생 보증 재원을 하반기 시작과 동시에 집중 방출하겠다고 밝혔습니다. 총 규모는 5조 원 규모에 달합니다.',
    time: '오전 08:35'
  },
  {
    id: 7,
    category: '증시',
    title: '뉴욕 증시, 연준 금리 인하 기대감 상승 속에 나스닥 사상 최고치 경신',
    body: '소비자물가지수(CPI) 둔화세가 뚜렷해짐에 따라 미 연방준비제도의 조기 금리 인하 가능성이 고개를 들며 기술주 중심의 나스닥 종합 지수가 강세를 보였습니다. 빅테크 기업들이 일제히 2~3%대 상승세를 기록했습니다.',
    time: '오전 08:45'
  },
  {
    id: 8,
    category: '과학',
    title: '우주항공청, 차세대 독자 위성 발사 성공 및 신호 정상 수신 확인',
    body: '우주항공청 주도로 개발된 정밀 지구관측용 중소형 위성이 우주 궤도에 무사히 진입한 후 대전 지상국과의 첫 교신에 성공했습니다. 향후 고해상도 환경 데이터 수집에 주력할 예정입니다.',
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
    state.apiKey = savedApiKey;
  }
  if (savedVoice) {
    state.voiceName = savedVoice;
  }
  if (savedSpeed) {
    state.speed = parseFloat(savedSpeed);
  }

  // UI 컴포넌트에 바인딩
  document.querySelectorAll('input[name="categories"]').forEach(cb => {
    cb.checked = state.categories.includes(cb.value);
  });
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

    // 기본 목소리 미설정 시 최적의(가장 위에 정렬된) 목소리로 설정
    const savedVoice = localStorage.getItem('news_voice');
    if (!savedVoice && targetVoices.length > 0) {
      state.voiceName = targetVoices[0].name;
      localStorage.setItem('news_voice', state.voiceName);
      if (select.options.length > 0) {
        select.options[0].selected = true;
      }
      if (playerSelect.options.length > 0) {
        playerSelect.options[0].selected = true;
      }
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
  const apiKeyValue = document.getElementById('api-key-input').value;
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

    renderNewsList(state.newsList);
    state.currentNewsIndex = -1;
    updatePlayerStatus('낭독 대기 중', '뉴스 수집이 완료되었습니다. 재생 버튼을 누르세요.');
    
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

    이 설정에 맞춰서 가상 또는 가공된 신뢰성 높은 최신 아침 뉴스 브리핑 5가지를 생성하고 JSON 배열 형식으로만 반환해줘.
    JSON 형식은 정확하게 다음 스키마를 만족해야 해.

    [
      {
        "id": 1,
        "category": "정치",
        "title": "뉴스 제목",
        "body": "뉴스 본문 내용 (TTS 낭독에 적합하도록 차분하고 친절하게 작성)",
        "time": "오전 08:00"
      }
    ]
  `;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: promptText }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });
  } catch (netErr) {
    throw new Error('네트워크 연결 실패: 인터넷 상태를 확인해 주세요.');
  }

  if (!response.ok) {
    let errDetail = 'API 호출 실패';
    try {
      const errJson = await response.json();
      if (errJson.error && errJson.error.message) {
        errDetail = errJson.error.message;
      }
    } catch (_) {}
    throw new Error(`구글 API 오류: ${errDetail}`);
  }

  const data = await response.json();
  
  if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
    throw new Error('AI 응답 생성 실패: 유효한 응답을 생성하지 못했습니다.');
  }

  let text = data.candidates[0].content.parts[0].text.trim();
  
  if (text.startsWith('```')) {
    text = text.replace(/^```json\s*/, '').replace(/```$/, '');
  }

  try {
    return JSON.parse(text);
  } catch (parseErr) {
    throw new Error('AI 뉴스 데이터 파싱 실패: 생성된 뉴스 데이터 구조가 올바르지 않습니다.');
  }
}

// 로딩 화면 그리기
function showNewsLoading() {
  const grid = document.getElementById('news-grid');
  grid.innerHTML = `
    <div class="news-skeleton">
      <div class="skeleton-title"></div>
      <div class="skeleton-content"></div>
      <div class="skeleton-content"></div>
      <div class="skeleton-footer"></div>
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

  list.forEach((news, index) => {
    const card = document.createElement('article');
    card.className = 'news-card';
    card.id = `news-card-${index}`;
    card.innerHTML = `
      <div>
        <div class="card-header">
          <span class="category-tag ${news.category}">${news.category}</span>
          <span class="card-time">${news.time}</span>
        </div>
        <h2 class="card-title">${news.title}</h2>
        <p class="card-body">${news.body}</p>
      </div>
      <div class="card-footer">
        <button class="btn-card-listen" data-index="${index}">
          <i class="fa-solid fa-volume-high"></i> 듣기
        </button>
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
  if (index === 0 && isPlaylistStart) {
    const today = new Date();
    const month = today.getMonth() + 1;
    const date = today.getDate();
    speakText += `${month}월 ${date}일, 오늘의 주요 뉴스를 알려드립니다. `;
  }
  
  // 분야, 제목, 내용 단어를 언급하지 않고 자연스럽게 이어지도록 구성
  speakText += `${news.category} 소식입니다. ${news.title}. ${news.body}`;
  
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
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('서비스 워커가 등록되었습니다. 범위:', reg.scope);
          initInstallPrompt();
        })
        .catch((err) => {
          console.error('서비스 워커 등록 실패:', err);
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
