declare module 'oslc-client' {
  export interface OSLCResource {
    '@id'?: string;
    '@type'?: string | string[];
    'dcterms:title'?: string;
    'dcterms:description'?: string;
    [key: string]: any;
  }

  export interface OSLCServiceProvider extends OSLCResource {
    title?: string;
    name?: string;
  }

  export interface OSLCClientOptions {
    baseUrl: string;
    auth: {
      user: string;
      password: string;
    };
  }

  export default class OSLCClient {
    constructor(options: OSLCClientOptions);
    
    getServiceProviders(): Promise<OSLCServiceProvider[]>;
    getResourceChildren(resourceId: string): Promise<OSLCResource[]>;
    getResource(resourceId: string): Promise<OSLCResource>;
  }
}
