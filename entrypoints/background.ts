import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  console.log('Coup Card Game Extension Background Service Started');
  
  // Set up the extension when it's installed
  browser.runtime.onInstalled.addListener(() => {
    // Configure side panel to be enabled by default
    browser.sidePanel.setOptions({
      path: 'sidepanel.html',
      enabled: true
    });
  });
  
  // Open side panel when extension icon is clicked
  browser.action.onClicked.addListener((tab) => {
    // Open the side panel in the current tab's window
    if (tab.windowId) {
      browser.sidePanel.open({ windowId: tab.windowId });
    }
  });
});