# USB portable build for Delta+

Follow these steps to prepare a plug-and-play USB that runs the experience offline on Windows.

## 1) Build the app
- On your dev machine: `npm ci` then `npm run build` (optional: `npm run generate-manifest` if you need a fresh offline manifest).
- After build, copy the entire `dist/` output to the USB as `app/` (USB root). Your USB should end up with `app/index.html`, assets, service worker, etc.

## 2) Get portable runtimes onto the USB
- **Node (portable):** download the Windows x64 ZIP (no installer) from https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip. Extract the contents into `portable/node/` on the USB so `portable/node/node.exe` exists.
- **Chromium (portable):** download a Chrome for Testing build (portable zip), e.g. https://storage.googleapis.com/chrome-for-testing-public/120.0.6099.71/win64/chrome-win64.zip. Extract into `portable/chromium/` so `portable/chromium/chrome.exe` exists.
- Keep `usb-server.js` and `usb-launcher.bat` in the USB root.

Expected USB layout:
```
USB_ROOT/
  app/                <- built dist contents
  portable/
    node/             <- node.exe here
    chromium/         <- chrome.exe here
  chromium-profile/   <- auto-created on first run
  usb-server.js
  usb-launcher.bat
```

## 3) Run it
- Plug the USB into a Windows machine.
- Double-click `usb-launcher.bat`. It will:
  - start a local server on `http://localhost:4173` serving `app/`;
  - open portable Chromium in app mode pointed at that URL;
  - when the browser closes, the server is stopped automatically.
- If Chromium is missing, it falls back to the default browser (you may need to close the command window manually to stop the server).

## Notes
- The Vite config already uses `base: './'` and copies assets/service worker into `dist/`, so the build is relocatable.
- If you change the port or folder, edit `usb-launcher.bat` (PORT, APP_DIR) or pass `--port` / `--dir` when running `usb-server.js` manually.
