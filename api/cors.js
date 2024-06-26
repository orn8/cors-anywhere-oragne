export default async function handler(request, response) {
  const https = require('https');

  let url = request.query.url;

  const { status, data } = await getRequest(url);

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');
  response.status(status).send(data);

  function getRequest(url) {
    return new Promise(resolve => {
      const req = https.get(url, (resp) => {
        let data = '';

        if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
          return resolve(getRequest(resp.headers.location));
        }

        resp.on('data', (chunk) => {
          data += chunk;
        });
        resp.on('end', () => {
          resolve({ status: resp.statusCode, data: data });
        });
      });

      req.on('error', (err) => {
        resolve({ status: 500, data: err.message });
      });

      req.end();
    }); 
  }
}
