import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dietplan.tracker',
  appName: 'Diet Plan & Tracker',
  webDir: 'client/dist',

  // Live API URL — change this to your production backend.
  // For local dev against the Vercel dev server, leave empty so the
  // webview uses the bundled static files and hits your local proxy.
  server: {
    url: process.env.VITE_API_URL || undefined,
    // The app talks exclusively to HTTPS endpoints (Vercel API); local dev
    // loads bundled assets with no server.url, so cleartext is never needed.
    // Keeping it off avoids a Play pre-launch / review flag.
    cleartext: false,
  },

  // Plugins that need store-friendly UX
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0F1117',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      spinnerColor: '#F97316',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#F2F1EC',
    },
  },

  // iOS-specific
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0F1117',
    // Apple now requires a privacy manifest. Capacitor will create one,
    // but you can override it by placing PrivacyInfo.xcprivacy in ios/App/.
    appleTeamId: process.env.APPLE_TEAM_ID || '',
  },

  // Android-specific
  android: {
    // Mixed content (HTTPS page loading HTTP subresources) is a security
    // regression and a Play pre-launch flag. Keep it off in release.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0F1117',
  },
};

export default config;
