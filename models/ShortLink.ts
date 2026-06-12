import mongoose, { Schema, Document } from "mongoose";

export interface IShortLink extends Document {
  code: string;
  targetUrl: string;
  createdAt: Date;
  expiresAt?: Date;
}

const shortLinkSchema = new Schema<IShortLink>(
  {
    code: { type: String, required: true, unique: true, index: true },
    targetUrl: { type: String, required: true },
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

export default mongoose.models.ShortLink || mongoose.model<IShortLink>("ShortLink", shortLinkSchema);
