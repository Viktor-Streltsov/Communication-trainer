import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.commtrainer.app',
  appName: 'CommTrainer',
  webDir: 'dist',
  plugins: {
    SpeechRecognition: {
      // Keeps the mic permission request in-flow; the plugin handles the rest.
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#3C4A3D',
    },
  },
};

export default config;
