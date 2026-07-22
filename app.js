const APP_VERSION = '20260722-github-checkins';

const people = {
  anu: { label: 'Anu', color: '#ff4f8b' },
  varun: { label: 'Varun', color: '#7c4dff' },
};

const githubStorage = {
  owner: window.CHECKIN_GITHUB_OWNER || inferGithubOwner(),
  repo: window.CHECKIN_GITHUB_REPO || inferGithubRepo(),
  branch: window.CHECKIN_GITHUB_BRANCH || 'main',
  path: window.CHECKIN_GITHUB_PATH || 'data/checkins.json',
  tokenStorageKey: 'love-map-github-token',
};

const emptyCheckins = { anu: null, varun: null };
const statusEl = document.querySelector('#status');
const distanceEl = document.querySelector('#distance');
const loveNoteEl = document.querySelector('#love-note');
const updatedEl = document.querySelector('#last-updated');
const initialCenter = [20, 0];
const map = L.map('map', { worldCopyJump: true }).setView(initialCenter, 2);
let markers = {};
let connectionLine;
let lastGithubFileSha;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

window.addEventListener('resize', () => map.invalidateSize());

function inferGithubOwner() {
  const match = window.location.hostname.match(/^([^.]+)\.github\.io$/i);
  return match?.[1] || '';
}

function inferGithubRepo() {
  const firstPathSegment = window.location.pathname.split('/').filter(Boolean)[0];
  return firstPathSegment || window.location.hostname.split('.')[0] || '';
}

function githubApiUrl({ includeRef = false, bustCache = false } = {}) {
  const encodedPath = githubStorage.path.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`https://api.github.com/repos/${githubStorage.owner}/${githubStorage.repo}/contents/${encodedPath}`);
  if (includeRef) url.searchParams.set('ref', githubStorage.branch);
  if (bustCache) url.searchParams.set('_', Date.now().toString());
  return url;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function milesBetween(a, b) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

function cuteDistanceLine(miles) {
  if (!Number.isFinite(miles)) return 'Two check-ins make one shared sky.';
  if (miles < 1) return 'So close that even the map is blushing.';
  if (miles < 50) return 'Just a short hop, a heart skip, and one sweet hello apart.';
  if (miles < 500) return 'Different places, same heartbeat.';
  return 'Every mile is just another reason the next hug will feel magical.';
}

function personIcon(personKey) {
  const person = people[personKey];
  return L.divIcon({
    className: 'love-marker',
    html: `<div style="--marker:${person.color}">❤️<span>${person.label}</span></div>`,
    iconSize: [84, 54],
    iconAnchor: [42, 54],
  });
}

function isValidCoordinate(checkin) {
  const latitude = Number(checkin?.latitude);
  const longitude = Number(checkin?.longitude);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function normalizeCheckins(checkins = {}) {
  return Object.entries(people)
    .map(([key]) => [key, checkins[key]])
    .filter(([, checkin]) => isValidCoordinate(checkin));
}

function renderMap(checkins = {}) {
  const valid = normalizeCheckins(checkins);
  const activeKeys = new Set(valid.map(([key]) => key));

  Object.entries(markers).forEach(([key, marker]) => {
    if (!activeKeys.has(key)) {
      marker.remove();
      delete markers[key];
    }
  });

  valid.forEach(([key, checkin]) => {
    const latLng = [Number(checkin.latitude), Number(checkin.longitude)];
    const checkedInAt = checkin.checked_in_at ? new Date(checkin.checked_in_at).toLocaleString() : 'Just now';
    const accuracy = Number.isFinite(Number(checkin.accuracy)) ? `<br>Accuracy: ${Math.round(Number(checkin.accuracy))} meters` : '';
    const popup = `${people[key].label}<br>${checkedInAt}${accuracy}`;

    if (markers[key]) {
      markers[key].setLatLng(latLng).setPopupContent(popup);
    } else {
      markers[key] = L.marker(latLng, { icon: personIcon(key) }).addTo(map).bindPopup(popup);
    }
  });

  if (valid.length === 2) {
    const anu = checkins.anu;
    const varun = checkins.varun;
    const points = [[Number(anu.latitude), Number(anu.longitude)], [Number(varun.latitude), Number(varun.longitude)]];
    if (connectionLine) connectionLine.setLatLngs(points);
    else connectionLine = L.polyline(points, { color: '#ff4f8b', weight: 5, dashArray: '10 12' }).addTo(map);

    const miles = milesBetween(anu, varun);
    distanceEl.textContent = `${miles.toLocaleString(undefined, { maximumFractionDigits: 1 })} miles apart`;
    loveNoteEl.textContent = cuteDistanceLine(miles);
    map.fitBounds(L.latLngBounds(points).pad(0.45), { maxZoom: 8, animate: true });
  } else {
    if (connectionLine) {
      connectionLine.remove();
      connectionLine = undefined;
    }

    if (valid.length === 1) {
      const [, checkin] = valid[0];
      map.setView([Number(checkin.latitude), Number(checkin.longitude)], 10);
      distanceEl.textContent = 'Waiting for one more heart';
      loveNoteEl.textContent = 'One pin is glowing; the other heart can check in whenever ready.';
    } else {
      map.setView(initialCenter, 2);
      distanceEl.textContent = 'Waiting for both check-ins';
      loveNoteEl.textContent = 'No matter the miles, every check-in says “I am right here with you.”';
    }
  }

  const updated = valid.map(([key, c]) => `${people[key].label}: ${new Date(c.checked_in_at).toLocaleString()}`);
  updatedEl.textContent = updated.length ? `Latest check-ins — ${updated.join(' • ')}` : '';
  requestAnimationFrame(() => map.invalidateSize());
}

function decodeBase64Json(content) {
  const decoded = atob(content.replace(/\s/g, ''));
  return JSON.parse(decodeURIComponent(escape(decoded)));
}

function encodeBase64Json(data) {
  const json = JSON.stringify(data, null, 2) + '\n';
  return btoa(unescape(encodeURIComponent(json)));
}

function normalizeStoredData(data = {}) {
  return {
    checkins: {
      ...emptyCheckins,
      ...(data.checkins || {}),
    },
  };
}

async function fetchGithubFile() {
  if (!githubStorage.owner || !githubStorage.repo) {
    throw new Error('GitHub Pages repository could not be detected. Set CHECKIN_GITHUB_OWNER and CHECKIN_GITHUB_REPO before app.js loads.');
  }

  const response = await fetch(githubApiUrl({ includeRef: true, bustCache: true }), {
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (response.status === 404) {
    lastGithubFileSha = undefined;
    return normalizeStoredData();
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Could not load check-ins from GitHub.');

  lastGithubFileSha = data.sha;
  return normalizeStoredData(decodeBase64Json(data.content || 'e30='));
}

async function loadCheckins() {
  const data = await fetchGithubFile();
  renderMap(data.checkins);
  return data;
}

function githubToken() {
  const stored = localStorage.getItem(githubStorage.tokenStorageKey);
  if (stored) return stored;

  const token = window.prompt('Paste a fine-grained GitHub token with Contents: Read and write access for this repository. It is stored only in this browser so GitHub Pages can update data/checkins.json.');
  if (!token) throw new Error('GitHub token is required to save a check-in from GitHub Pages.');
  localStorage.setItem(githubStorage.tokenStorageKey, token.trim());
  return token.trim();
}

async function saveCheckin(person, position) {
  const latest = await fetchGithubFile();
  const nextData = normalizeStoredData(latest);
  nextData.checkins[person] = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    checked_in_at: new Date().toISOString(),
  };

  const body = {
    message: `Update ${people[person].label} check-in`,
    content: encodeBase64Json(nextData),
    branch: githubStorage.branch,
  };
  if (lastGithubFileSha) body.sha = lastGithubFileSha;

  const response = await fetch(githubApiUrl(), {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken()}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
  const saved = await response.json();

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem(githubStorage.tokenStorageKey);
    throw new Error('GitHub rejected the saved token. Create a fine-grained token with Contents read/write access and try again.');
  }
  if (!response.ok) throw new Error(saved.message || 'GitHub could not save the check-in.');

  lastGithubFileSha = saved.content?.sha;
  return nextData;
}

function getDeviceLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  });
}

function locationErrorMessage(error) {
  if (error?.code === error?.PERMISSION_DENIED) return 'Location permission is needed to check in. On iPhone, enable Location Services and allow Safari/this app to access your location.';
  if (error?.code === error?.POSITION_UNAVAILABLE) return 'This device could not determine its current location. Please check GPS, Wi-Fi, or cellular service and try again.';
  if (error?.code === error?.TIMEOUT) return 'Finding this device took too long. Please try again from a place with a stronger signal.';
  return error?.message || 'This device could not share its location.';
}

async function checkIn(person) {
  if (!people[person]) {
    setStatus('Choose Anu or Varun before checking in.', true);
    return;
  }

  if (!window.isSecureContext) {
    setStatus('Location sharing needs HTTPS, or localhost while testing.', true);
    return;
  }

  if (!navigator.geolocation) {
    setStatus('This browser does not support location sharing.', true);
    return;
  }

  setStatus(`Finding ${people[person].label}'s spot on the love map...`);

  try {
    const position = await getDeviceLocation();
    setStatus(`Saving ${people[person].label}'s check-in to GitHub...`);
    await saveCheckin(person, position);
    setStatus('Check-in saved. Refreshing the love map from GitHub...');
    const refreshed = await loadCheckins();
    renderMap(refreshed.checkins || {});
    setStatus(`${people[person].label} checked in. Sending a tiny heart across the map!`);
  } catch (error) {
    setStatus(locationErrorMessage(error), true);
  }
}

document.querySelectorAll('.person-button').forEach((button) => {
  button.addEventListener('click', () => checkIn(button.dataset.person));
});

loadCheckins()
  .then(() => setStatus('Tap your picture to share your latest location.'))
  .catch((error) => setStatus(error.message || 'Ready when you are. First check-in will create the love map.', true));
