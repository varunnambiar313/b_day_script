# Anu ❤️ Varun Distance Check-In

A cute couple-themed web app for Anu and Varun to check in from wherever they are. Each check-in stores the person's latest browser location and timestamp, then shows both latest locations on a world map with a heart-colored line and the distance between them.

## Features

- Two large check-in buttons: **Check in as Anu** and **Check in as Varun**.
- Browser geolocation capture for latitude, longitude, accuracy, and timestamp.
- SQLite-backed latest-location database at `data/checkins.sqlite`.
- Leaflet/OpenStreetMap world map centered on the midpoint between both latest check-ins.
- A line connecting both people, distance in miles, and a rotating cute long-distance one-liner.
- Image folders for personal photos:
  - `assets/images/anu/profile.svg`
  - `assets/images/varun/profile.svg`

## Run locally

This is a small PHP app. From the repository root, run:

```bash
php -S localhost:8000
```

Open `http://localhost:8000` in your browser. Do not open `index.html` directly from the filesystem; the check-in API must be served by PHP. The browser first calls `checkin.php` and then `src/checkin.php`; if both return HTML instead of JSON, the app falls back to browser-only demo storage and shows a setup message. Browser location APIs require a secure context; `localhost` is allowed for local development. In production, serve it over HTTPS.

## Replacing the images

Replace the placeholder SVGs in `assets/images/anu/` and `assets/images/varun/` with your own photos. Keep the filenames as `profile.svg`, or update the `<img>` paths in `index.html` if you prefer different filenames or formats.

## Notes

Make sure the PHP process can write to the `data/` directory so SQLite can create and update `data/checkins.sqlite`.
