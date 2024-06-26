export default async function handler(request, response) {
  const https = require('https');

  let url = request.query.url;

  const { status, data, contentType } = await getRequest(url);

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');
  
  if (contentType && contentType.startsWith('text/html')) {
    data = stripHtmlTags(data);
  }

  response.status(status).send(data);

  function getRequest(url) {
    return new Promise(resolve => {
      const req = https.get(url, (resp) => {
        let data = '';
        let contentType = resp.headers['content-type'];

        resp.on('data', (chunk) => {
          data += chunk;
        });
        resp.on('end', () => {
          resolve({ status: resp.statusCode, data: data, contentType: contentType });
        });
      });

      req.on('error', (err) => {
        resolve({ status: 500, data: err.message, contentType: null });
      });

      req.end();
    }); 
  }

  function stripHtmlTags(html) {
    return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>?/gi, '');
  }
}
