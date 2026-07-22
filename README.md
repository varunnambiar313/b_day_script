# Anu ❤️ Varun Distance Check-In

A cute couple-themed GitHub Pages app for Anu and Varun to check in from wherever they are. Each check-in stores the person's latest browser location and timestamp in this GitHub repository, then shows both latest locations on a world map with a heart-colored line and the distance between them.

## Features

- Two large check-in buttons: **Check in as Anu** and **Check in as Varun**.
- Browser geolocation capture for latitude, longitude, accuracy, and timestamp.
- GitHub-backed latest-location file at `data/checkins.json` so it works on GitHub Pages without PHP or a localhost server.
- Fresh check-ins are pulled from GitHub every time the app opens.
- Check-ins update `data/checkins.json` through the GitHub Contents API, then refresh the map from GitHub after the save completes.
- Leaflet/OpenStreetMap world map centered on the latest check-ins.
- A line connecting both people, distance in miles, and a cute long-distance one-liner.

## GitHub Pages setup

1. Deploy this repository with GitHub Pages.
2. Create a fine-grained GitHub personal access token for this repository with **Contents: Read and write** permission.
3. Open the app over HTTPS, tap a check-in button, and paste the token when prompted. The token is stored only in that browser's `localStorage` and is not committed to the repository.

> Important: GitHub Pages is static hosting, so it cannot run PHP. The app now talks directly to GitHub's API from the browser. Anyone who needs to check in must have a token with write access to this repository, so only use tokens you trust on devices you trust.

## Optional repository configuration

When served from `https://OWNER.github.io/REPO/`, the app automatically infers the GitHub owner and repository name. If you use a custom domain or a different data branch/path, add these globals before `app.js` in `index.html`:

```html
<script>
  window.CHECKIN_GITHUB_OWNER = 'your-github-user';
  window.CHECKIN_GITHUB_REPO = 'b_day_script';
  window.CHECKIN_GITHUB_BRANCH = 'main';
  window.CHECKIN_GITHUB_PATH = 'data/checkins.json';
</script>
```

## Run locally

Because the app uses browser geolocation and the GitHub API, test from a local web server instead of opening the file directly:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser. Browser location APIs require a secure context; `localhost` is allowed for local development. In production, serve it over HTTPS.

## Replacing the images

Replace the photos in `assets/images/anu/` and `assets/images/varun/` with your own images, or update the `<img>` paths in `index.html` if you prefer different filenames or formats.
