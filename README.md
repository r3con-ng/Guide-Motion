# Guide Motion rebuild

This is the new, separate rebuild workspace. The legacy project remains outside this directory and is not used by this preview. The prototype has no Firebase dependency or paid service.

## Run locally

From this directory, start Python's built-in static server:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Serving over HTTP lets the browser load the locale JSON file. No package install or paid service is required.

## Working in this step

- Sidebar navigation between all planned sections, including browser back/forward.
- Mobile navigation drawer with backdrop, Escape handling, and accessible state.
- Light/dark theme switch; preference is saved in this browser when storage is available, otherwise the system theme is used on first visit.
- Responsive layouts from 320 CSS pixels upward, with keyboard focus visibility and reduced-motion support.
- English source strings live in `locales/en.json`; each translated resource uses the same key structure.
- English and a first-pass Hindi locale are available in the language selector. The choice is remembered in this browser, and switching updates page text, forms, management details, map labels, screen-reader names, date/number formatting, and text direction metadata. The remaining scheduled languages are not yet translated; review Hindi with a fluent speaker before publishing it.
- Porter, meal, and medical request forms validate their service-specific fields and save a prototype reference in this browser's local storage.
- The booking page lists locally saved requests and lets you remove them.
- Staff applications cover manager, coolie / porter, medical staff, and catering / delivery roles, with fields adapted from the existing project.
- Local application history displays saved sample submissions and lets you remove them.
- The station guide has a fictional, interactive station layout sketch linked to facility markers and listings, plus search and category filters for the directory.
- Management has read-only, searchable booking and application tables, keyboard-operable tabs, and detail dialogs. Its employee directory stays empty until a real employee data workflow is defined.

The station directory and layout are fictional sample content; they are not a real station map, live status feed, or directions service. Prototype booking and application records do not sync to other devices, contact railway staff or employers, or provide secure accounts. Anyone using the same browser can view local records, including the management tables. Use sample details only; do not enter real personal or medical information. Secure accounts and shared management actions are still staged for a backend decision.


## Deploy to GitHub Pages

The repository includes a GitHub Actions workflow that publishes the static site when changes are pushed to `main`. In the repository settings, open **Pages** and set the build and deployment source to **GitHub Actions**. After the first successful workflow run, the site is available at <https://r3con-ng.github.io/Guide-Motion/>.
