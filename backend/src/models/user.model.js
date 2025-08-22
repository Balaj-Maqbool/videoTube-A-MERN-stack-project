import { Schema, model } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  ACCESS_TOKEN_EXPIRY,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRY,
  REFRESH_TOKEN_SECRET,
} from "../constants.js";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required "],
      lowercase: true,
      unique: true,
      trim: true,
      index: true, // for searching the field , use wisely
    },
    email: {
      type: String,
      required: [true, "Email is required "],
      lowercase: true,
      unique: true,
      trim: true,
      index:true
    },
    fullName: {
      type: String,
      required: [true, "Full Name is required "],
      trim: true,
    },
    avatar: {
      type: String, // cloudinary url
      required: [true, "Avatar is required "],
    },
    coverImage: {
      type: String,
    },
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    password: {
      type: String, // hashed password
      required: [true, "Password is required "],
    },
    refreshToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } else {
    return next();
  }
});
userSchema.methods.isPasswordCorrect = async function (password) {
  let result = await bcrypt.compare(password, this.password);
  return result; // return either true or false
};
userSchema.methods.generateAccessToken = function () {
  const token = jwt.sign(
    {
      _id: this._id,
      email: this.email,
      fullName: this.fullName,
      username: this.username,
    },
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    }
  );

  return token;
};

userSchema.methods.generateRefreshToken = function () {
  const token = jwt.sign(
    {
      _id: this._id,
    },
    REFRESH_TOKEN_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    }
  );

  return token;
};
// console.log(userSchema);

export const User = model("User", userSchema);
