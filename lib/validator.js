import { body, param, validationResult } from "express-validator";
import { ErrorHandler } from "../middlewares/error.js";

// validatotHandler if error comes
const validateHandler = (req, res, next) => {
  const errors = validationResult(req);

  const errorMessages = errors
    .array()
    .map((error) => error.msg)
    .join(", ");

  if (errors.isEmpty()) return next();
  else next(new ErrorHandler(errorMessages, 400));
};

// register validator
const registerValidator = () => [
  body("name", "Please Enter Name").notEmpty(),
  body("username", "Please Enter Username").notEmpty(),
  body("password", "Please Enter Password").notEmpty(),
  body("bio", "Please Enter Bio").notEmpty(),
];
// login validator
const loginValidator = () => [
  body("username", "Please Enter Username").notEmpty(),
  body("password", "Please Enter Password").notEmpty(),
];

// Chat vaidator starts from here
// login validator
const newGroupChatValidator = () => [
  body("name", "Please Enter Group Name").notEmpty(),
  body("members")
    .notEmpty()
    .withMessage("Please Add Members")
    .isArray({ min: 2, max: 100 })
    .withMessage("Members Must Be 2-100"),
];

// add member in group validator
const addmembersValidator = () => [
  body("chatId", "Please Enter Chat Id ").notEmpty(),
  body("members")
    .notEmpty()
    .withMessage("Please Add Members")
    .isArray({ min: 1, max: 97 })
    .withMessage("Members Must Be 1-97"),
];

// remove member in group validator
const removeMemberValidator = () => [
  body("chatId", "Chat Id Is Require").notEmpty(),
  body("userId", "User Id Is Require").notEmpty(),
];
// leave from group
const leaveGroupValidator = () => [
  param("id", "Chat Id Is Require").notEmpty(),
];

// sendAttachments from group
const sendAttachmentsValidator = () => [
  body("chatId", "Chat Id Is Require").notEmpty(),
];

// chat validator which check id must be not empty
const chatIdValidator = () => [param("id", "Chat Id Is Require").notEmpty()];

// renameGroupValidator ( to rename group)
const renameGroupValidator = () => [
  body("name", "Please Enter Group Name").notEmpty(),
];

// send friend request validator
const sendFriendRequestValidator = () => [
  body("userId", "User Id Is Require").notEmpty(),
];
// send friend request validator
const acceptFriendRequestValidator = () => [
  body("requestId", "Request Id Is Require").notEmpty(),
  body("accept")
    .notEmpty()
    .withMessage("Please Add Accept")
    .isBoolean()
    .withMessage("Accept Must Be Boolean"),
];

export {
  acceptFriendRequestValidator,
  addmembersValidator,
  chatIdValidator,
  leaveGroupValidator,
  loginValidator,
  newGroupChatValidator,
  registerValidator,
  removeMemberValidator,
  renameGroupValidator,
  sendAttachmentsValidator,
  sendFriendRequestValidator,
  validateHandler,
};
