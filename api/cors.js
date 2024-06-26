export default async function handler(request, response) {
  const https = require('https');

  let url = request.query.url;

  const { status, data, contentType } = await getRequest(url);

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');

  if (status === 200) {
    if (contentType && contentType.startsWith('application/octet-stream')) {
      response.setHeader('Content-Type', contentType);
      response.setHeader('Content-Disposition', 'attachment');
    }
    response.status(status).send(data);
  } else {
    response.status(status).send({ error: 'Failed to fetch data' });
  }

  function getRequest(url) {
    return new Promise(resolve => {
      const req = https.get(url, (resp) => {
        let data = '';
        let contentType = resp.headers['content-type'];

        if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
          return resolve(getRequest(resp.headers.location));
        }

        if (contentType && contentType.startsWith('application/octet-stream')) {
          const chunks = [];
          resp.on('data', (chunk) => {
            chunks.push(chunk);
          });
          resp.on('end', () => {
            data = Buffer.concat(chunks);
            resolve({ status: resp.statusCode, data: data, contentType: contentType });
          });
        } else {
          resp.setEncoding('utf8');
          resp.on('data', (chunk) => {
            data += chunk;
          });
          resp.on('end', () => {
            resolve({ status: resp.statusCode, data: data, contentType: contentType });
          });
        }
      });

      req.on('error', (err) => {
        resolve({ status: 500, data: err.message });
      });

      req.end();
    });
  }
}
