/*
 * Looks at environment variables for app configuration (base URI, port, LDP
 * context, etc.), falling back to what's in config.json.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { format as formatURL } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const config = JSON.parse(readFileSync(join(__dirname, '..', 'config.json'), 'utf-8'));
function addSlash(url) {
    return url.endsWith('/') ? url : url + '/';
}
function toURL(urlObj) {
    const opts = { ...urlObj };
    if ((opts.protocol === 'http' && opts.port === 80) ||
        (opts.protocol === 'https' && opts.port === 443)) {
        delete opts.port;
    }
    return formatURL(opts);
}
const listenHost = process.env.VCAP_APP_HOST || process.env.OPENSHIFT_NODEJS_IP || config.host;
const listenPort = Number(process.env.VCAP_APP_PORT || process.env.OPENSHIFT_NODEJS_PORT || config.port);
let scheme;
let host;
let port;
let context;
let appBase;
let ldpBase;
if (process.env.LDP_BASE) {
    ldpBase = addSlash(process.env.LDP_BASE);
    const parsed = new URL(ldpBase);
    scheme = parsed.protocol.replace(':', '');
    host = parsed.hostname;
    port = parsed.port ? Number(parsed.port) : undefined;
    context = parsed.pathname;
    appBase = toURL({ protocol: scheme, hostname: host, port });
}
else {
    const appInfo = JSON.parse(process.env.VCAP_APPLICATION || '{}');
    scheme = process.env.VCAP_APP_PORT ? 'http' : config.scheme;
    if (appInfo.application_uris) {
        host = appInfo.application_uris[0];
    }
    else {
        host = process.env.HOSTNAME || config.host;
    }
    if (!process.env.VCAP_APP_PORT) {
        port = config.port;
    }
    context = addSlash(config.context);
    appBase = toURL({ protocol: scheme, hostname: host, port });
    ldpBase = toURL({ protocol: scheme, hostname: host, port, pathname: context });
}
export const env = {
    listenHost,
    listenPort,
    scheme,
    host,
    port,
    context,
    appBase,
    ldpBase,
    jenaURL: config.jenaURL,
    templatePath: join(__dirname, '..', 'config', 'catalog-template.ttl'),
};
//# sourceMappingURL=env.js.map