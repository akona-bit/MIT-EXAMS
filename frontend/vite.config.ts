import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-plotly': ['plotly.js', 'react-plotly.js'],
          'vendor-editor': [
            '@tiptap/react',
            '@tiptap/starter-kit',
            // Lưu ý: KHÔNG list '@tiptap/pm' — package không có entry "."
            // (chỉ dùng qua subpath), đưa vào manualChunks object sẽ fail build.
            '@tiptap/extension-image',
            '@tiptap/extension-table',
            '@tiptap/extension-table-cell',
            '@tiptap/extension-table-header',
            '@tiptap/extension-table-row',
            'tiptap-markdown',
          ],
          'vendor-motion': ['framer-motion'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
})
