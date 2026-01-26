import Cart from "../models/cart.js";
import Product from "../models/product.js";

export const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product"
    );
    if (!cart) {
      return res.status(200).json({ items: [] });
    }
    return res.status(200).json(cart);
  } catch (err) {
    return res.status(500).json({ message: "Server Error: " + err.message });
  }
};

export const addToCart = async (req, res) => {
  try {
    const { productId, quantity, product } = req.body;

    const resolvedProductId =
      productId || (product && (product._id || product.id));

    if (!resolvedProductId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const productExists = await Product.findById(resolvedProductId);
    if (!productExists) {
      return res.status(404).json({ message: "Product not found" });
    }

    const qty = quantity && quantity > 0 ? quantity : 1;

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        items: [{ product: resolvedProductId, quantity: qty }],
      });
    } else {
      const existingItem = cart.items.find(
        (item) => String(item.product) === String(resolvedProductId)
      );
      if (existingItem) {
        existingItem.quantity += qty;
      } else {
        cart.items.push({ product: resolvedProductId, quantity: qty });
      }
    }

    const savedCart = await cart.save();
    await savedCart.populate("items.product");

    return res.status(200).json(savedCart);
  } catch (err) {
    return res.status(500).json({ message: "Server Error: " + err.message });
  }
};

export const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(200).json({ message: "Cart is already empty" });
    }

    cart.items = [];
    await cart.save();

    return res.status(200).json({ message: "Cart cleared successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Server Error: " + err.message });
  }
};

