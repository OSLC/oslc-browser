import type { StorageEnv } from 'storage-service';
export interface AppEnv extends StorageEnv {
    listenHost: string;
    listenPort: number;
    scheme: string;
    host: string;
    port?: number;
    context: string;
    ldpBase: string;
    templatePath?: string;
}
export declare const env: AppEnv;
//# sourceMappingURL=env.d.ts.map