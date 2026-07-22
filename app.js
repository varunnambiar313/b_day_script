const people = {
  anu: { label: 'Anu', color: '#ff4f8b' },
  varun: { label: 'Varun', color: '#7c4dff' },
};

const statusEl = document.querySelector('#status');
const distanceEl = document.querySelector('#distance');
const loveNoteEl = document.querySelector('#love-note');
const updatedEl = document.querySelector('#last-updated');
const mapEl = document.querySelector('#map');
const apiUrl = new URL('src/checkin.php', window.location.href);
const localStorageKey = 'anu-varun-checkins';
let usingLocalFallback = false;
let map;
let markers = {};
let connectionLine;
let tileLayer;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function isRunnableProtocol() {
  return ['http:', 'https:'].includes(window.location.protocol);
}

function assertRunnableApp() {
  if (!isRunnableProtocol()) {
    usingLocalFallback = true;
    setStatus('Demo mode: open with `php -S localhost:8000` to save check-ins to SQLite.', true);
  }
}

function emptyCheckins() {
  return { anu: null, varun: null };
}

function loadLocalCheckins() {
  const fallback = emptyCheckins();
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(localStorageKey) || '{}') };
  } catch {
    return fallback;
  }
}

function saveLocalCheckin(person, position) {
  const checkins = loadLocalCheckins();
  checkins[person] = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    checked_in_at: new Date().toISOString(),
  };
  localStorage.setItem(localStorageKey, JSON.stringify(checkins));
  return { checkins };
}

function initMap() {
  if (!window.L) {
    setStatus('The map library could not load. Please check your internet connection and refresh.', true);
    mapEl.classList.add('map-error');
    return;
  }

  map = L.map('map', {
    preferCanvas: true,
    worldCopyJump: true,
    zoomControl: true,
  }).setView([20, 0], 2);

  tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    updateWhenIdle: false,
    keepBuffer: 4,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  tileLayer.on('load', () => mapEl.classList.add('map-ready'));
  tileLayer.on('tileerror', () => setStatus('Some map tiles are slow to load, but check-ins will still work.', true));

  setTimeout(() => map.invalidateSize(), 150);
  window.addEventListener('resize', () => map.invalidateSize());
}

function milesBetween(a, b) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(Number(b.latitude) - Number(a.latitude));
  const dLon = toRadians(Number(b.longitude) - Number(a.longitude));
  const lat1 = toRadians(Number(a.latitude));
  const lat2 = toRadians(Number(b.latitude));
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

function isValidCheckin(checkin) {
  return checkin && Number.isFinite(Number(checkin.latitude)) && Number.isFinite(Number(checkin.longitude));
}

function renderMap(checkins) {
  if (!map) return;

  const valid = Object.entries(checkins).filter(([, checkin]) => isValidCheckin(checkin));

  valid.forEach(([key, checkin]) => {
    const latLng = [Number(checkin.latitude), Number(checkin.longitude)];
    const popup = `${people[key].label}<br>${new Date(checkin.checked_in_at).toLocaleString()}`;
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
    map.fitBounds(L.latLngBounds(points).pad(0.45), { maxZoom: 8, animate: true, duration: 0.7 });
  } else if (valid.length === 1) {
    const [, checkin] = valid[0];
    if (connectionLine) connectionLine.remove();
    connectionLine = null;
    map.setView([Number(checkin.latitude), Number(checkin.longitude)], 8, { animate: true });
    distanceEl.textContent = 'Waiting for one more heart';
    loveNoteEl.textContent = 'One pin is glowing; the other heart can check in whenever ready.';
  }

  const updated = valid.map(([key, c]) => `${people[key].label}: ${new Date(c.checked_in_at).toLocaleString()}`);
  updatedEl.textContent = updated.length ? `Latest check-ins — ${updated.join(' • ')}` : '';
  setTimeout(() => map.invalidateSize(), 50);
}

async function parseJsonResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text/html') || text.trim().startsWith('<')) {
    throw new Error('The PHP check-in API returned an HTML page instead of JSON. Serve this project with PHP, for example: `php -S localhost:8000`.');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The check-in API did not return valid JSON. Please confirm src/checkin.php is reachable.');
  }
}

async function loadCheckins() {
  assertRunnableApp();

  if (usingLocalFallback) {
    renderMap(loadLocalCheckins());
    return;
  }

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });
    const data = await parseJsonResponse(response);
    if (!response.ok) throw new Error(data.error || 'Could not load check-ins.');
    renderMap(data.checkins || emptyCheckins());
  } catch (error) {
    usingLocalFallback = true;
    renderMap(loadLocalCheckins());
    setStatus(`${error.message} Using this browser only until PHP is available.`, true);
  }
}

async function saveCheckin(person, position) {
  assertRunnableApp();

  if (usingLocalFallback) {
    return saveLocalCheckin(person, position);
  }
  const payload = {
    person,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) throw new Error(data.error || 'Could not save check-in.');
    return data;
  } catch (error) {
    usingLocalFallback = true;
    setStatus(`${error.message} Saving this check-in in this browser only.`, true);
    return saveLocalCheckin(person, position);
  }
}

function geolocationError(error) {
  if (error.code === error.PERMISSION_DENIED) return 'Location permission is needed to check in.';
  if (error.code === error.POSITION_UNAVAILABLE) return 'Your location is unavailable right now. Please try again.';
  if (error.code === error.TIMEOUT) return 'Location lookup timed out. Please try again.';
  return 'Could not read your location. Please try again.';
}

function checkIn(person) {
  try {
    assertRunnableApp();
  } catch (error) {
    setStatus(error.message, true);
    return;
  }

  if (!navigator.geolocation) {
    setStatus('This browser does not support location sharing.', true);
    return;
  }

  setStatus(`Finding ${people[person].label}'s spot on the love map...`);
  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const data = await saveCheckin(person, position);
      renderMap(data.checkins);
      const fallbackNote = usingLocalFallback ? ' (saved in this browser only)' : '';
      setStatus(`${people[person].label} checked in${fallbackNote}. Sending a tiny heart across the map!`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }, (error) => setStatus(geolocationError(error), true), {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 30000,
  });
}

document.querySelectorAll('.person-button').forEach((button) => {
  button.addEventListener('click', () => checkIn(button.dataset.person));
});

window.addEventListener('load', () => {
  initMap();
  loadCheckins().catch((error) => setStatus(error.message, true));
});
