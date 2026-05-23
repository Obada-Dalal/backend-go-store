import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },

    passwordHash: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: false,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v);
        },
        message:
          "رقم الهاتف يجب أن يكون مكوناً من 10 أرقام بالضبط (أرقام فقط، بدون مسافات أو رموز)"
      }
    }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);

// import mongoose from "mongoose";

// const userSchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: true,
//       trim: true
//     },

//     email: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true
//     },

//     passwordHash: {
//       type: String,
//       required: true
//     },

//     role: {
//       type: String,
//       enum: ["user", "admin"],
//       default: "user"
//     }
//   },
//   { timestamps: true }
// );

// export const User = mongoose.model("User", userSchema);
