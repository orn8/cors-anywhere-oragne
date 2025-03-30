const axios = require('axios');
const cheerio = require('cheerio');
const { FiltersEngine, Request } = require('@ghostery/adblocker');

let engine;

// Initialise AdBlock Engine with EasyList and EasyPrivacy
async function initialiseAdBlocker() {
  try {
    console.log('Initialising AdBlocker...');
    engine = await FiltersEngine.fromLists(fetch, [
      'https://easylist.to/easylist/easylist.txt',
      'https://easylist.to/easylist/easyprivacy.txt'
    ]);
    console.log('AdBlocker initialised successfully.');
  } catch (error) {
    console.error('Error initialising AdBlocker:', error);
  }
}

initialiseAdBlocker();

module.exports = async function handler(request, response) {
  // Allowed origins for CORS
  const allowedOrigins = [
    'https://vanishgames.oragne.dev'
  ];

  console.log('Received request from:', request.headers.origin);

  // Get origin or referer or host
  const origin = request.headers.origin || request.headers.referer || request.headers.host || 'Unknown';
  
  // Normalise the origin by trimming any trailing slashes and converting to lowercase
  const normalisedOrigin = origin.replace(/\/$/, '').toLowerCase();
  console.log('Normalised origin:', normalisedOrigin);

  // Check if the normalised origin is allowed
  if (!allowedOrigins.includes(normalisedOrigin)) {
    console.log('Forbidden access attempt detected:', normalisedOrigin);
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
    console.log('Fetching URL:', url);

    // Parse the requested URL to get the base domain
    const parsedUrl = new URL(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

    // Fetch the content from the external URL using Axios
    const { status, data } = await axios.get(url, { timeout: 5000 }); // 5s timeout

    console.log(`Received response with status: ${status}`);
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

    console.log('Applying EasyList filters to remove ads...');
    
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

      console.log('Checking URL to block:', urlToCheck);

      const { match, redirect } = engine.match(requestDetails);

      if (match) {
        console.log(`Matched ad: ${urlToCheck}`);
        if (redirect) {
          $(el).attr('src', redirect); // Redirect ad request if necessary
          console.log(`Redirecting to: ${redirect}`);
        } else {
          $(el).remove(); // Remove blocked requests
          console.log('Removed ad element.');
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
      console.log('Injected cosmetics styles for hidden ads.');
    }

    // Set response headers and send the modified HTML back
    response.setHeader('Content-Type', 'text/html');
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    response.status(200).send($.html());

  } catch (error) {
    console.error('Error during request processing:', error);
    response.status(500).json({ error: 'Error fetching or processing content' });
  }
}
