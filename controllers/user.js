import { compare } from "bcrypt";
import { NEW_REQUEST, REFETCH_CHATS } from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
import { ErrorHandler, TryCatch } from "../middlewares/error.js";
import { Chat } from "../models/chat.js";
import { Request } from "../models/request.js";
import { User } from "../models/user.js";
import { cookieOption, emitEvent, sendToken, uploadFilesToCloudinary } from "../utils/features.js";

// create a new user and save it to database and save in token in cookie
export const newUser = TryCatch(async (req, res,next) => {
  const { name, username, password, bio } = req.body;
  const file = req.file;
  if(!file) return next(new ErrorHandler("Please Upload Avatar",400));

  const result = await uploadFilesToCloudinary([file]);

  const avatar = {
    public_id: result[0].public_id,
    url: result[0].url,
  };
  
  const existUserName =await User.findOne({username})
  if(existUserName) return next(new ErrorHandler("Username Already Exist",400))

  const user = await User.create({ name, username, password, bio, avatar });

  sendToken(res, user, 201, "User Created");
});

// login user and save token in cookie
export const login = TryCatch(async (req, res, next) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username }).select("+password");
  if (!user) return next(new ErrorHandler("Invalid Username or Password", 404));

  // check user password is same as database
  const isMatch = await compare(password, user.password);

  if (!isMatch)
    return next(new ErrorHandler("Invalid Username or Password", 404));

  sendToken(res, user, 200, `Welcome Back ${user.name}`);
});

// user profile
export const getMyProfile = TryCatch(async (req, res, next) => {
  const user = await User.findById(req.user);
  if (!user) return next(new ErrorHandler("User Not Found", 404));
  res.status(201).json({
    success: true,
    user,
  });
});

// Logout handler which remove token
export const logout = (req, res, next) => {
  return res.status(200).cookie("Chatease", "", cookieOption).json({
    success: true,
    message: "Logout Successfully",
  });
};

// search user
export const searchUser = TryCatch(async (req, res, next) => {
  const { name = "" } = req.query;

  // finding all my chats
  const myChats = await Chat.find({ members: req.user, groupChat: false });

  // extracting all users form my chats with member id only
  const allUsersFromMyChats = myChats.flatMap((chat) => chat.members);

  // $nin find that ids expect allUsersFromMyChats and $regex find user whose name match with provided name ,option i check case sensitive
  const allUsersExceptMeAndFriends = await User.find({
    _id: { $nin: allUsersFromMyChats },
    name: { $regex: name, $options: "i" },
  });

  // modifing the response
  const users = allUsersExceptMeAndFriends.map(({ _id, name, avatar }) => ({
    _id,
    name,
    avatar: avatar.url,
  }));

  return res.status(200).json({
    success: true,
    users,
  });
});

// send friend request
export const sendFriendRequest = TryCatch(async (req, res, next) => {
  const { userId } = req.body;
  const user = await User.findById(userId);

  const request = await Request.findOne({
    $or: [
      { sender: req.user, receiver: user },
      { sender: user, receiver: req.user },
    ],
  });

  if (request) return next(new ErrorHandler("Request Already Send", 400));

  await Request.create({
    sender: req.user,
    receiver: user,
  });

  emitEvent(req, NEW_REQUEST, [userId]);

  return res.status(200).json({
    success: true,
    message: "Friend Request Sent",
  });
});

// accept friend request
export const acceptFriendRequest = TryCatch(async (req, res, next) => {
  const { requestId, accept } = req.body;

  const request = await Request.findById(requestId)
    .populate("sender", "name")
    .populate("receiver", "name");
    console.log(request)

  if (!request) return next(new ErrorHandler("Request Not Found", 404));

  if (request.receiver._id.toString() !== req.user.toString())
    return next(
      new ErrorHandler("You Are Not Authorized To Accept This Request", 401)
    );

  if (!accept) {
    await Request.deleteOne();
    return res.status(200).json({
      success: true,
      message: "Friend Request Rejected",
    });
  }
  const members = [request.sender._id, request.receiver._id];

  await Promise.all([
    Chat.create({
      members,
      name: `${request.sender.name}-${request.receiver.name}`,
    }),
    request.deleteOne(),
  ]);

  emitEvent(req, REFETCH_CHATS, members);

  return res.status(200).json({
    success: true,
    message: "Friend Request Accepted",
    senderId: request.sender._id,
  });
});

// get my notifications
export const getMyNotifications = TryCatch(async (req, res, next) => {
  const requests = await Request.find({ receiver: req.user }).populate(
    "sender",
    "name avatar"
  );

  const allRequests = requests.map(({ _id, sender }) => ({
    _id,
    sender: {
      _id: sender._id,
      name: sender.name,
      avatar: sender.avatar.url,
    },
  }));

  return res.status(200).json({
    success: true,
    allRequests,
  });
});

// get my friends
export const getMyFriends = TryCatch(async (req, res, next) => {
  const chatId = req.query.chatId;
  const chats = await Chat.find({
    members: req.user,
    groupChat: false,
  }).populate("members", "name avatar");

  const friends = chats.map(({ members }) => {
    const otherUser = getOtherMember(members, req.user);

    return {
      _id: otherUser._id,
      name: otherUser.name,
      avatar: otherUser.avatar.url,
    };
  });

  if (chatId) {
    // (when we add member on group then  there is option to serach member then this api hit and we get avalable friend those who are not added in the group)
    const chat = await Chat.findById(chatId);
    const availableFriends = friends.filter(
      (friend) => !chat.members.includes(friend._id)
    );
    return res.status(200).json({
      success: true,
      friends: availableFriends,
    });
  } else {
    return res.status(200).json({
      success: true,
      friends,
    });
  }
});
