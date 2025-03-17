# Coup Card Game Chrome Extension

A Chrome extension that lets you play the Coup card game with your friends.

## Features

- Create and join games
- Real-time game updates using Firebase
- Side panel interface for game management
- Full game rules implementation
- Support for 3-6 players

## Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `extension` directory

## Building

To build the extension for production:

```bash
npm run build
```

To create a ZIP file for distribution:

```bash
npm run zip
```

## License

MIT