export default async function handler(request, response) {
  const https = require('https');

  let url = request.query.url;

  const { status, data } = await getRequest(url);

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');
  
  if (status === 200) {
    response.status(status).send(data);
  } else {
    response.status(status).send({ error: 'Failed to fetch data' });
  }

  function getRequest(url) {
    return new Promise(resolve => {
      const req = https.get(url, (resp) => {
        let data = '';

        if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
          return resolve(getRequest(resp.headers.location));
        }

        const contentType = resp.headers['content-type'];
        if (!contentType || !contentType.startsWith('application/octet-stream')) {
          let errorData = '';
          resp.on('data', (chunk) => {
            errorData += chunk;
          });
          resp.on('end', () => {
            resolve({ status: resp.statusCode, data: errorData });
          });
        } else {
          resp.on('data', (chunk) => {
            data += chunk;
          });
          resp.on('end', () => {
            resolve({ status: resp.statusCode, data: data });
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
