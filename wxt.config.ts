import { defineConfig, defineRunnerConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  runner: defineRunnerConfig({
    disabled: true,
  }),
  manifest: {
    name: 'Coup Card Game',
    description: 'Play Coup card game with your friends using Chrome extension',
    version: '1.0.0',
    permissions: ['tabs', 'storage', 'sidePanel', 'windows'],
    action: {
      default_title: 'Coup Card Game'
    },
    side_panel: {
      default_path: 'sidepanel.html'
    }
  },
});
