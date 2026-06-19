import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: String,

  price: Number,

  category: {
    type: mongoose.Schema.ObjectId,
    ref: "Category",
  },
   
  discount: {
    type: Number,
    default: 0, // percentage discount (e.g. 10 = 10%)
  },

  img_url: {
    type: String,
    default: "",
  },

  city: {
    type: mongoose.Schema.ObjectId,
    ref: "City",
  },

  stockLimit: {
    type: Number, // max stock (e.g. 100L milk)
  },

  currentStock: {
    type: Number,
    default: 0,
  },

  isActive: {
    type: Boolean,
    default: true,
  },
});

export const Product = mongoose.model("Product", productSchema);
