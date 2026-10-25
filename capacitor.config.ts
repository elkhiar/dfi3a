import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'org.dfi3a.app',
  appName: 'Dfi3a',
  webDir: 'dist/client',
  ios: {
    contentInset: 'automatic',
  },
}

export default config
