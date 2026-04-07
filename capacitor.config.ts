import type { CapacitorConfig } from '@capacitor/cli';

const remoteAppUrl = process.env.CAP_SERVER_URL ?? 'https://apk.kreew.in';

const config: CapacitorConfig = {
  appId: 'com.krew.mobile',
  appName: 'KREW',
  webDir: 'dist',
  server: {
    url: remoteAppUrl,
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'kreewaux.xyz',
      'api.kreewaux.xyz',
      '*.kreewaux.xyz',
      '*.kreew.in',
      '*.r2.dev',
      'pub-*.r2.dev',
    ],
  },
  android: {
    allowMixedContent: false, // Prefer HTTPS
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
    // Enable background modes for music playback
    backgroundColor: '#0A0A0C',
    // Better performance settings
    webContentsDebuggingEnabled: false, // Disable in production
  },
  ios: {
    backgroundColor: '#0A0A0C',
    // Enable background audio
    scheme: 'krew',
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#0A0A0C',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    App: {
      // Handle app state changes
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#1DB954',
      sound: 'beep.wav',
    },
  },
};

export default config;
