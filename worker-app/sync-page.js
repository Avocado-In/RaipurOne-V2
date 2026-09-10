// The worker page has one home: backend/app/static/worker.html, which FastAPI serves at
// /worker. The Android build is a wrapper around that same file, so it is copied in
// rather than duplicated - editing two copies of a login screen is how they drift apart.
const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '..', 'backend', 'app', 'static', 'worker.html');
const target = path.resolve(__dirname, 'www', 'index.html');

if (!fs.existsSync(source)) {
  console.error(`Cannot find the worker page at ${source}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`Copied worker.html -> ${path.relative(process.cwd(), target)}`);
