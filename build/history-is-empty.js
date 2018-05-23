const fs = require('fs');
const path = require('path');

if (fs.readFileSync(path.join(__dirname, '..', 'recent', 'history.txt')).toString().trim().length > 0) {
  console.error('history file should be empty');
  process.exit(1);
}
