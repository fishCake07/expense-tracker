const fs = require('fs');
const assert = require('assert');
const { execSync } = require('child_process');

console.log("--- Starting PWA Auth & Sync Client Integration Tests ---");

// 1. Validate Syntax of auth-sync.js
execSync('node -c ' + __dirname + '/../auth-sync.js');
console.log("✓ Test 1 Passed: auth-sync.js passes JavaScript syntax validation.");

// 2. Validate HTML Elements
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const requiredAuthIds = [
  'sync-status-pill',
  'sync-status-label',
  'settings-open-auth-btn',
  'auth-account-dialog',
  'close-auth-modal-btn',
  'auth-unauthenticated-view',
  'auth-authenticated-view',
  'auth-tab-login',
  'auth-tab-register',
  'auth-form-login',
  'auth-form-register',
  'login-email',
  'login-password',
  'register-email',
  'register-password',
  'register-import-local',
  'auth-user-email',
  'auth-sync-now-btn',
  'auth-export-cloud-btn',
  'auth-logout-btn',
  'auth-delete-account-btn'
];

requiredAuthIds.forEach(id => {
  assert(html.includes(`id="${id}"`), `HTML missing required Auth/Sync ID: ${id}`);
});
console.log("✓ Test 2 Passed: All required Auth, Sync, and Account Dialog DOM elements exist in index.html.");

// 3. Validate Service Worker caching of auth-sync.js
const swContent = fs.readFileSync(__dirname + '/../sw.js', 'utf8');
assert(swContent.includes('"./auth-sync.js?v=82"'), 'sw.js must cache auth-sync.js?v=82');
assert(swContent.includes('/api/'), 'sw.js must bypass caching for /api/ network requests');
console.log("✓ Test 3 Passed: Service worker caches auth-sync.js and bypasses /api/ requests.");

// 4. Validate Universal Backdrop Dismissal in auth-sync.js
const authSyncContent = fs.readFileSync(__dirname + '/../auth-sync.js', 'utf8');
assert(authSyncContent.includes('if (e.target === authModal) {'), 'auth-sync.js must implement universal backdrop dismissal checking e.target === authModal');
console.log("✓ Test 4 Passed: auth-sync.js implements safe universal backdrop dismissal.");

console.log("All PWA Auth & Sync Client Integration tests passed successfully!");
