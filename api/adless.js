const axios = require('axios');
const cheerio = require('cheerio');

// EasyList filter URL
const EASYLIST_URL = 'https://easylist.to/easylist/easylist.txt';

// Helper function to fetch EasyList rules
async function fetchEasyList() {
  try {
    const { data } = await axios.get(EASYLIST_URL, { timeout: 5000 });
    return data.split('\n').filter(line => line && !line.startsWith('!')); // Remove comments and empty lines
  } catch (error) {
    console.error('Error fetching EasyList:', error);
    return [];
  }
}

// Function to check if a URL matches any EasyList rule
function matchesEasyList(url, easyList) {
  // Loop through each EasyList rule
  for (const rule of easyList) {
    // Simple wildcard match (e.g., *.google.com matches google.com)
    const regex = new RegExp(rule.replace(/\*/g, '.*').replace(/\./g, '\\.'));
    if (regex.test(url)) {
      return true;
    }
  }
  return false;
}

// Function to check if an element is an ad element (by domain or class)
function isAdElement(url, easyList) {
  return matchesEasyList(url, easyList);
}

module.exports = async function handler(request, response) {
  // Allowed origins for CORS
  const allowedOrigins = [
    'https://vanishgames.oragne.dev'
  ];

  // Get origin or referer or host
  const origin = request.headers.origin || request.headers.referer || request.headers.host || 'Unknown';

  // Normalise the origin by trimming any trailing slashes and converting to lowercase
  const normalisedOrigin = origin.replace(/\/$/, '').toLowerCase();

  // Check if the normalized origin is allowed
  if (!allowedOrigins.some(allowedOrigin => allowedOrigin.toLowerCase() === normalisedOrigin)) {
    return response.status(403).send('Forbidden: Access is denied.');
  }

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', '*');
    return response.status(200).end(); // Respond with a 200 OK for OPTIONS request
  }

  // CORS headers for actual requests
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', '*');

  // Get the URL from the query parameters
  let url = request.query.url;

  try {
    // Fetch the EasyList rules
    const easyList = await fetchEasyList();

    // Parse the requested URL to get the base domain
    const parsedUrl = new URL(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

    // Fetch the content from the external URL using Axios
    const { status, data } = await axios.get(url, { timeout: 5000 }); // 5s timeout

    if (status !== 200) {
      return response.status(status).send(data);
    }

    // Load HTML content using Cheerio
    const $ = cheerio.load(data);

    // Fix relative URLs (for images, scripts, styles, etc.)
    $('img, script, link, iframe, object, embed').each((i, el) => {
      const attrName = $(el).attr('src') ? 'src' : $(el).attr('href') ? 'href' : 'data';
      const attrValue = $(el).attr(attrName);

      if (attrValue) {
        if (attrValue.startsWith('/')) {
          // Convert relative URL to absolute
          const newUrl = baseUrl + attrValue;
          $(el).attr(attrName, newUrl);
        } else if (attrValue.startsWith('//')) {
          // Handle protocol-relative URLs
          const newUrl = parsedUrl.protocol + attrValue; // Use the same protocol as the current page
          $(el).attr(attrName, newUrl);
        }

        // Check if the URL matches any EasyList rule (block ads)
        if (isAdElement(attrValue, easyList)) {
          $(el).remove(); // Remove ad elements matching EasyList rules
        }
      }
    });

    // Fix inline CSS for asset paths (like images, fonts)
    $('style').each((i, el) => {
      let css = $(el).html();
      css = css.replace(/url\(['"]?(\/[^)'"]+)['"]?\)/g, `url(${baseUrl}$1)`); // Normalize URLs in CSS
      $(el).html(css);
    });

    // Set response headers and send the modified HTML back
    response.setHeader('Content-Type', 'text/html');
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    response.status(200).send($.html());

  } catch (error) {
    response.status(500).json({ error: 'Error fetching or processing content' });
  }
};
