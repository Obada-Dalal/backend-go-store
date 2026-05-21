
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    description: { type: String, required: true },

    price: { type: Number, required: true },

    discountPrice: { type: Number, default: 0 },

    images: [{ type: String }],

    color: [],

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    rating: { type: Number, default: 0 }, // عدد النجوم (من 0 إلى 5)

    brand: { type: String },

    stock: { type: Number, default: 0 },

    isFeatured: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const Product = mongoose.model("Product", productSchema);
