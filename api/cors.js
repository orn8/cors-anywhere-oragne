export default async function handler(request, response) {
  const https = require('https');

  const allowedOrigins = [
    'https://vanishgames.oragne.dev'
  ];

  const origin = request.headers.origin;

  if (!allowedOrigins.includes(origin)) {
    return response.status(403).send('Forbidden: Access is denied.');
  }

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', '*');

  let query = Object.entries(request.query);
  query.shift();
  let url = request.query.url;

  query.forEach(entry => {
    url += '&' + entry[0] + '=' + entry[1];
  });

  const { status, data } = await getRequest(url);
  
  response.status(status).send(data);

  function getRequest(url) {
    return new Promise(resolve => {
      const req = https.get(url, (resp) => {
        let data = '';
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
    });
  }
}
