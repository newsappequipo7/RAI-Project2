import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      'react-native': fileURLToPath(
        new URL('../apps/mobile/node_modules/react-native-web/dist/index.js', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
  },
});
