const people = {
  anu: { label: 'Anu', color: '#ff4f8b' },
  varun: { label: 'Varun', color: '#7c4dff' },
};

const statusEl = document.querySelector('#status');
const distanceEl = document.querySelector('#distance');
const loveNoteEl = document.querySelector('#love-note');
const updatedEl = document.querySelector('#last-updated');
const map = L.map('map', { worldCopyJump: true }).setView([20, 0], 2);
let markers = {};
let connectionLine;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

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

function renderMap(checkins) {
  const valid = Object.entries(checkins).filter(([, c]) => c && Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude)));

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
    const bounds = L.latLngBounds(points).pad(0.45);
    map.fitBounds(bounds, { maxZoom: 8, animate: true });
  } else if (valid.length === 1) {
    const [, checkin] = valid[0];
    map.setView([Number(checkin.latitude), Number(checkin.longitude)], 8);
    distanceEl.textContent = 'Waiting for one more heart';
    loveNoteEl.textContent = 'One pin is glowing; the other heart can check in whenever ready.';
  }

  const updated = valid.map(([key, c]) => `${people[key].label}: ${new Date(c.checked_in_at).toLocaleString()}`);
  updatedEl.textContent = updated.length ? `Latest check-ins — ${updated.join(' • ')}` : '';
}

async function loadCheckins() {
  const response = await fetch('src/checkin.php');
  if (!response.ok) throw new Error('Could not load check-ins.');
  const data = await response.json();
  renderMap(data.checkins || {});
}

async function saveCheckin(person, position) {
  const payload = {
    person,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
  const response = await fetch('src/checkin.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not save check-in.');
  return data;
}

function checkIn(person) {
  if (!navigator.geolocation) {
    setStatus('This browser does not support location sharing.', true);
    return;
  }

  setStatus(`Finding ${people[person].label}'s spot on the love map...`);
  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const data = await saveCheckin(person, position);
      renderMap(data.checkins);
      setStatus(`${people[person].label} checked in. Sending a tiny heart across the map!`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }, () => setStatus('Location permission is needed to check in.', true), {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 60000,
  });
}

document.querySelectorAll('.person-button').forEach((button) => {
  button.addEventListener('click', () => checkIn(button.dataset.person));
});

loadCheckins().catch(() => setStatus('Ready when you are. First check-in will create the love map.'));
