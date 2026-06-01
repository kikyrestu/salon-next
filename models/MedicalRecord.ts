import mongoose, { Schema, Document } from "mongoose";

export interface IMedicalRecord extends Document {
  customer: mongoose.Types.ObjectId;
  storeSlug: string;
  date: Date;
  complaint?: string;
  diagnosis?: string;
  treatment?: string;
  prescription?: string;
  handledBy?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const medicalRecordSchema = new Schema<IMedicalRecord>(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    storeSlug: { type: String, required: true, trim: true },
    date: { type: Date, required: true, default: Date.now },
    complaint: { type: String, trim: true },
    diagnosis: { type: String, trim: true },
    treatment: { type: String, trim: true },
    prescription: { type: String, trim: true },
    handledBy: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

medicalRecordSchema.index({ customer: 1, storeSlug: 1, date: -1 });

export default mongoose.models.MedicalRecord ||
  mongoose.model<IMedicalRecord>("MedicalRecord", medicalRecordSchema);
