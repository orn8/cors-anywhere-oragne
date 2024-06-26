export default async function handler(request, response) {
  const https = require('https');

  let url = request.query.url;

  try {
    const { status, data, contentType } = await getRequest(url);

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', '*');
    response.setHeader('Content-Type', contentType);
    response.status(status);

    if (contentType && contentType.startsWith('application')) {
      response.setHeader('Content-Disposition', 'attachment');
    }

    response.send(data);
  } catch (error) {
    console.error('Error fetching data:', error.message);
    response.status(500).send('Error fetching data');
  }

  function getRequest(url) {
    return new Promise((resolve, reject) => {
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
        reject(new Error(`Request failed: ${err.message}`));
      });

      req.end();
    });
  }
}
