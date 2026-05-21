// // المستخدم الذي قام بالطلب.

// // المنتجات المطلوبة مع تفاصيلها.

// // السعر الإجمالي.

// // حالة الطلب (قيد التنفيذ، شحن، إلغاء…).

// // عنوان الشحن.

// // تاريخ الإنشاء والتحديث.

import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      sparse: true // هذا يسمح بقيم null متعددة حتى ننشئ الفهرس الجديد
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1
        },
        color: {
          type: String,
          required: true,
          default: "غير محدد"
        },
        priceAtOrder: {
          type: Number,
          required: true,
          min: 0
        },
        productName: {
          type: String,
          required: true
        },
        productImage: {
          type: String,
          default: ""
        }
      }
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
      index: true
    },
    orderDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    deliveredDate: {
      type: Date
    },
    deliveryConfirmedByUser: {
      type: Boolean,
      default: false
    },
    deliveryConfirmedAt: {
      type: Date
    },
    notes: {
      type: String,
      default: ""
    },
    whatsappMessage: {
      type: String,
      default: ""
    },
    shippingAddress: {
      fullName: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// فهرسة للبحث السريع - بدون orderNumber
orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ status: 1, orderDate: -1 });

// Virtual for formatted date
orderSchema.virtual("formattedOrderDate").get(function () {
  return this.orderDate?.toLocaleDateString("ar-EG");
});

export const Order = mongoose.model("Order", orderSchema);
// import mongoose from "mongoose";

// const orderSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true
//     },

//     items: [
//       {
//         productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
//         name: String,
//         price: Number,
//         quantity: Number
//       }
//     ],

//     totalPrice: {
//       type: Number,
//       required: true
//     },

//     status: {
//       type: String,
//       enum: ["pending", "processing", "shipped", "completed", "canceled"],
//       default: "pending"
//     },

//     shippingAddress: {
//       type: String,
//       required: true
//     }
//   },
//   { timestamps: true }
// );

// export const Order = mongoose.model("Order", orderSchema);
