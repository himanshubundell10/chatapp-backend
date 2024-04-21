import {
  ALERT,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  REFETCH_CHATS,
} from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
import { ErrorHandler, TryCatch } from "../middlewares/error.js";
import { Chat } from "../models/chat.js";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";
import {
  deleteFilesFromCloudnary,
  emitEvent,
  uploadFilesToCloudinary,
} from "../utils/features.js";

// create group chat
const newGroupChat = TryCatch(async (req, res, next) => {
  const { name, members } = req.body;

  // after implimenting validator this part is not req
  // if (members.length < 2)
  //   return next(
  //     new ErrorHandler("Group Chat Must Have At least 3 Member", 400)
  //   );
  // all members including me
  const allMembers = [...members, req.user];

  await Chat.create({
    name,
    groupChat: true,
    creator: req.user,
    members: allMembers,
  });

  emitEvent(req, ALERT, allMembers, `Welcome To ${name} Group`);
  emitEvent(req, REFETCH_CHATS, members);

  return res.status(201).json({
    success: true,
    message: "Group Created",
  });
});

// get my chat lsit which is show on the left side of the app
const getMyChats = TryCatch(async (req, res, next) => {
  // find that memebers in which frnd list i am include
  const chats = await Chat.find({ members: req.user }).populate(
    "members",
    "avatar name"
  );

  const transformedChats = chats.map(({ _id, name, groupChat, members }) => {
    const othetMember = getOtherMember(members, req.user);
    return {
      _id,
      groupChat,
      avatar: groupChat
        ? members.slice(0, 3).map(({ avatar }) => avatar.url)
        : [othetMember.avatar.url],
      name: groupChat ? name : othetMember.name,
      members: members.reduce((prev, curr) => {
        if (curr._id.toString() !== req.user.toString()) {
          prev.push(curr._id);
        }
        return prev;
      }, []),
    };
  });

  return res.status(200).json({
    success: true,
    chats: transformedChats,
  });
});

// get my group(show all group in which me is include)
const getMyGroups = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({
    members: req.user,
    groupChat: true,
    creator: req.user,
  }).populate("members", "name avatar");

  const groups = chats.map(({ members, _id, groupChat, name }) => ({
    _id,
    groupChat,
    name,
    avatar: members.slice(0, 3).map(({ avatar }) => avatar.url),
  }));

  return res.status(200).json({
    success: true,
    groups,
  });
});

// put req to add member in a group
const addMembers = TryCatch(async (req, res, next) => {
  const { chatId, members } = req.body;
  // to check member is provided and not empty
  // after implementing validator no use of this
  // if (!members || members.length < 1)
  //   return next(new ErrorHandler("Please Provide Members", 400));

  const chat = await Chat.findById(chatId);
  if (!chat) return next(new ErrorHandler("Chat Not Found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This Is Not A Group Chat", 400));

  if (chat.creator.toString() !== req.user.toString())
    return next(new ErrorHandler("You Are Not Allowed To Add Members", 403));

  const allNewMembersPromise = members.map((i) => User.findById(i, "name"));

  const allNewMembers = await Promise.all(allNewMembersPromise);

  const uniqueMembers = allNewMembers
    .filter((i) => !chat.members.includes(i._id.toString()))
    .map((i) => i._id);

  chat.members.push(...uniqueMembers);

  if (chat.members.length > 100)
    return next(new ErrorHandler("Group Members Limit Reached", 400));

  await chat.save();

  const allUsersName = allNewMembers.map((i) => i.name).join(",");

  emitEvent(
    req,
    ALERT,
    chat.members,
    `${allUsersName} Has Been Added To ${chat.name} Group`
  );
  emitEvent(req, REFETCH_CHATS, chat.members);

  return res.status(200).json({
    success: true,
    message: "Members Added Successfully",
  });
});

// remove member from the group
const removeMember = TryCatch(async (req, res, next) => {
  const { userId, chatId } = req.body;

  // after implementing validator no use of this
  // if (!userId) return next(new ErrorHandler("Please Provide userId", 400));

  const [chat, userThatWillBeRemoved] = await Promise.all([
    Chat.findById(chatId),
    User.findById(userId, "name"),
  ]);

  if (!chat) return next(new ErrorHandler("Chat Not Found", 404));
  if (!chat.groupChat)
    return next(new ErrorHandler("This Is Not A Group Chat", 400));
  if (chat.creator.toString() !== req.user.toString())
    return next(new ErrorHandler("You Are Not Allowed To Remove Members", 403));

  if (chat.members.length <= 3)
    return next(new ErrorHandler("Group Must Have Atleast 3 Members", 400));

  const allChatMembers = chat.members.map((i) => i.toString());

  chat.members = chat.members.filter(
    (member) => member.toString() !== userId.toString()
  );

  await chat.save();

  emitEvent(req, ALERT, chat.members, {
    message: `${userThatWillBeRemoved.name} Has Been Removed From The Group`,
    chatId,
  });
  emitEvent(req, REFETCH_CHATS, allChatMembers);

  return res.status(200).json({
    success: true,
    message: "Members remove Successfully",
  });
});

// leave Group handler
const leaveGroup = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat Not Found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This Is Not A Group Chat", 400));

  // find remaning member on the group
  const remainingMembers = chat.members.filter(
    (member) => member.toString() !== req.user.toString()
  );

  if (remainingMembers.length < 3)
    return next(new ErrorHandler("Group Must Have Atleast 3 Members", 400));

  // check condition if i am admin and if ieave the group then new admin asign randomly
  if (chat.creator.toString() === req.user.toString()) {
    const randomElement = Math.floor(Math.random() * remainingMembers.length);
    const newCreator = remainingMembers[randomElement];

    chat.creator = newCreator;
  }
  // after leaving group member updated
  chat.members = remainingMembers;

  // const user = await User.findById(req.user,"name") other syntax below
  // const [user] = await Promise.all([
  //   User.findById(req.user, "name"),
  //   chat.save(),
  // ]);
  const userPromise = User.findById(req.user, "name");

  const [user] = await Promise.all([userPromise, chat.save()]);

  emitEvent(req, ALERT, chat.members, {
    chatId,
    message: `User ${user.name} Has Left The Group`,
  });

  return res.status(200).json({
    success: true,
    message: "Leave Group Successfully",
  });
});

// sendAttachments message
const sendAttachments = TryCatch(async (req, res, next) => {
  const { chatId } = req.body;
  const files = req.files || [];

  if (files.length < 1)
    return next(new ErrorHandler("Please Provide Attachments", 400));

  if (files.length > 5)
    return next(new ErrorHandler("Files Can't Be More Than 5", 400));

  const [chat, me] = await Promise.all([
    Chat.findById(chatId),
    User.findById(req.user, "name"),
  ]);

  if (!chat) return next(new ErrorHandler("Chat Not Found", 404));

  // uploads files here
  const attachments = await uploadFilesToCloudinary(files);

  const messageForDB = {
    content: "",
    attachments,
    sender: me._id,
    chat: chatId,
  };

  const messageForRealTime = {
    ...messageForDB,
    sender: {
      _id: me._id,
      name: me.name,
      // avatar:me.avatar.url
    },
  };

  const message = await Message.create(messageForDB);

  emitEvent(req, NEW_MESSAGE, chat.members, {
    message: messageForRealTime,
    chatId,
  });

  emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId, sender: me._id });

  res.status(200).json({
    success: true,
    message,
  });
});

// get chat details(show which chat is open)
const getChatDetails = TryCatch(async (req, res, next) => {
  if (req.query.populate === "true") {
    const chat = await Chat.findById(req.params.id)
      .populate("members", "name avatar")
      .lean();

    if (!chat) return next(new ErrorHandler("Chat Not Found", 404));

    chat.members = chat.members.map(({ _id, name, avatar }) => ({
      _id,
      name,
      avatar: avatar.url,
    }));

    return res.status(200).json({
      success: true,
      chat,
    });
  } else {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return next(new ErrorHandler("Chat Not Found", 404));

    return res.status(200).json({
      success: true,
      chat,
    });
  }
});

// group rename handler by this admin can rename group name
const renameGroup = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;
  const { name } = req.body;

  if (!name) return next(new ErrorHandler("Please Provide Name"));
  const chat = await Chat.findById(chatId);
  if (!chat) return next(new ErrorHandler("Chat Not Found", 404));
  if (!chat.groupChat)
    return next(new ErrorHandler("This Is Not A Group Chat", 400));
  if (chat.creator.toString() !== req.user.toString())
    return next(
      new ErrorHandler("You Are Not Allowed To Rename The Group", 400)
    );

  chat.name = name;
  chat.save();

  emitEvent(req, REFETCH_CHATS, chat.members);

  return res.status(200).json({
    success: true,
    message: "Group Renamed Successfully",
  });
});

// delete chat
const deleteChat = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;

  const chat = await Chat.findById(chatId);
  if (!chat) return next(new ErrorHandler("Chat Not Found", 404));

  const members = chat.members;
  if (chat.groupChat && chat.creator.toString() !== req.user.toString())
    return next(
      new ErrorHandler("You Are Not Allowed To Delete The Chat", 403)
    );

  if (!chat.groupChat && !chat.members.includes(req.user.toString()))
    return next(
      new ErrorHandler("You Are Not Allowed To Delete The Chat", 403)
    );

  // here we have to delete all the messages as well as attathments or files from cloudnary
  const messagesWithAttachments = await Message.find({
    chat: chatId,
    attachments: { $exists: true, $ne: [] },
  });

  const public_ids = [];

  messagesWithAttachments.forEach(({ attachments }) =>
    attachments.forEach(({ public_id }) => public_ids.push(public_id))
  );

  await Promise.all([
    // delete files from cloudnary
    deleteFilesFromCloudnary(public_ids),
    chat.deleteOne(),
    Message.deleteMany({ chat: chatId }),
  ]);

  emitEvent(req, REFETCH_CHATS, members);

  return res.status(200).json({
    success: true,
    message: "Chat Deleted Successfully",
  });
});

// get messages (per page how many msgs show)
const getMessages = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;

  const { page = 1 } = req.query;
  const resultPerPage = 20;

  const skip = (page - 1) * resultPerPage;

  const chat = await Chat.findById(chatId);
  if (!chatId) return next(new ErrorHandler("Chat Not Found", 404));
  if (!chat.members.includes(req.user.toString()))
    return next(
      new ErrorHandler("You Are Not Allowed To Access This Chat", 403)
    );

  const [messages, totalMessagesCount] = await Promise.all([
    Message.find({ chat: chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(resultPerPage)
      .populate("sender", "name avatar")
      .lean(),
    Message.countDocuments({ chat: chatId }),
  ]);

  const totalPages = Math.ceil(totalMessagesCount / resultPerPage) || 0;

  return res.status(200).json({
    success: true,
    messages: messages.reverse(),
    totalPages,
  });
});

export {
  addMembers,
  deleteChat,
  getChatDetails,
  getMessages,
  getMyChats,
  getMyGroups,
  leaveGroup,
  newGroupChat,
  removeMember,
  renameGroup,
  sendAttachments,
};
