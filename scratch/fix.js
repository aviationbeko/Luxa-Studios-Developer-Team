fetch('https://lsdt-v2.onrender.com/api/announcements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'SYSTEM_UPDATE_CONFIG', text: 'OFF|test.com' })
}).then(r => r.json()).then(console.log).catch(console.error);
