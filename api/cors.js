export default async function handler(request, response) {
  const https = require('https');

  let url = request.query.url;

  const { status, data, contentType } = await getRequest(url);

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');
  response.setHeader('Content-Type', contentType);
  response.status(status);

  if (contentType && contentType.startsWith('application')) {
    response.setHeader('Content-Disposition', 'attachment');
  }

  response.send(data);

  function getRequest(url) {
    return new Promise(resolve => {
      const req = https.get(url, (resp) => {
        const contentType = resp.headers['content-type'];
        let data = Buffer.alloc(0);

        resp.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
        });

        resp.on('end', () => {
          resolve({ status: resp.statusCode, data: data, contentType: contentType });
        });
      });

      req.on('error', (err) => {
        resolve({ status: 500, data: err.message, contentType: 'text/plain' });
      });

      req.end();
    }); 
  }
}
