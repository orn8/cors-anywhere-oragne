import axios from 'axios';
import cheerio from 'cheerio';

export default async function handler(request, response) {
  const https = require('https');

  // Allowed origins for CORS
  const allowedOrigins = [
    'https://vanishgames.oragne.dev'
  ];

  const origin = request.headers.origin;

  // Check if the origin is allowed
    /*
  if (!allowedOrigins.includes(origin)) {
    return response.status(403).send('Forbidden: Access is denied.');
  }
*/
  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', '*');

  // Get the URL from the query parameters
  let url = request.query.url;

  try {
    // Fetch the content from the external URL
    const { status, data } = await getRequest(url);

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
    console.error(error);
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
