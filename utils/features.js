import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import {v2 as cloudinary} from "cloudinary"
import { getBase64, getSockets } from "../lib/helper.js";

export const connectDB = (uri) => {
  mongoose
    .connect(uri, { dbName: "ChatApp" })
    .then((c) => console.log(`Connected To DB: ${c.connection.host}`))
    .catch((e) => console.log(e));
};

// Export a function to send a token as a cookie in the response
export const sendToken = (res, user, code, message) => {
  // Generate a JWT token using the user's ID and the JWT secret
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

  const currentTimeMillis = new Date().getTime();
  const expirationTimeMillis = currentTimeMillis + 15 * 24 * 60 * 60 * 1000;
  const expirationGMT = new Date(expirationTimeMillis).toUTCString();

  const cookieOption = {
    expires: new Date(expirationGMT),
    sameSite: "none",
    httpOnly: true,
    secure: true,
  };

  res.status(code).cookie("Chatease", token, cookieOption).json({
    success: true,
    user,
    message,
  });
};

// export cookie optopn
export const cookieOption = {
  maxAge: 0,
  sameSite: "none",
  httpOnly: true,
  secure: true,
};

// emit evenet
export const emitEvent = (req, event, users, data) => {
  const io =req.app.get("io")
  // Send messages only to the users we want to target
  const userSocket = getSockets(users);
  io.to(userSocket).emit(event,data);
};

// upload files to cloudinary
export const uploadFilesToCloudinary = async (files = []) => {
  const uploadPromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        getBase64(file),
        { resource_type: "auto", public_id: uuid() },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
    });
  });

  try {
    const results = await Promise.all(uploadPromises);

    const formattedResults = results.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    }));

    return formattedResults;
  } catch(err) {
    throw new Error("Error Uploading Files To Cloudinary: " + err.message);

  }
};

// delete files from cloudnary
export const deleteFilesFromCloudnary = async (public_id) => {};
