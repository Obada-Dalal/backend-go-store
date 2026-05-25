import mongoose from "mongoose";
const advertisement = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    images: [{ type: String }],
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Advertisement = mongoose.model("Advertisement", advertisement);
