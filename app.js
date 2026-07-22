const APP_VERSION = '20260722-location-fix';

const people = {
  anu: { label: 'Anu', color: '#ff4f8b' },
  varun: { label: 'Varun', color: '#7c4dff' },
};

const statusEl = document.querySelector('#status');
const distanceEl = document.querySelector('#distance');
const loveNoteEl = document.querySelector('#love-note');
const updatedEl = document.querySelector('#last-updated');
const apiUrl = new URL('checkin.php', window.location.href);
const initialCenter = [20, 0];
const map = L.map('map', { worldCopyJump: true }).setView(initialCenter, 2);
let markers = {};
let connectionLine;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

window.addEventListener('resize', () => map.invalidateSize());

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

async function parseJsonResponse(response) {
  const body = await response.text();
  let data;

  try {
    data = body ? JSON.parse(body) : {};
  } catch (error) {
    const preview = body.trim().slice(0, 80) || 'empty response';
    throw new Error(`The check-in service returned ${response.status} ${response.statusText || 'response'} instead of JSON. Preview: ${preview}`);
  }

  if (!response.ok) {
    throw new Error(data.error || 'The check-in service could not complete the request.');
  }

  return data;
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  return parseJsonResponse(response);
}

async function loadCheckins() {
  const data = await requestJson(apiUrl);
  renderMap(data.checkins || {});
}

async function saveCheckin(person, position) {
  const payload = {
    person,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };

  const data = await requestJson(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return data;
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
    const data = await saveCheckin(person, position);
    renderMap(data.checkins || {});
    setStatus(`${people[person].label} checked in. Sending a tiny heart across the map!`);
  } catch (error) {
    setStatus(locationErrorMessage(error), true);
  }
}

document.querySelectorAll('.person-button').forEach((button) => {
  button.addEventListener('click', () => checkIn(button.dataset.person));
});

loadCheckins().catch((error) => setStatus(error.message || 'Ready when you are. First check-in will create the love map.', true));
