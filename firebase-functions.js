// firebase-functions.js

import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyA9xhz3pmPtkN5TZsIDhoy1YEL1TkvZGwk",
  authDomain: "geotrackerapp-98374.firebaseapp.com",
  projectId: "geotrackerapp-98374",
  storageBucket: "geotrackerapp-98374.appspot.com",
  messagingSenderId: "1015759702697",
  appId: "1:1015759702697:web:ae7c60b5d59e0991b9b7b8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let map;
let markers = {};
let currentFamilyId = null;
let myUserId = null;
let watchId = null;

window.initMap = function () {
  map = L.map('map').setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
};

window.requestLocationPermission = function () {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      shareMyLocation(position);
      autoUpdateLocation();
    }, () => {
      updateGeoStatus('Permission denied', 'denied');
    });
  } else {
    updateGeoStatus('Geolocation not supported', 'error');
  }
};

function updateGeoStatus(message, type) {
  const geoStatus = document.getElementById('geoStatus');
  geoStatus.textContent = message;
  geoStatus.className = `geo-status ${type}`;
}

function autoUpdateLocation() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(shareMyLocation, () => {
    updateSyncStatus('Unable to update location', 'error');
  }, { enableHighAccuracy: true, maximumAge: 10000 });
}

function updateSyncStatus(message, type = 'success') {
  const statusEl = document.getElementById('syncStatus');
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-triangle',
    syncing: 'fas fa-sync-alt fa-spin'
  };
  statusEl.innerHTML = `<i class="${icons[type]}"></i> ${message}`;
  statusEl.className = `sync-status ${type === 'success' ? '' : type}`;
}

function updateFirebaseStatus(message, type = 'success') {
  const statusEl = document.getElementById('firebaseStatus');
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-triangle',
    connecting: 'fas fa-spinner fa-spin'
  };
  statusEl.innerHTML = `<i class="${icons[type]}"></i> ${message}`;
  statusEl.className = `firebase-status ${type === 'success' ? '' : type}`;
}

window.checkForFamilyJoin = async function () {
  const params = new URLSearchParams(window.location.search);
  const joinId = params.get('join');
  myUserId = crypto.randomUUID();
  if (joinId) {
    currentFamilyId = joinId;
    document.getElementById('joinSection').classList.add('show');
  } else {
    currentFamilyId = 'family_' + Date.now();
    await createFamilyGroup(currentFamilyId);
    const userData = generateUserData('You');
    await joinFamilyGroup(currentFamilyId, userData);
    setupRealtimeSync();
  }
};

async function createFamilyGroup(familyId) {
  await setDoc(doc(db, 'families', familyId), {
    createdAt: serverTimestamp()
  });
  updateFirebaseStatus('Family group created');
}

async function joinFamilyGroup(familyId, memberData) {
  await setDoc(doc(db, 'families', familyId, 'members', myUserId), memberData);
  updateFirebaseStatus('Joined family group');
}

function generateUserData(name) {
  const colorPalette = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#a29bfe'];
  const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase();
  const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
  return {
    name,
    avatar,
    color,
    status: 'online',
    lastSeen: new Date().toISOString(),
    location: null
  };
}

window.joinFamily = async function () {
  const input = document.getElementById('joinNameInput');
  const name = input.value.trim();
  if (!name) return alert('Enter a name');
  const data = generateUserData(name);
  await joinFamilyGroup(currentFamilyId, data);
  document.getElementById('joinSection').classList.remove('show');
  shareMyLocation();
  setupRealtimeSync();
};

window.shareMyLocation = function (position) {
  if (!position) {
    navigator.geolocation.getCurrentPosition(shareMyLocation);
    return;
  }

  const coords = position.coords;
  const loc = {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy
  };

  updateDoc(doc(db, 'families', currentFamilyId, 'members', myUserId), {
    location: loc,
    lastSeen: new Date().toISOString(),
    status: 'online'
  });
};

window.clearMyLocation = function () {
  updateDoc(doc(db, 'families', currentFamilyId, 'members', myUserId), {
    location: null,
    status: 'offline'
  });
};

window.showShareModal = function () {
  const shareUrl = `${window.location.origin}${window.location.pathname}?join=${currentFamilyId}`;
  document.getElementById('shareLink').textContent = shareUrl;
  document.getElementById('shareModal').style.display = 'block';
};

window.closeShareModal = function () {
  document.getElementById('shareModal').style.display = 'none';
};

window.copyShareLink = function () {
  const link = document.getElementById('shareLink').textContent;
  navigator.clipboard.writeText(link).then(() => alert('Copied!'));
};

function setupRealtimeSync() {
  const colRef = collection(db, 'families', currentFamilyId, 'members');
  onSnapshot(colRef, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      const data = change.doc.data();
      const id = change.doc.id;
      if (!data.location) return;

      if (!markers[id]) {
        const marker = L.marker([data.location.lat, data.location.lng]).addTo(map);
        marker.bindPopup(`<b>${data.name}</b><br>${data.status}`);
        markers[id] = marker;
      } else {
        markers[id].setLatLng([data.location.lat, data.location.lng]);
      }
    });
  });
}