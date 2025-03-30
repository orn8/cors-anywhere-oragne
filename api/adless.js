const axios = require('axios');
const cheerio = require('cheerio');
const { FiltersEngine, Request } = require('@ghostery/adblocker');

let engine;

// Initialise AdBlock Engine with EasyList and EasyPrivacy
async function initialiseAdBlocker() {
  engine = await FiltersEngine.fromLists(fetch, [
    'https://easylist.to/easylist/easylist.txt',
    'https://easylist.to/easylist/easyprivacy.txt'
  ]);
}

initialiseAdBlocker();

module.exports = async function handler(request, response) {
  // Allowed origins for CORS
  const allowedOrigins = [
    'https://vanishgames.oragne.dev'
  ];
  
  // Get origin or referer or host
  const origin = request.headers.origin || request.headers.referer || request.headers.host || 'Unknown';
  
  // Normalise the origin by trimming any trailing slashes and converting to lowercase
  const normalisedOrigin = origin.replace(/\/$/, '').toLowerCase();

  // Check if the normalised origin is allowed
  if (!allowedOrigins.includes(normalisedOrigin)) {
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

    // Add <base> tag only if one does not already exist
    if ($('base').length === 0) {
      $('head').prepend(`<base href="${baseUrl}/">`);
    }

    // Apply CSP Filtering
    const cspDirectives = engine.getCSPDirectives(Request.fromRawDetails({
      type: 'main_frame',
      url: url
    }));
    if (cspDirectives) {
      response.setHeader('Content-Security-Policy', cspDirectives.join('; '));
    }

    // Remove ads based on EasyList filters
    $('iframe, script, img, link, meta').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('href') || '';
      
      let urlToCheck = src;
      if (src.startsWith('//')) {
        urlToCheck = `${parsedUrl.protocol}${src}`; // Protocol-relative URL
      } else if (src.startsWith('/')) {
        urlToCheck = `${baseUrl}${src}`; // Relative URL
      }

      const requestDetails = Request.fromRawDetails({
        type: 'script',
        url: urlToCheck,
      });

      const { match, redirect } = engine.match(requestDetails);

      if (match) {
        if (redirect) {
          $(el).attr('src', redirect); // Redirect ad request if necessary
        } else {
          $(el).remove(); // Remove blocked requests
        }
      }
    });

    // Apply Cosmetic Filtering: Inject Styles for Hidden Ads
    const { styles } = engine.getCosmeticsFilters({
      url: parsedUrl.href,
      hostname: parsedUrl.hostname,
      domain: parsedUrl.hostname.replace(/^www\./, ''),
    });

    if (styles) {
      $('head').append(`<style>${styles}</style>`);
    }

    // Set response headers and send the modified HTML back
    response.setHeader('Content-Type', 'text/html');
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    response.status(200).send($.html());

  } catch (error) {
    response.status(500).json({ error: 'Error fetching or processing content' });
  }
}
