import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  plugins: [copyPwaAssets()],
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
