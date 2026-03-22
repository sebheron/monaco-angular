import { defineConfig } from 'vite';

export default defineConfig({
    optimizeDeps: {
        exclude: ['monaco-editor', 'monaco-angular-worker'],
    }
});