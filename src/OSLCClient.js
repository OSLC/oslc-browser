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
      'Accept': 'application/rdf+xml',
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

  /**
   * Modern fetch with authentication handling
   */
  async authGet(options, callback) {
    const uri = (typeof options === "string") ? options : options.uri;
    
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
      const mockResponse = {
        statusCode: response.status,
        headers: {}
      };
      
      // Convert Headers object to plain object
      response.headers.forEach((value, key) => {
        mockResponse.headers[key.toLowerCase()] = value;
      });

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
    } catch (error) {
      callback(error, null, null);
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
        rdflib.parse(body, kb, uri, 'application/rdf+xml');
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
