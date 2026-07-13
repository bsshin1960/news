import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로 빌드를 지원하여 GitHub Pages 등 하위 경로 배포 시 404 방지
  base: './',
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
