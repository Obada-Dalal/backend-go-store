console.log("THIS IS THE REAL APP.JS");
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Product } from "./Models/product.js";
import { User } from "./Models/user.js";
import { Category } from "./Models/category.js";
import { Order } from "./Models/order.js";
import { Cart } from "./Models/cart.js";
import { body, validationResult } from "express-validator";
import dotenv from "dotenv";
import { Advertisement } from "./Models/advertisement.js";

//  تنظيف الفهارس القديمة (شغلها مرة واحدة فقط)
Order.collection.dropIndex("orderNumber_1").catch(() => {});

dotenv.config();

// const app = express();
// app.use(cors());
// app.use(express.json());

const app = express();
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true
  })
);
app.use(express.json());

// إعداد multer لاستقبال الملفات
const upload = multer({ dest: "uploads/" });

// إعداد Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// اتصال Atlas
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ============================
// MIDDLEWARE
// ============================
const authMiddleware = (req, res, next) => {
  console.log("🛡️ authMiddleware");

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "توكن غير موجود" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    next(); // ✅ هذا next هو دالة
  } catch (err) {
    return res.status(401).json({ message: "توكن غير صالح" });
  }
};

const adminMiddleware = (req, res, next) => {
  console.log("👑 adminMiddleware");

  if (!req.user) {
    return res.status(401).json({ message: "مستخدم غير موجود" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "مسموح للأدمن فقط" });
  }

  next(); // ✅ هذا next هو دالة
};

// Middleware للتحقق من التوكن
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// AUTH APIs
// ============================

// Register
// app.post(
//   "/api/register",
//   body("name").notEmpty().withMessage("الاسم مطلوب"),
//   body("email").isEmail().withMessage("بريد إلكتروني غير صالح"),
//   body("password")
//     .isLength({ min: 6 })
//     .withMessage("كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty())
//       return res.status(400).json({ errors: errors.array() });

//     try {
//       const { name, email, password } = req.body;
//       const existingUser = await User.findOne({ email });
//       if (existingUser)
//         return res
//           .status(400)
//           .json({ error: "البريد الإلكتروني مستخدم بالفعل" });

//       const salt = await bcrypt.genSalt(10);
//       const passwordHash = await bcrypt.hash(password, salt);

//       const user = new User({ name, email, passwordHash });
//       await user.save();

//       const token = jwt.sign(
//         { id: user._id, role: user.role },
//         process.env.JWT_SECRET,
//         { expiresIn: "1d" }
//       );

//       res.json({ message: "تم إنشاء الحساب بنجاح", token, user });
//     } catch (err) {
//       res.status(500).json({ error: err.message });
//     }
//   }
// );
app.post(
  "/api/register",
  body("name").notEmpty().withMessage("الاسم مطلوب"),
  body("email").isEmail().withMessage("بريد إلكتروني غير صالح"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  body("phoneNumber") // 👈 إضافة هذا التحقق
    .notEmpty()
    .withMessage("رقم الهاتف مطلوب")
    .matches(/^\d{10}$/)
    .withMessage("رقم الهاتف يجب أن يكون مكوناً من 10 أرقام بالضبط"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const { name, email, password, phoneNumber } = req.body; // 👈 إضافة phoneNumber

      // التحقق من عدم تكرار الرقم (اختياري لكن مستحسن)
      const existingPhone = await User.findOne({ phoneNumber });
      if (existingPhone)
        return res.status(400).json({ error: "رقم الهاتف مستخدم بالفعل" });

      const existingUser = await User.findOne({ email });
      if (existingUser)
        return res
          .status(400)
          .json({ error: "البريد الإلكتروني مستخدم بالفعل" });

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = new User({ name, email, passwordHash, phoneNumber }); // 👈 إضافة phoneNumber
      await user.save();

      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      // لا ترجع passwordHash في الرد
      const { passwordHash: _, ...userWithoutPassword } = user.toObject();
      res.json({
        message: "تم إنشاء الحساب بنجاح",
        token,
        user: userWithoutPassword
      });
    } catch (err) {
      if (err.code === 11000) {
        return res
          .status(400)
          .json({ error: "البريد الإلكتروني أو رقم الهاتف موجود بالفعل" });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

// Login
app.post(
  "/api/login",
  body("email").isEmail().withMessage("بريد إلكتروني غير صالح"),
  body("password").notEmpty().withMessage("كلمة المرور مطلوبة"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ error: "المستخدم غير موجود" });

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch)
        return res.status(400).json({ error: "كلمة المرور غير صحيحة" });

      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      res.json({ message: "تم تسجيل الدخول بنجاح", token, user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================
// USER MANAGEMENT APIS (Admin only)
// ============================

// جلب جميع المستخدمين
app.get("/api/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select("-passwordHash");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تحديث مستخدم
// app.put("/api/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
//   try {
//     const { name, email, role } = req.body;
//     const updateData = { name, role };
//     if (email) updateData.email = email;

//     const user = await User.findByIdAndUpdate(req.params.id, updateData, {
//       new: true
//     }).select("-passwordHash");

//     if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });
//     res.json(user);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
app.put("/api/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, email, role, phoneNumber } = req.body; // 👈 إضافة phoneNumber
    const updateData = { name, role };

    if (email) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber; // 👈 السماح بتحديث الرقم

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true // 👈 مهم جداً لتطبيق validate من الـ Schema
    }).select("-passwordHash");

    if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });
    res.json(user);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// تغيير صلاحية المستخدم
app.put(
  "/api/users/:id/role",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { role } = req.body;
      if (!["admin", "user"].includes(role)) {
        return res.status(400).json({ error: "صلاحية غير صالحة" });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role },
        { new: true }
      ).select("-passwordHash");

      if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// حذف مستخدم
app.delete(
  "/api/users/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      if (req.params.id === req.user.id) {
        return res.status(400).json({ error: "لا يمكنك حذف حسابك الخاص" });
      }

      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });

      if (user.role === "admin") {
        const adminCount = await User.countDocuments({ role: "admin" });
        if (adminCount <= 1) {
          return res
            .status(400)
            .json({ error: "لا يمكن حذف آخر أدمن في النظام" });
        }
      }

      await User.findByIdAndDelete(req.params.id);
      res.json({ message: "تم حذف المستخدم بنجاح" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================
// PRODUCTS APIS
// ============================

// البحث عن المنتجات
app.get("/api/products/search", async (req, res) => {
  try {
    const { q } = req.query;
    const products = await Product.find({
      name: { $regex: q, $options: "i" }
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// جلب منتج واحد
app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// جلب جميع المنتجات
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().populate("categoryId");
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// جلب المنتجات حسب التصنيف
app.get("/api/products/category/:slug", async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category)
      return res.status(404).json({ message: "Category not found" });

    const products = await Product.find({ categoryId: category._id }).populate(
      "categoryId"
    );
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة منتج جديد
app.post(
  "/api/products",
  authMiddleware,
  adminMiddleware,
  body("name").notEmpty().withMessage("اسم المنتج مطلوب"),
  body("price")
    .isFloat({ gt: 0 })
    .withMessage("السعر يجب أن يكون رقمًا أكبر من صفر"),
  body("categoryId").notEmpty().withMessage("التصنيف مطلوب"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const images = req.body.images || [];
      const product = new Product({
        name: req.body.name,
        description: req.body.description || "",
        price: parseFloat(req.body.price),
        discountPrice: req.body.discountPrice
          ? parseFloat(req.body.discountPrice)
          : 0,
        images: images,
        color: req.body.color || [],
        categoryId: req.body.categoryId,
        rating: req.body.rating ? parseFloat(req.body.rating) : 0,
        brand: req.body.brand || "",
        stock: parseInt(req.body.stock) || 0,
        isFeatured:
          req.body.isFeatured === "true" || req.body.isFeatured === true
      });

      await product.save();
      const populatedProduct = await Product.findById(product._id).populate(
        "categoryId"
      );
      res.status(201).json(populatedProduct);
    } catch (err) {
      console.error("خطأ في إضافة المنتج:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// تعديل منتج
app.put(
  "/api/products/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
        new: true
      }).populate("categoryId");

      if (!product) return res.status(404).json({ error: "المنتج غير موجود" });
      res.json(product);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// حذف منتج
app.delete(
  "/api/products/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const product = await Product.findByIdAndDelete(req.params.id);
      if (!product) return res.status(404).json({ error: "المنتج غير موجود" });
      res.json({ message: "تم حذف المنتج بنجاح" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// تحديث المخزون
app.put("/api/products/:id/reduce-stock", async (req, res) => {
  try {
    const { quantity } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ error: "المنتج غير موجود" });
    if (product.stock < quantity)
      return res.status(400).json({ error: "الكمية غير متوفرة" });

    product.stock -= quantity;
    await product.save();

    res.json({ message: "تم تحديث المخزون", product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// CATEGORIES APIS
// ============================

// جلب الفئات
app.get("/api/categorys", async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة فئة جديدة
app.post(
  "/api/categorys",
  authMiddleware,
  adminMiddleware,
  body("name").notEmpty().withMessage("اسم الفئة مطلوب"),
  body("slug").notEmpty().withMessage("Slug مطلوب"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const existingCategory = await Category.findOne({ slug: req.body.slug });
      if (existingCategory) {
        return res.status(400).json({ error: "هذا التصنيف مستخدم بالفعل" });
      }

      const category = new Category(req.body);
      await category.save();
      res.json(category);
    } catch (err) {
      console.error("خطأ في إضافة التصنيف:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// تعديل فئة
app.put(
  "/api/categorys/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const category = await Category.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      res.json(category);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// حذف فئة
app.delete(
  "/api/categorys/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      await Category.findByIdAndDelete(req.params.id);
      res.json({ message: "تم حذف الفئة بنجاح" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================
// CART APIS
// ============================

// جلب السلة
app.get("/api/carts", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) return res.json({ items: [] });
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: "خطأ في جلب السلة" });
  }
});

// إضافة منتج للسلة
app.post("/api/carts", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity, color } = req.body;

  try {
    console.log("🛒 إضافة للسلة:", { userId, productId, quantity, color });

    if (!productId) return res.status(400).json({ message: "productId مطلوب" });
    if (!color) return res.status(400).json({ message: "اللون مطلوب" });

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [{ productId, quantity: quantity || 1, color }]
      });
      await cart.save();
      console.log("✅ تم إنشاء سلة جديدة");
      return res.json(cart);
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId && item.color === color
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += quantity || 1;
      console.log("✅ تم تحديث الكمية");
    } else {
      cart.items.push({ productId, quantity: quantity || 1, color });
      console.log("✅ تم إضافة منتج جديد");
    }

    await cart.save();
    res.json(cart);
  } catch (err) {
    console.error("❌ خطأ في إضافة المنتج للسلة:", err);
    res
      .status(500)
      .json({ message: "خطأ في إضافة المنتج للسلة", error: err.message });
  }
});

// تعديل الكمية
app.put("/api/carts/update-qty", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { itemId, quantity } = req.body;

  try {
    const cart = await Cart.findOne({ userId });
    const item = cart.items.id(itemId);
    item.quantity = quantity;
    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: "خطأ في تعديل الكمية" });
  }
});

// حذف منتج من السلة
app.delete("/api/carts/:itemId", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { itemId } = req.params;

  try {
    const cart = await Cart.findOne({ userId });
    cart.items = cart.items.filter((item) => item._id.toString() !== itemId);
    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: "خطأ في حذف المنتج" });
  }
});

// ============================
// ORDERS APIS
// ============================

// إنشاء طلب جديد
app.post("/api/orders", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, totalAmount, notes, whatsappMessage, shippingAddress } =
      req.body;

    console.log("📦 إنشاء طلب جديد:", {
      userId,
      itemsCount: items.length,
      totalAmount
    });

    // التحقق من وجود المنتجات وتحديث المخزون
    for (const item of items) {
      // التحقق من وجود productId
      if (!item.productId) {
        return res
          .status(400)
          .json({ error: "معرف المنتج مطلوب لجميع العناصر" });
      }

      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          error: `المنتج ${item.productName || "غير معروف"} غير موجود`
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          error: `المنتج ${product.name} غير متوفر بالكمية المطلوبة (المتوفر: ${product.stock})`
        });
      }
    }

    // تجهيز عناصر الطلب مع التأكد من وجود جميع الحقول المطلوبة
    const orderItems = items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      color: item.color || "غير محدد",
      priceAtOrder: item.priceAtOrder || 0,
      productName: item.productName || "منتج",
      productImage: item.productImage || ""
    }));

    // إنشاء الطلب
    const order = new Order({
      userId,
      items: orderItems,
      totalAmount: totalAmount || 0,
      notes: notes || "",
      whatsappMessage: whatsappMessage || "",
      shippingAddress: shippingAddress || {
        fullName: "",
        phone: "",
        address: "",
        city: ""
      },
      status: "pending",
      orderDate: new Date()
    });

    const lastOrder = await Order.findOne().sort({ orderNumber: -1 });
    order.orderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1000;

    await order.save();
    console.log("✅ تم إنشاء الطلب بنجاح:", order._id);

    // تحديث المخزون (تقليل الكمية)
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      });
      console.log(
        `📦 تم تحديث مخزون المنتج ${item.productId}: -${item.quantity}`
      );
    }

    // اختياري: حذف السلة بعد إنشاء الطلب
    // await Cart.findOneAndDelete({ userId });

    res.status(201).json({
      message: "تم إنشاء الطلب بنجاح",
      order: {
        ...order.toObject(),
        _id: order._id,
        orderDate: order.orderDate
      }
    });
  } catch (err) {
    console.error("❌ خطأ في إنشاء الطلب:", err);
    res.status(500).json({
      error: err.message,
      details: "حدث خطأ داخلي في السيرفر أثناء إنشاء الطلب"
    });
  }
});

// جلب طلبات المستخدم الحالي
app.get("/api/orders/my-orders", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("📋 جلب طلبات المستخدم:", userId);

    const orders = await Order.find({ userId })
      .sort({ orderDate: -1 })
      .populate("userId", "name email")
      .populate({
        path: "items.productId",
        select: "name images price"
      });

    console.log(`✅ تم جلب ${orders.length} طلب للمستخدم`);
    res.json(orders);
  } catch (err) {
    console.error("❌ خطأ في جلب طلبات المستخدم:", err);
    res.status(500).json({ error: err.message });
  }
});

// جلب طلب محدد
app.get("/api/orders/:orderId", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("userId", "name email")
      .populate({
        path: "items.productId",
        select: "name images price description"
      });

    if (!order) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    // التحقق من الصلاحية (المستخدم نفسه أو أدمن)
    if (
      order.userId._id.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "غير مصرح لك بمشاهدة هذا الطلب" });
    }

    res.json(order);
  } catch (err) {
    console.error("❌ خطأ في جلب الطلب:", err);
    res.status(500).json({ error: err.message });
  }
});

// تأكيد استلام الطلب من قبل المستخدم
app.put(
  "/api/orders/:orderId/confirm-delivery",
  authMiddleware,
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.orderId);

      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      // التحقق من أن المستخدم هو صاحب الطلب
      if (order.userId.toString() !== req.user.id) {
        return res.status(403).json({ error: "غير مصرح لك بتأكيد هذا الطلب" });
      }

      // التحقق من أن الطلب لم يتم تأكيده مسبقاً
      if (order.deliveryConfirmedByUser) {
        return res
          .status(400)
          .json({ error: "تم تأكيد استلام هذا الطلب مسبقاً" });
      }

      // التحقق من أن الطلب في حالة مناسبة للتأكيد
      if (order.status !== "shipped" && order.status !== "delivered") {
        return res
          .status(400)
          .json({ error: "لا يمكن تأكيد استلام طلب لم يتم شحنه بعد" });
      }

      // تحديث حالة الطلب
      order.deliveryConfirmedByUser = true;
      order.deliveryConfirmedAt = new Date();
      order.status = "delivered";
      order.deliveredDate = new Date();

      await order.save();
      console.log(`✅ تم تأكيد استلام الطلب ${order._id} من قبل المستخدم`);

      // ✅ لم نعد نحذف السلة بالكامل هنا
      // await Cart.findOneAndDelete({ userId: req.user.id });

      // بدلاً من ذلك، نرسل معلومات الطلب للفرونت إند
      // ليقوم بحذف المنتجات المؤكدة فقط من السلة

      res.json({
        message: "تم تأكيد استلام الطلب بنجاح",
        order: {
          ...order.toObject(),
          items: order.items // نرسل العناصر المؤكدة
        }
      });
    } catch (err) {
      console.error("❌ خطأ في تأكيد استلام الطلب:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================
// ADMIN ORDERS APIS
// ============================

// جلب جميع الطلبات (للمسؤول) - مع بحث متقدم
app.get(
  "/api/admin/orders",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const {
        status,
        page = 1,
        limit = 20,
        search,
        dateFrom,
        dateTo
      } = req.query;
      const query = {};

      console.log("🔍 بحث متقدم:", { status, page, search, dateFrom, dateTo });

      if (status) {
        query.status = status;
      }

      // فلترة حسب التاريخ
      if (dateFrom || dateTo) {
        query.orderDate = {};
        if (dateFrom) {
          const startDate = new Date(dateFrom);
          startDate.setHours(0, 0, 0, 0);
          query.orderDate.$gte = startDate;
        }
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          query.orderDate.$lte = endDate;
        }
      }

      // ✅ بحث متقدم - يعمل مع آخر 8 أحرف من _id
      if (search && search.trim() !== "") {
        const searchRegex = new RegExp(search, "i");

        // شروط البحث الأساسية
        query.$or = [
          { "items.productName": searchRegex },
          { orderNumber: searchRegex }
        ];

        // البحث في المستخدمين
        const users = await User.find({
          $or: [{ name: searchRegex }, { email: searchRegex }]
        }).select("_id");

        if (users.length > 0) {
          query.$or.push({ userId: { $in: users.map((u) => u._id) } });
        }

        // ✅ البحث في _id باستخدام $expr (يعمل مع أي جزء من النص)
        query.$or.push({
          $expr: {
            $regexMatch: {
              input: { $toString: "$_id" },
              regex: search,
              options: "i"
            }
          }
        });

        console.log("🔍 شروط البحث:", JSON.stringify(query.$or, null, 2));
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const orders = await Order.find(query)
        .populate("userId", "name email")
        .populate({
          path: "items.productId",
          select: "name images price"
        })
        .sort({ orderDate: -1 })
        .limit(parseInt(limit))
        .skip(skip);

      const total = await Order.countDocuments(query);

      console.log(`✅ تم جلب ${orders.length} طلب من أصل ${total}`);

      res.json({
        orders,
        totalPages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page),
        total
      });
    } catch (err) {
      console.error("❌ خطأ في جلب الطلبات:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// تحديث حالة الطلب (للمسؤول)
app.put(
  "/api/admin/orders/:orderId/status",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled"
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "حالة غير صالحة" });
      }

      const order = await Order.findById(req.params.orderId);

      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      // إذا كانت الحالة الجديدة "delivered" والحالة القديمة مختلفة
      if (status === "delivered" && order.status !== "delivered") {
        order.deliveredDate = new Date();
      }

      // إذا كانت الحالة الجديدة "cancelled" والحالة القديمة مختلفة
      if (status === "cancelled" && order.status !== "cancelled") {
        // إعادة المخزون
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity }
          });
        }
        console.log(`🔄 تم إعادة المخزون للطلب الملغي ${order._id}`);
      }

      order.status = status;
      await order.save();

      console.log(`✅ تم تحديث حالة الطلب ${order._id} إلى ${status}`);

      res.json({
        message: "تم تحديث حالة الطلب بنجاح",
        order
      });
    } catch (err) {
      console.error("❌ خطأ في تحديث حالة الطلب:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// حذف طلب (للمسؤول)
app.delete(
  "/api/admin/orders/:orderId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.orderId);

      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      // إعادة المخزون إذا لم يكن الطلب ملغي أو مكتمل
      if (order.status !== "cancelled" && order.status !== "delivered") {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity }
          });
        }
        console.log(`🔄 تم إعادة المخزون للطلب المحذوف ${order._id}`);
      }

      await Order.findByIdAndDelete(req.params.orderId);
      console.log(`🗑️ تم حذف الطلب ${order._id}`);

      res.json({ message: "تم حذف الطلب بنجاح" });
    } catch (err) {
      console.error("❌ خطأ في حذف الطلب:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// إحصائيات الطلبات (للمسؤول)
app.get(
  "/api/admin/orders/stats/summary",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      console.log("📊 جلب إحصائيات الطلبات");

      const totalOrders = await Order.countDocuments();
      const pendingOrders = await Order.countDocuments({ status: "pending" });
      const processingOrders = await Order.countDocuments({
        status: "processing"
      });
      const shippedOrders = await Order.countDocuments({ status: "shipped" });
      const deliveredOrders = await Order.countDocuments({
        status: "delivered"
      });
      const cancelledOrders = await Order.countDocuments({
        status: "cancelled"
      });

      const totalRevenueResult = await Order.aggregate([
        { $match: { status: "delivered" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]);

      const totalRevenue =
        totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0;

      const stats = {
        totalOrders,
        pendingOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenue
      };

      console.log("✅ إحصائيات الطلبات:", stats);
      res.json(stats);
    } catch (err) {
      console.error("❌ خطأ في جلب إحصائيات الطلبات:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================
// ADVERTISEMENT APIS
// ============================

// جلب جميع الإعلانات
app.get("/api/advertisements", async (req, res) => {
  try {
    const ads = await Advertisement.find();
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// جلب إعلان واحد
app.get("/api/advertisements/:id", async (req, res) => {
  try {
    const ad = await Advertisement.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: "الإعلان غير موجود" });
    res.json(ad);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة إعلان جديد
app.post(
  "/api/advertisements",
  authMiddleware,
  adminMiddleware,
  body("title").notEmpty().withMessage("عنوان الإعلان مطلوب"),
  body("startDate").notEmpty().withMessage("تاريخ البداية مطلوب"),
  body("endDate").notEmpty().withMessage("تاريخ النهاية مطلوب"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const ad = new Advertisement(req.body);
      await ad.save();
      res.json(ad);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// تعديل إعلان
app.put(
  "/api/advertisements/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const ad = await Advertisement.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      res.json(ad);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// حذف إعلان
app.delete(
  "/api/advertisements/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      await Advertisement.findByIdAndDelete(req.params.id);
      res.json({ message: "تم حذف الإعلان بنجاح" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================
// START SERVER
// ============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
