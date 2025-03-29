export default async function handler(request, response) {
  const https = require('https');

  // Allowed origins for CORS
  const allowedOrigins = [
    'https://vanishgames.oragne.dev'
  ];
  
  const origin = request.headers.origin;

  // Check if origin is allowed
  if (!allowedOrigins.includes(origin)) {
    return response.status(403).send('Forbidden: Access is denied.');
  }

  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');

  // Build the final URL with query parameters
  let query = Object.entries(request.query);
  query.shift();
  let url = request.query.url;
  query.forEach(entry => {
    url += '&' + entry[0] + '=' + entry[1];
  });

  // Fetch data from the external URL
  const { status, data } = await getRequest(url);

  // Send the response with fetched data
  response.status(status).send(data);

  // Function to make an HTTPS request and return the data
  function getRequest(url) {
    return new Promise(resolve => {
      const req = https.get(url, (resp) => {
        let data = '';
        resp.on('data', chunk => { data += chunk; });
        resp.on('end', () => { resolve({ status: resp.statusCode, data }); });
      });
      req.on('error', (err) => { resolve({ status: 500, data: err.message }); });
    });
  }
}
