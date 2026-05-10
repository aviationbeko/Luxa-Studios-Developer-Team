const https = require('https');
https.get('https://api.github.com/repos/aviationbeko/Luxa-Studios-Developer-Team/actions/runs/25578962592/jobs', {
    headers: { 'User-Agent': 'Node.js' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const jobs = JSON.parse(data).jobs;
        const failed = jobs.find(j => j.conclusion === 'failure');
        if (failed) {
            console.log('Failed job:', failed.name, failed.id);
            https.get(failed.url + '/logs', { headers: { 'User-Agent': 'Node.js', 'Accept': 'application/vnd.github.v3+json' } }, res2 => {
                 if(res2.statusCode === 302) {
                     https.get(res2.headers.location, {headers: {'User-Agent': 'Node.js'}}, res3 => {
                         let log = '';
                         res3.on('data', c => log += c);
                         res3.on('end', () => console.log(log.substring(log.length - 2000)));
                     });
                 }
            });
        }
    });
});
