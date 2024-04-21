import { User } from "../models/user.js";
import { ErrorHandler, TryCatch } from "./error.js";
import jwt from "jsonwebtoken";

const isAuthenticated = (req, res, next) => {
  const token = req.cookies["Chatease"];

  if (!token)
    return next(
      new ErrorHandler("Please Login First To Access This Route", 401)
    );

  const decodedData = jwt.verify(token, process.env.JWT_SECRET);
  // console.log(decodedData)

  // now we can access id in user
  req.user = decodedData._id;

  next();
};

const socketAuthenticator = async (err, socket, next) => {
  try {
    if (err) return next(err);
    const authToken = socket.request.cookies["Chatease"];

    if (!authToken)
      return next(
        new ErrorHandler("Please Login First To Access This Route", 401)
      );

    const decodedData = jwt.verify(authToken, process.env.JWT_SECRET);

    const user = await User.findById(decodedData._id);
    if (!user)
      return next(new ErrorHandler("Please Login To Access This Route", 401));
    socket.user = user;

    return next();
  } catch (error) {
    console.log(error);
    return next(new ErrorHandler("Please Login To Access This Route", 401));
  }
};

export { isAuthenticated, socketAuthenticator };
