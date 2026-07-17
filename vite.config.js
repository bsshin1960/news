import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function stripHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlResponse(buffer, contentType = '') {
  const bytes = buffer instanceof ArrayBuffer ? buffer : buffer.buffer;
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  const charset = (
    contentType.match(/charset=([^;\s]+)/i)?.[1] ||
    utf8.match(/<meta[^>]+charset=["']?([^\s"'>]+)/i)?.[1] ||
    utf8.match(/<meta[^>]+content=["'][^"']*charset=([^\s"'>;]+)/i)?.[1] ||
    ''
  ).toLowerCase();

  if (charset && charset !== 'utf-8' && charset !== 'utf8') {
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch (_) {
      return utf8;
    }
  }

  if (utf8.includes('\uFFFD') || /charset=(?:euc-kr|ks_c_5601-1987|cp949)/i.test(utf8)) {
    try {
      return new TextDecoder('euc-kr').decode(bytes);
    } catch (_) {
      return utf8;
    }
  }

  return utf8;
}
function extractArticleTitle(html = '') {
  const patterns = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
    /<title\b[^>]*>([\s\S]*?)<\/title>/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return stripHtml(match[1]).replace(/\s+[-|]\s+[^-|]+$/, '').trim();
    }
  }
  return '';
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

async function resolveGoogleNewsUrl(value = '') {
  if (!isGoogleNewsUrl(value)) return value;

  const articleId = getGoogleNewsArticleId(value);
  if (!articleId) return value;

  const pageUrl = new URL(value);
  pageUrl.searchParams.set('hl', 'ko');
  pageUrl.searchParams.set('gl', 'KR');
  pageUrl.searchParams.set('ceid', 'KR:ko');

  const articlePage = await fetch(pageUrl.href, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await articlePage.text();
  const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!signature || !timestamp) return value;

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

  const response = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je&hl=ko&gl=KR&ceid=KR%3Ako', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'Mozilla/5.0'
    },
    body: `f.req=${encodeURIComponent(JSON.stringify(rpcPayload))}`
  });
  const responseText = await response.text();
  try {
    const jsonLine = responseText.split('\n').find(line => line.trim().startsWith('['));
    const parsed = JSON.parse(jsonLine);
    const innerText = parsed?.[0]?.[2];
    const inner = innerText ? JSON.parse(innerText) : null;
    return inner?.[1] || value;
  } catch (_) {
    const payloadMatch = responseText.match(/\\"garturlres\\",\\"((?:\\\\.|[^\\"])*)\\"/);
    if (!payloadMatch?.[1]) return value;
    return JSON.parse(`"${payloadMatch[1]}"`);
  }
}
function extractArticleText(html = '') {
  const candidates = [];
  const metaDescription = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (metaDescription?.[1]) candidates.push(metaDescription[1]);

  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
  if (articleMatch?.[0]) candidates.push(stripHtml(articleMatch[0]));

  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(match => stripHtml(match[1]))
    .filter(text => text.length >= 30);
  if (paragraphs.length > 0) candidates.push(paragraphs.join(' '));

  const best = candidates
    .map(text => stripHtml(text))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || '';

  return best;
}

const articleTextProxy = () => ({
  name: 'article-text-proxy',
  configureServer(server) {
    server.middlewares.use('/api/article-text', async (req, res) => {
      try {
        const requestUrl = new URL(req.url || '', 'http://localhost');
        const target = requestUrl.searchParams.get('url');
        if (!target || !/^https?:\/\//i.test(target)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ text: '' }));
          return;
        }

        const resolvedTarget = await resolveGoogleNewsUrl(target);
        const response = await fetch(resolvedTarget, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        });
        const htmlBuffer = await response.arrayBuffer();
        const html = decodeHtmlResponse(htmlBuffer, response.headers.get('content-type') || '');
        const title = extractArticleTitle(html);
        const text = extractArticleText(html);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ title, text, finalUrl: response.url, resolvedUrl: resolvedTarget }));
      } catch (error) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ text: '', error: error?.message || String(error) }));
      }
    });
  }
});

// 빌드 완료 후 루트의 PWA 파일들을 dist로 복사하는 커스텀 플러그인
const copyPwaAssets = () => {
  return {
    name: 'copy-pwa-assets',
    closeBundle() {
      const distPath = path.resolve(__dirname, 'dist');
      
      // 1. manifest.json 복사
      if (fs.existsSync('manifest.json')) {
        fs.copyFileSync('manifest.json', path.join(distPath, 'manifest.json'));
        console.log('✓ manifest.json copied to dist/');
      }
      
      // 2. sw.js 복사
      if (fs.existsSync('sw.js')) {
        fs.copyFileSync('sw.js', path.join(distPath, 'sw.js'));
        console.log('✓ sw.js copied to dist/');
      }
      
      // 3. icons 디렉토리 복사
      const copyDir = (src, dest) => {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (let entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      
      if (fs.existsSync('icons')) {
        copyDir('icons', path.join(distPath, 'icons'));
        console.log('✓ icons/ folder copied to dist/');
      }
    }
  };
};

export default defineConfig({
  // 상대 경로 빌드를 지원하여 GitHub Pages 등 하위 경로 배포 시 404 방지
  base: './',
  plugins: [articleTextProxy(), copyPwaAssets()],
  server: {
    proxy: {
      '/api/google-news': {
        target: 'https://news.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/google-news/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      },
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, '')
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // 빌드 결과물에서 파일 이름 해시 제거하여 캐싱 안정성 확보
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
