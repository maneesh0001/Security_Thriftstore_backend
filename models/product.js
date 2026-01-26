// models/product.js
import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  condition: { type: String, required: true },
  imageUrl: { type: String },
}, {
  timestamps: true
});

const Product = mongoose.model("Product", productSchema);
export default Product;