/*
 * mrm-server: An OSLC 3.0 server for the MISA Municipal Reference Model.
 * Uses oslc-service Express middleware with MRM-specific configuration.
 */
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { oslcService } from 'oslc-service';
import { JenaStorageService } from 'ldp-service-jena';
import { env } from './env.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
console.log('configuration:');
console.dir(env);
const app = express();
// Serve static files
app.use(express.static(join(__dirname, '..', 'public')));
app.use('/dialog', express.static(join(__dirname, '..', 'dialog')));
// Initialize storage and mount OSLC service
const storage = new JenaStorageService();
try {
    await storage.init(env);
    app.use(await oslcService(env, storage));
}
catch (err) {
    console.error(err);
    console.error("Can't initialize the Jena storage service.");
}
// Error handling
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});
app.listen(env.listenPort, env.listenHost, () => {
    console.log('mrm-server running on ' + env.appBase);
});
//# sourceMappingURL=app.js.map