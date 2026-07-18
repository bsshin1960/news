const CACHE_NAME = 'news-tts-v44';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  // 개발 서버 환경의 자산 경로
  './app.js',
  './style.css',
  // 프로덕션 빌드(dist) 환경의 자산 경로
  './assets/index.js',
  './assets/index.css',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 서비스 워커 설치 및 리소스 캐싱 (복탄 방지 및 개별 유연 캐싱)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      // 특정 환경에 없는 자산이 있더라도 404 오류로 전체가 깨지지 않도록 개별 add 처리
      const cachePromises = ASSETS_TO_CACHE.map((asset) => {
        return cache.add(asset).catch((err) => {
          console.warn(`[Service Worker] 캐싱 스킵됨 (정상적인 환경 차이): ${asset}`);
        });
      });
      return Promise.all(cachePromises);
    })
  );
  self.skipWaiting();
});

// 활성화 단계에서 이전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 네트워크 요청 인터셉트 및 캐시 반환 (Network-First 전략)
self.addEventListener('fetch', (event) => {
  // TTS API나 외부 통신 등 POST 요청이나 특정 스키마는 캐싱 제외
  // 로컬 개발 서버 환경(localhost, 127.0.0.1)에서는 캐싱 문제 예방을 위해 인터셉트하지 않습니다.
  if (event.request.method !== 'GET' ||
      !event.request.url.startsWith(self.location.origin) ||
      self.location.hostname === 'localhost' ||
      self.location.hostname === '127.0.0.1') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 네트워크 요청 성공 시 유효한 응답인 경우 캐시에 동적으로 추가하고 반환
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패(오프라인) 시 캐시에서 파일 조회
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 오프라인 상태이면서 캐시가 없는 경우에 대한 기본 fallback 처리
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('/');
          }
        });
      })
  );
});
