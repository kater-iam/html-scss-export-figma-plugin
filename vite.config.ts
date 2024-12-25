import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        code: resolve(__dirname, 'src/code.ts'),
        ui: resolve(__dirname, 'src/ui.html')
      },
      output: {
        dir: 'dist',
        entryFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }  
}); 