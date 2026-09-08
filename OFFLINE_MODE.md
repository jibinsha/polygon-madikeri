# Offline / Low-Network Mode

This update adds an offline layer without changing the existing field workflow.

## What is saved after the app is loaded online

- The full farmer dataset is downloaded in the background and stored locally in IndexedDB.
- Farmer search, Team, Day, Trader, status and completion-date filters can work from the saved dataset when offline.
- Open Map farmer points and their latest completion status are cached locally.
- Dashboard and Team Location responses are cached and can be displayed when the network is unavailable.
- The signed-in user's last verified profile is kept locally so an already signed-in field device can reopen the app without contacting the server.
- The app shell and static files are cached by a service worker.
- OpenStreetMap tiles are cached automatically as the user views them, so previously viewed map areas remain available offline.

## Complete / Reopen while offline

The existing Complete / Reopen buttons continue to work immediately.

When there is no network:

1. The farmer changes state immediately on the device.
2. The action is stored in a local completion queue.
3. If the same BP is changed several times offline, only the latest action is kept.
4. When connectivity returns, queued actions are sent to the server automatically.
5. The local snapshot is refreshed from the server after synchronization.

The database remains the final source of truth when the device reconnects.

## Refresh while offline

React Router refreshes continue to open the application from the cached app shell, including deep routes such as `/farmers` and `/cluster-map`.

## Important first-use step

The device must be opened while online at least once after deployment and allowed to finish loading the project data. The background offline preparation then stores the data locally.

For the best field experience, open **Open Map** online once and move/zoom around the areas that will be needed. Those map tiles will then be available offline.

## What still requires connectivity

- New login / password authentication.
- Admin imports, user management and audit changes.
- Server-side report exports.
- Live team-location updates reaching other users.

Existing field data and Complete/Reopen actions are designed to continue working during temporary network loss.
