const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json'));
pkg.main = 'electron-main.js';
pkg.build = {
  appId: 'com.lsdt.app',
  win: {
    target: 'nsis',
    icon: 'www/icon.png'
  },
  directories: {
    output: 'build_output'
  }
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
