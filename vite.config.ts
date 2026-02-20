import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    // 优化的代码分割策略
    rollupOptions: {
      output: {
        // 更好的块命名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        manualChunks: (id) => {
          // React 核心
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          // Ant Design + Icons 打包在一起避免顺序问题
          if (id.includes('node_modules/antd') || id.includes('node_modules/@ant-design/icons')) {
            return 'vendor-ui';
          }
          // Recharts 图表库
          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts';
          }
          // AI 相关
          if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark')) {
            return 'vendor-ai';
          }
          // Dayjs
          if (id.includes('node_modules/dayjs')) {
            return 'vendor-dayjs';
          }
          // Router
          if (id.includes('node_modules/react-router') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-router';
          }
        },
      },
    },
    // 启用压缩
    minify: 'esbuild',
    // 生成 sourcemap
    sourcemap: false,
    // 分块大小警告阈值
    chunkSizeWarningLimit: 800,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 启用模块预加载
    modulePreload: {
      polyfill: true,
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  // 依赖优化
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'antd', 'recharts'],
    // 更快地打包
    esbuildOptions: {
      legalComments: 'none',
    },
  },
  // CSS 处理
  css: {
    devSourcemap: true,
  },
});
