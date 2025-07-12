/*
 * Modern OSLC Client using fetch API with credentials: "include"
 * This replaces the old request.js-based OSLCServer implementation
 */

// Import rdflib from the existing oslc-client package
const rdflib = require('rdflib');

// Import namespace definitions to maintain compatibility
require('oslc-client/namespaces');

// Import existing classes for compatibility
const OSLCResource = require('oslc-client/OSLCResource');
const Compact = require('oslc-client/Compact');

/**
 * Modern OSLC Client using fetch API
 */
class OSLCClient {
  constructor(serverURI, userId, password) {
    this.serverURI = serverURI;
    this.userId = userId;
    this.password = password;

    // Default headers for OSLC requests
    this.defaultHeaders = {
      'Accept': 'application/rdf+xml;q=0.9,text/turtle;q=0.8',
      'OSLC-Core-Version': '2.0'
    };
  }

  /**
   * Get cookie value from browser
   */
  getCookie(key) {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [cookieName, cookieValue] = cookie.split('=').map(s => s.trim());
        if (cookieName === key) {
          return cookieValue;
        }
      }
    }
    return null;
  }

  // Function to check if hostname is local
  isLocalHostname(hostname) {
    // Check for localhost variations
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    // Check for .local domains
    if (hostname.endsWith('.local')) {
      return true;
    }

    // Check for private IP ranges (IPv4)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = hostname.match(ipv4Regex);
    if (ipv4Match) {
      const [, a, b, c, d] = ipv4Match.map(Number);

      // Private IP ranges:
      // 10.0.0.0/8 (10.0.0.0 to 10.255.255.255)
      // 172.16.0.0/12 (172.16.0.0 to 172.31.255.255)
      // 192.168.0.0/16 (192.168.0.0 to 192.168.255.255)
      // 169.254.0.0/16 (169.254.0.0 to 169.254.255.255) - link-local
      if (a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254)) {
        return true;
      }
    }

    // Check for IPv6 private/local addresses
    if (hostname.includes(':')) {
      const lowerHostname = hostname.toLowerCase();
      // Link-local addresses (fe80::/10)
      if (lowerHostname.startsWith('fe80:') || lowerHostname.startsWith('fe8') ||
        lowerHostname.startsWith('fe9') || lowerHostname.startsWith('fea') ||
        lowerHostname.startsWith('feb')) {
        return true;
      }
      // Unique local addresses (fc00::/7)
      if (lowerHostname.startsWith('fc') || lowerHostname.startsWith('fd')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Modern fetch with authentication handling
   */
  async authGet(options, callback) {
    let uri = (typeof options === "string") ? options : options.uri;

    try {
      const url = new URL(uri);

      if (url.protocol === 'http:' && !this.isLocalHostname(url.hostname)) {
        // Upgrade HTTP to HTTPS for non-local hostnames
        url.protocol = 'https:';
        uri = url.toString();
      }
    } catch (error) {
      // If URL parsing fails, use the original URI
      console.warn('Failed to parse URI for protocol upgrade:', error);
    }

    // Build fetch options with credentials included
    const fetchOptions = {
      method: 'GET',
      credentials: 'include',  // Include cookies and handle CORS auth
      headers: {
        ...this.defaultHeaders,
        ...(typeof options === "object" && options.headers ? options.headers : {})
      }
    };

    try {
      const response = await fetch(uri, fetchOptions);
      const body = await response.text();

      // Create a response object compatible with the original request library
      const mockResponse = createMockResponseFrom(response);

      if (mockResponse.headers['x-com-ibm-team-repository-web-auth-msg'] === 'authrequired') {
        // JEE Form base authentication
        const formData = new URLSearchParams();
        formData.append('j_username', this.userId);
        formData.append('j_password', this.password);

        // Extract base server URL for authentication endpoint
        const baseURL = new URL(uri).origin;
        const authURL = baseURL + '/j_security_check';

        const authResponse = await fetch(authURL, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData
        });

        const authBody = await authResponse.text();
        const authMockResponse = {
          statusCode: authResponse.status,
          headers: {}
        };

        authResponse.headers.forEach((value, key) => {
          authMockResponse.headers[key.toLowerCase()] = value;
        });

        callback(null, authMockResponse, authBody);
      } else if (mockResponse.headers['www-authenticate']) {
        // OpenIDConnect authentication (using Jazz Authentication Server)
        // Create Basic Auth header
        const credentials = btoa(this.userId + ':' + this.password);
        const authFetchOptions = {
          ...fetchOptions,
          headers: {
            ...fetchOptions.headers,
            'Authorization': 'Basic ' + credentials
          }
        };

        const authResponse = await fetch(uri, authFetchOptions);
        const authBody = await authResponse.text();
        const authMockResponse = {
          statusCode: authResponse.status,
          headers: {}
        };

        authResponse.headers.forEach((value, key) => {
          authMockResponse.headers[key.toLowerCase()] = value;
        });

        callback(null, authMockResponse, authBody);
      } else {
        callback(null, mockResponse, body);
      }
    }
    catch (error) {
      // Check if the error is CORS-related
      if (error.name === 'TypeError' &&
        (error.message.includes('CORS') ||
          error.message.includes('Cross-Origin') ||
          error.message.includes('fetch') ||
          error.message.includes('Network request failed'))) {

        console.warn('CORS error detected, retrying with CORS proxy:', error.message);

        try {
          // Retry with CORS proxy and omit credentials
          // seems dead, at least for RDF
          // const corsProxyUrl = `https://crossorigin.me/${uri}`;
          // 406 on RDF requests
          // const corsProxyUrl = `https://api.cors.lol/?url=${uri}`;
          // many 502s
          // const corsProxyUrl = `https://everyorigin.jwvbremen.nl/get?url=${uri}`;
          // works sometimes but seems to fail on fetching large TTLs
          const corsProxyUrl = `https://cors-anywhere.com/${uri}`;
          const corsOptions = {
            ...fetchOptions,
            credentials: 'omit'  // Remove credentials for CORS proxy
          };

          const corsResponse = await fetch(corsProxyUrl, corsOptions);
          const body = await corsResponse.text();

          // Create a response object compatible with the original request library
          const mockResponse = createMockResponseFrom(corsResponse);

          callback(null, mockResponse, body);
        } catch (corsError) {
          console.error('CORS proxy request also failed:', corsError);
          // throw corsError;
        }
      } else {
        callback(error, null, null);
      }
    }

    function createMockResponseFrom(response) {
      const mockResponse = {
        statusCode: response.status,
        headers: {}
      };

      // Convert Headers object to plain object
      response.headers.forEach((value, key) => {
        mockResponse.headers[key.toLowerCase()] = value;
      });
      return mockResponse;
    }
  }

  /**
   * Read an OSLC resource
   */
  read(res, callback) {
    let uri = (typeof res === "string") ? res : res.uri;

    // GET the OSLC resource and convert it to a JavaScript object
    this.authGet(res, function gotResult(err, response, body) {
      if (err || response.statusCode !== 200) {
        let code = err ? 500 : response.statusCode;
        callback(code, null);
        return;
      }

      if (response.headers['x-com-ibm-team-repository-web-auth-msg'] === 'authfailed') {
        callback(401, null);
        return;
      }

      try {
        var kb = new rdflib.IndexedFormula();

        if (response.headers['content-type'] && response.headers['content-type'].startsWith('text/turtle') || uri.endsWith('.ttl')) {
          rdflib.parse(body, kb, uri, 'text/turtle');
        } else {
          rdflib.parse(body, kb, uri, 'application/rdf+xml');
        }

        var results = null;

        if (response.headers['content-type'] && response.headers['content-type'].startsWith('application/x-oslc-compact+xml')) {
          results = new Compact(uri, kb);
        } else {
          results = new OSLCResource(uri, kb);
        }

        results.etag = response.headers['etag'];
        callback(null, results);
      } catch (parseError) {
        console.error('Error parsing RDF:', parseError);
        callback(500, null);
      }
    });
  }

  /**
   * Query OSLC resources - basic implementation
   */
  query(options, callback) {
    // For now, implement a basic query that just reads the resource
    // This can be expanded based on specific OSLC query requirements
    this.read(options.from, callback);
  }

  /**
   * Create a new OSLC resource
   */
  create(resourceType, resource, callback) {
    // Placeholder implementation - would need specific creation factory endpoints
    callback(new Error('Create operation not implemented in this client version'), null);
  }

  /**
   * Update an OSLC resource
   */
  update(resource, callback) {
    // Placeholder implementation - would need PUT operation
    callback(new Error('Update operation not implemented in this client version'));
  }

  /**
   * Delete an OSLC resource
   */
  delete(uri, callback) {
    // Placeholder implementation - would need DELETE operation
    callback(new Error('Delete operation not implemented in this client version'));
  }
}

export { OSLCClient };
export default OSLCClient;
