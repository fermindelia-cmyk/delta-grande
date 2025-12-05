# DELTA+

DELTA+ is an interactive web experience exploring the Delta ecosystem.

## Project Structure

- **index.html**: The main landing page containing introductory videos and news.
- **game/**: Contains the core game application, including scenes, logic, and game-specific assets.
  - **game/index.html**: The entry point for the game experience.
  - **game/main.js**: The main JavaScript entry point for the game.
  - **game/core/**: Core engine components (App, Router, SceneManager, etc.).
  - **game/scenes/**: Game scenes (Menu, Recorrido, Simulador, etc.).
- **assets/**: General assets used by the landing page and shared components.
- **game-assets/**: Assets specific to the game experience (videos, sounds, textures).

## How to Run

This project uses JavaScript ES modules, which requires a local web server to run due to CORS policies.

### Using Python
If you have Python installed:

1. Open a terminal in the project root.
2. Run:
   ```bash
   python -m http.server
   ```
3. Open your browser and navigate to `http://localhost:8000`.

### Using VS Code Live Server
If you use Visual Studio Code:
1. Install the "Live Server" extension.
2. Right-click `index.html` and select "Open with Live Server".

## Building for Web Sharing

To create a clean distribution build (ready for zipping or uploading to a web server):

1. Run the build script:
   ```bash
   python build.py
   ```
2. This will create a `dist/` folder containing only the necessary files to run the project.
3. You can zip the contents of the `dist/` folder or upload them to your web host.

## Hosting & Updates

### Initial Hosting (Netlify Drag & Drop)
1. Create an account on [Netlify](https://www.netlify.com/).
2. Run `python build.py` to generate the `dist` folder.
3. Drag and drop the `dist` folder into the Netlify dashboard.
4. Your site is now live!

### Updating the Game
To update the live version with fixes:
1. Make your changes in the code.
2. Run the build script again:
   ```bash
   python build.py
   ```
3. Go to your site's dashboard on Netlify.
4. Click on the **"Deploys"** tab.
5. Drag and drop the *new* `dist` folder onto the upload area.
6. The site will update instantly.

## Debug Mode (skip loader)

During development you can bypass the homepage video loader:

- Append `?debug=1` (or `#debug=1`) to the site URL, e.g. `http://localhost:8000/?debug=1`.
- To keep the loader disabled across reloads run `localStorage.setItem('dgSkipLoader','1')` in the browser console. Remove it later with `localStorage.removeItem('dgSkipLoader')`.

With the debug flag active the loader overlay is hidden immediately so you land straight on the interactive homepage.
