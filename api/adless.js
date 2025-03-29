const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

module.exports = async function handler(request, response) {
  // Allowed origins for CORS
  const allowedOrigins = [
    'https://vanishgames.oragne.dev/'
  ];

  const origin = request.headers.origin;

  /*
  // Check if the origin is allowed
  if (!allowedOrigins.includes(origin)) {
    return response.status(403).send('Forbidden: Access is denied.');
  }*/

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', '*');
    return response.status(200).end(); // Respond with a 200 OK for OPTIONS request
  }

  // CORS headers for actual requests
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');

  // Get the URL from the query parameters
  let url = request.query.url;

  try {
    // Parse the URL to extract hostname
    const parsedUrl = new URL(url);
    const targetHost = parsedUrl.hostname;

    // Fetch the content from the external URL with a spoofed Host header
    const { status, data } = await getRequest(url, targetHost);

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
    response.status(500).json({ error: 'Error fetching or processing content' });
  }

  // Function to make the HTTPS request to fetch content with a spoofed Host header
  function getRequest(url, spoofedHost) {
    return new Promise(resolve => {
      const options = {
        headers: {
          'Host': spoofedHost, // Spoofed Host header
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      };

      const req = https.get(url, options, (resp) => {
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
};
