// MongoDB-backed rate limiter for production (serverless compatible)
import mongoose, { Document, Schema } from 'mongoose';
import { connectToDB } from './mongodb';

export interface IRateLimit extends Document {
  identifier: string;
  count: number;
  resetTime: Date;
}

const rateLimitSchema = new Schema<IRateLimit>({
  identifier: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 1 },
  resetTime: { type: Date, required: true, expires: 0 }, // TTL index to auto-delete when resetTime is reached
});

const getRateLimitModel = async () => {
  const conn = await connectToDB();
  return conn.models.RateLimit || conn.model<IRateLimit>('RateLimit', rateLimitSchema);
};

export async function checkRateLimit(identifier: string, windowMs: number, maxRequests: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  try {
    const RateLimit = await getRateLimitModel();
    const now = new Date();
    const nowMs = now.getTime();
    
    // Use findOneAndUpdate with upsert for atomicity
    // We increment count. If it's a new document, it sets count to 1 and resetTime to now + windowMs.
    // If it's an existing document, it increments count. If resetTime has passed, the TTL index should have deleted it, 
    // but just in case it hasn't run yet, we handle it.
    
    const record = await RateLimit.findOneAndUpdate(
      { identifier, resetTime: { $gt: now } }, // Only match if not expired
      { 
        $inc: { count: 1 },
        $setOnInsert: { resetTime: new Date(nowMs + windowMs) }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (record.count > maxRequests) {
      return { allowed: false, remaining: 0, resetTime: record.resetTime.getTime() };
    }

    return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime.getTime() };
  } catch (error) {
    console.error('Rate Limiter error:', error);
    // Fail open if DB fails
    return { allowed: true, remaining: 1, resetTime: Date.now() + windowMs };
  }
}