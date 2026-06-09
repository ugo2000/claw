import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ugoclaw.app',
  appName: '贸虾 UgoClaw',
  webDir: 'dist',
  server: {
    // androidScheme: 'https' 会导致 WebView 以 https 协议加载本地页面，
    // 某些 Android 版本会拦截 fetch() 外部 HTTPS 请求，导致 failed to fetch。
    // 改为默认 scheme（capacitor://），避免此问题。
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a56db',
      showSpinner: true,
      spinnerColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1a56db',
    },
  },
};

export default config;
