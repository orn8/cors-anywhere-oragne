const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async function handler(request, response) {
  // Allowed origins for CORS
  const allowedOrigins = ['https://vanishgames.oragne.dev'];

  // Get origin or referer or host and normalize
  const origin = (request.headers.origin || request.headers.referer || request.headers.host || 'Unknown').replace(/\/$/, '').toLowerCase();

  // Check if origin is allowed
  if (!allowedOrigins.some(allowedOrigin => allowedOrigin.toLowerCase() === origin)) {
    return response.status(403).send('Forbidden: Access is denied.');
  }

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', '*');
    return response.status(200).end();
  }

  // Set CORS headers for actual requests
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', '*');

  // Get URL from query
  let url = request.query.url;

  try {
    const parsedUrl = new URL(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

    // Fetch content from URL
    const { status, data } = await axios.get(url, { timeout: 5000 });

    if (status !== 200) {
      return response.status(status).send(data);
    }

    // Load HTML content using Cheerio
    const $ = cheerio.load(data);

    // Normalise all elements with relevant attributes
    const normaliseUrl = (el, attr) => {
      const attrValue = $(el).attr(attr);
      if (attrValue) {
        if (attrValue.startsWith('/')) {
          $(el).attr(attr, baseUrl + attrValue);
        } else if (attrValue.startsWith('//')) {
          $(el).attr(attr, parsedUrl.protocol + attrValue);
        }
      }
    };

    // Normalise common attributes in all relevant elements
    $('img, script, link, iframe, a, form, style, input, object, video, audio, source, embed, picture, noscript, param, base, meta').each((i, el) => {
      ['src', 'href', 'action', 'data-src', 'poster', 'data', 'background', 'srcset', 'type', 'value', 'content'].forEach(attr => normaliseUrl(el, attr));

      // Special handling for <object>, <embed>, <param> elements
      if ($(el).is('object') || $(el).is('embed') || $(el).is('param')) {
        const attrValue = $(el).attr('data') || $(el).attr('src') || $(el).attr('value');
        if (attrValue && attrValue.startsWith('/')) {
          $(el).attr($(el).is('object') ? 'data' : $(el).is('embed') ? 'src' : 'value', baseUrl + attrValue);
        }
      }
    });

    // Remove ads (iframe, script, and known ad classes)
    $('iframe, script').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('ads')) $(el).remove();
    });
    $('.ad-class, .ads').remove();

    // Normalise inline CSS URLs
    $('style').each((i, el) => {
      let css = $(el).html();
      css = css.replace(/url\(['"]?(\/[^)'"]+)['"]?\)/g, `url(${baseUrl}$1)`);
      $(el).html(css);
    });

    // Return the normalised HTML
    response.setHeader('Content-Type', 'text/html');
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    response.status(200).send($.html());

  } catch (error) {
    response.status(500).json({ error: 'Error fetching or processing content' });
  }
};
