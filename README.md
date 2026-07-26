# Message Clock

Turn an old tablet into a message clock with weather, a flip clock, live messages, and Jinzhu the cat.

## Live site

https://kimyjxyim-beep.github.io/message-clock/

## Message board

Use the private message-board console to publish, review, and delete messages:

https://kimyjxyim-beep.github.io/message-clock/message.html

## Lively Wallpaper mode

https://kimyjxyim-beep.github.io/message-clock/?wallpaper=1

## Windows desktop pet overlay

The desktop-overlay folder contains the Electron app for the Windows overlay.

Run locally:

cd desktop-overlay
npm install
npm start

Build the portable package:

npm run dist

## Project structure

- index.html: main GitHub Pages clock
- legacy/message/: message-board console
- scripts/: clock, weather, message, and interaction logic
- styles/: site styles
- assets/: Jinzhu artwork
- desktop-overlay/: Windows Electron overlay
