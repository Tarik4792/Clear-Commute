import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.clearcommute.app',
  appName: 'ClearCommute',
  webDir: 'out',
  server: {
    url: 'https://clearcommute.vercel.app',
    cleartext: false
  }
};
export default config;
