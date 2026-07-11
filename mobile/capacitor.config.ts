import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.commtrainer.app',
  appName: 'CommTrainer',
  webDir: 'dist',
  plugins: {
    SpeechRecognition: {
      // Keeps the mic permission request in-flow; the plugin handles the rest.
    },
  },
};

export default config;
