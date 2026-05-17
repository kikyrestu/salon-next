import mongoose from 'mongoose';
import { getMasterModels } from './masterDb';
import { initModels } from './initModels';
import dbConnect from './mongodb';

const tenantConnections = new Map<string, mongoose.Connection>();

export async function getTenantConnection(slug: string): Promise<mongoose.Connection> {
    const existing = tenantConnections.get(slug);
    if (existing && existing.readyState === 1) {
        return existing;
    }
    
    // If it exists but is disconnected, remove it from cache
    if (existing) {
        tenantConnections.delete(slug);
    }

    // 1. Get Master Models
    const master = await getMasterModels();
    
    // 2. Find Store by slug
    const store = await master.Store.findOne({ slug, isActive: true });

    const opts = {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 10000,
        family: 4, // Force IPv4
    };
    
    if (!store) {
        // For the default/pusat slug, allow fallback to MONGODB_URI
        if (slug === 'pusat') {
            const fallbackUri = process.env.MONGODB_URI || '';
            if (!fallbackUri) {
                throw new Error('Cabang "pusat" tidak ditemukan di Master DB dan MONGODB_URI tidak dikonfigurasi.');
            }
            console.warn(`⚠️ Store "pusat" not in Master DB, using MONGODB_URI fallback.`);
            const conn = mongoose.createConnection(fallbackUri, opts);
            await new Promise<void>((resolve, reject) => {
                conn.once('open', () => resolve());
                conn.on('error', (err) => reject(err));
            });
            const baseModels = initModels();
            for (const [modelName, model] of Object.entries(baseModels)) {
                if (!conn.models[modelName]) {
                    conn.model(modelName, model.schema);
                }
            }
            tenantConnections.set(slug, conn);
            console.log(`✅ Tenant MongoDB connected for slug: ${slug} (fallback)`);
            return conn;
        }
        
        throw new Error(`Cabang dengan slug "${slug}" tidak ditemukan atau sudah dinonaktifkan.`);
    }
    
    const dbUri = store.dbUri;

    const conn = mongoose.createConnection(dbUri, opts);
    
    await new Promise<void>((resolve, reject) => {
        conn.once('open', () => resolve());
        conn.on('error', (err) => reject(err));
    });

    // 4. Register all models to this tenant connection
    // We need to load the schemas. Since initModels() returns the base models, 
    // we can extract their schemas and register them on the new connection.
    const baseModels = initModels();
    for (const [modelName, model] of Object.entries(baseModels)) {
        if (!conn.models[modelName]) {
            conn.model(modelName, model.schema);
        }
    }

    // Cache the connection
    tenantConnections.set(slug, conn);
    console.log(`✅ Tenant MongoDB connected for slug: ${slug}`);

    return conn;
}

export async function getTenantModels(slug: string) {
    const conn = await getTenantConnection(slug);
    return conn.models as ReturnType<typeof initModels>;
}
