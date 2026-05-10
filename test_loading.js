const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => console.log('NETWORK ERROR:', request.url(), request.failure().errorText));

  await page.goto('file:///' + __dirname.replace(/\\/g, '/') + '/index.html', { waitUntil: 'networkidle0' });
  
  await browser.close();
})();
