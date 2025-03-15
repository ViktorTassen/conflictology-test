export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('Coup Card Game extension content script running');
    
    // This content script can be expanded to integrate with specific websites
    // For example, it could detect game-related content on certain pages
    // or provide in-page functionality
  },
});
