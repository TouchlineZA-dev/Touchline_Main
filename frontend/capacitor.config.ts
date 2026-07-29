import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'za.co.touchlinesa.app',
  appName: 'Touchline SA',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2D7D32',
      showSpinner: false
    }
  }
};

export default config;
