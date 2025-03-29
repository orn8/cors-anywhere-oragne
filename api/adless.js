import axios from 'axios';
import cheerio from 'cheerio';

export default async function handler(request, response) {
  const https = require('https');

  // Allowed origins for CORS
  const allowedOrigins = [
    'https://vanishgames.oragne.dev'
  ];

  const origin = request.headers.origin;

  // Debugging: Log the incoming request's origin
  console.log("Request Origin:", origin);
/*
  // Check if the origin is allowed
  if (!allowedOrigins.includes(origin)) {
    console.log('Forbidden: Origin not allowed:', origin);
    return response.status(403).send('Forbidden: Access is denied.');
  }
*/
  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    console.log('Handling preflight OPTIONS request');
    response.setHeader('Access-Control-Allow-Origin', *);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', '*');
    return response.status(200).end(); // Respond with a 200 OK for OPTIONS request
  }

  // CORS headers for actual requests
  response.setHeader('Access-Control-Allow-Origin', *);
  response.setHeader('Access-Control-Allow-Headers', '*');

  // Get the URL from the query parameters
  let url = request.query.url;

  try {
    // Fetch the content from the external URL
    const { status, data } = await getRequest(url);

    // Debugging: Log the status of the response from the external URL
    console.log("External Request Status:", status);

    if (status !== 200) {
      return response.status(status).send(data);
    }

    // Remove ads using cheerio
    const $ = cheerio.load(data);

    // Remove iframe elements that contain 'ads' in the src URL
    $('iframe').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('ads')) {
        $(el).remove(); // Remove iframe with 'ads' in the src
      }
    });

    // Remove script elements related to ads
    $('script').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('ads')) {
        $(el).remove(); // Remove script tag with 'ads' in the src
      }
    });

    // Remove specific ad classes or elements
    $('.ad-class, .ads').each((i, el) => {
      $(el).remove(); // Remove elements with these ad classes
    });

    // Send back the modified HTML with ads removed
    response.setHeader('Content-Type', 'text/html');
    response.status(200).send($.html());

  } catch (error) {
    // Log the error for debugging
    console.error("Error during request or processing:", error);
    response.status(500).json({ error: 'Error fetching or processing content' });
  }

  // Function to make the HTTPS request to fetch content
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
