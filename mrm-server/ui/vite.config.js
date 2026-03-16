import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: '../public',
        emptyOutDir: true,
    },
    server: {
        proxy: {
            '/oslc': 'http://localhost:3002',
            '/resource': 'http://localhost:3002',
            '/compact': 'http://localhost:3002',
            '/sparql': 'http://localhost:3002',
            '/dialog': 'http://localhost:3002',
        },
    },
});
//# sourceMappingURL=vite.config.js.map