import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.velologiclabs.gpxexporter',
  appName: 'Export GPX for Komoot',
  webDir: 'build',
  android: {
    allowMixedContent: false
  },
  plugins: {
    CapacitorHttp: { enabled: true }
  }
};

export default config;
