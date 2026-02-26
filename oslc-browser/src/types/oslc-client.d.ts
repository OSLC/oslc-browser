declare module 'oslc-client' {
  export interface OutgoingLink {
    sourceURL: string;
    linkType: string;
    targetURL: string;
  }

  export class OSLCResource {
    uri: { value: string };
    store: any;
    etag?: string;

    getURI(): string;
    get(property: string | object): string | string[] | undefined;
    set(property: string | object, value: any): void;
    getIdentifier(): string | undefined;
    getTitle(): string | undefined;
    getShortTitle(): string | undefined;
    getDescription(): string | undefined;
    setTitle(value: string): void;
    setDescription(value: string): void;
    getLinkTypes(): Set<string>;
    getOutgoingLinks(linkTypes?: Set<string> | string[] | null): OutgoingLink[];
    getProperties(): Record<string, string | string[]>;
  }

  export default class OSLCClient {
    constructor(user: string, password: string, configuration_context?: string | null);

    use(server_url: string, serviceProviderName: string, domain?: string): Promise<void>;
    getResource(url: string, oslc_version?: string, accept?: string): Promise<OSLCResource>;
    getCompactResource(url: string, oslc_version?: string, accept?: string): Promise<any>;
    putResource(resource: OSLCResource, eTag?: string | null, oslc_version?: string): Promise<any>;
    createResource(resourceType: string, resource: OSLCResource, oslc_version?: string): Promise<any>;
    deleteResource(resource: OSLCResource, oslc_version?: string): Promise<any>;
    queryResources(resourceType: string, query: any): Promise<OSLCResource[]>;
    query(resourceType: string, query: any): Promise<any>;
    getQueryBase(resourceType: string): Promise<string>;
    getCreationFactory(resourceType: string): Promise<string>;
    getOwner(url: string): Promise<string>;
  }

  export class LDMClient extends OSLCClient {
    getIncomingLinks(targetResourceURLs: string[], linkTypes: string[], configurationContext?: string): Promise<any>;
    invert(triples: any[]): any[];
  }
}
