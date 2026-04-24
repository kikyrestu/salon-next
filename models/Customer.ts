import mongoose, { Schema, Document } from "mongoose";

export interface IBeforeAfterPhoto {
  before: string;
  after: string;
  note?: string;
  date: Date;
}

export interface ICustomer extends Document {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  preferenceNotes?: string;
  totalPurchases: number;
  loyaltyPoints: number;
  createdBy?: string;
  status: "active" | "inactive";
  // Membership
  membershipTier: "regular" | "silver" | "gold" | "platinum" | "premium";
  membershipJoinDate?: Date;
  membershipExpiry?: Date;
  birthday?: Date;
  birthdayVoucherSentYear?: number;
  // Referral
  referralCode?: string;
  referredBy?: mongoose.Types.ObjectId;
  referralRewardClaimed: boolean;
  // WA Notification opt-in
  waNotifEnabled: boolean;
  // Before-After Photos
  beforeAfterPhotos: IBeforeAfterPhoto[];
}

const BeforeAfterPhotoSchema = new Schema<IBeforeAfterPhoto>(
  {
    before: { type: String, required: true, trim: true },
    after: { type: String, required: true, trim: true },
    note: { type: String, trim: true },
    date: { type: Date, default: Date.now },
  },
  { _id: true },
);

const customerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
    preferenceNotes: { type: String, trim: true },
    totalPurchases: { type: Number, default: 0, min: 0 },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    // Membership
    membershipTier: {
      type: String,
      enum: ["regular", "silver", "gold", "platinum", "premium"],
      default: "regular",
    },
    membershipJoinDate: { type: Date },
    membershipExpiry: { type: Date },
    birthday: { type: Date },
    birthdayVoucherSentYear: { type: Number },
    // Referral
    referralCode: { type: String, trim: true, unique: true, sparse: true },
    referredBy: { type: Schema.Types.ObjectId, ref: "Customer" },
    referralRewardClaimed: { type: Boolean, default: false },
    // WA Notification opt-in
    waNotifEnabled: { type: Boolean, default: true },
    // Before-After Photos
    beforeAfterPhotos: { type: [BeforeAfterPhotoSchema], default: [] },
  },
  { timestamps: true },
);

// Index for faster searches
customerSchema.index({ name: "text", email: "text", phone: "text" });
customerSchema.index({ membershipTier: 1 });

export default mongoose.models.Customer ||
  mongoose.model<ICustomer>("Customer", customerSchema);
