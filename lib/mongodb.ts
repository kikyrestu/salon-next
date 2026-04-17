import mongoose from 'mongoose';

const getMongoUri = () => process.env.MONGODB_URI?.trim();

const isLocalMongoUri = (uri: string) => {
  return /^mongodb(\+srv)?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(uri);
};

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function dbConnect(): Promise<typeof mongoose> {
  const mongoUri = getMongoUri();

  if (!mongoUri) {
    throw new Error(
      'Please define the MONGODB_URI environment variable inside .env.local'
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

    cached.promise = mongoose.connect(mongoUri, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
    console.log('✅ MongoDB connected successfully');
  } catch (e: any) {
    cached.promise = null;
    console.error('❌ MongoDB connection failed:', e.message);
    console.error('Connection string format check:', {
      hasUri: !!mongoUri,
      startsWithMongodb: mongoUri?.startsWith('mongodb'),
      length: mongoUri?.length,
      localMongoUri: mongoUri ? isLocalMongoUri(mongoUri) : false,
    });

    if (mongoUri && isLocalMongoUri(mongoUri)) {
      console.error(
        'MongoDB URI points to localhost. Ensure MongoDB service/container is running and listening on port 27017.'
      );
    }

    throw e;
  }


  return cached.conn;
}

export const connectToDB = dbConnect;
export default dbConnect;
