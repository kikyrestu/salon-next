import mongoose from 'mongoose';
import { StoreSchema, IStore } from '@/models/Store';

const getMasterMongoUri = () => process.env.MASTER_MONGODB_URI?.trim();

interface MasterCache {
  conn: mongoose.Connection | null;
  promise: Promise<mongoose.Connection> | null;
  models: {
    Store: mongoose.Model<IStore> | null;
  };
}

declare global {
  var masterMongoose: MasterCache | undefined;
}

let cached: MasterCache = global.masterMongoose || {
  conn: null,
  promise: null,
  models: { Store: null },
};

if (!global.masterMongoose) {
  global.masterMongoose = cached;
}

async function connectToMasterDB(): Promise<mongoose.Connection> {
  const mongoUri = getMasterMongoUri();

  if (!mongoUri) {
    throw new Error(
      'Please define the MASTER_MONGODB_URI environment variable inside .env.local'
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    };

    const conn = mongoose.createConnection(mongoUri, opts);

    cached.promise = new Promise<mongoose.Connection>((resolve, reject) => {
      conn.once('open', () => resolve(conn));
      conn.on('error', (err) => reject(err));
    });
  }

  try {
    cached.conn = await cached.promise;
    console.log('✅ Master MongoDB connected successfully');
  } catch (e: any) {
    cached.promise = null;
    cached.conn = null;
    console.error('❌ Master MongoDB connection failed:', e.message);
    throw e;
  }

  return cached.conn;
}

export async function getMasterModels() {
  const conn = await connectToMasterDB();

  if (!cached.models.Store) {
    cached.models.Store = conn.model<IStore>('Store', StoreSchema);
  }

  return {
    Store: cached.models.Store,
  };
}
