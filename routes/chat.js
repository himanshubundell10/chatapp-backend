import express from "express";
import {
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
} from "../controllers/chat.js";
import {
  addmembersValidator,
  chatIdValidator,
  leaveGroupValidator,
  newGroupChatValidator,
  removeMemberValidator,
  renameGroupValidator,
  sendAttachmentsValidator,
  validateHandler,
} from "../lib/validator.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { attachmentsMulter } from "../middlewares/multer.js";

const app = express.Router();

app.use(isAuthenticated);

// to create group chat 
// route-api/v1/chat/new
app.post("/new", newGroupChatValidator(), validateHandler, newGroupChat);

// get my chat which show on left side of the app
// route-api/v1/chat/my
app.get("/my", getMyChats);

// route-api/v1/chat/my/groups
app.get("/my/groups", getMyGroups);

// route-api/v1/chat/addmembers
app.put("/addmembers", addmembersValidator(), validateHandler, addMembers);

// route-api/v1/chat/removemember
app.put(
  "/removemember",
  removeMemberValidator(),
  validateHandler,
  removeMember
);

// route-api/v1/chat/leave/:id
app.delete("/leave/:id", leaveGroupValidator(), validateHandler, leaveGroup);

// send attachments
// route-api/v1/chat/message
app.post(
  "/message",
  attachmentsMulter,
  sendAttachmentsValidator(),
  validateHandler,
  sendAttachments
);

// route-api/v1/chat/message/:id
app.get("/message/:id", chatIdValidator(), validateHandler, getMessages);

// get chat details(chats details show which chat is open) ,rename(group only admin can do this),delete chat
// route=api/v1/chat/:id
app
  .route("/:id")
  .get(chatIdValidator(), validateHandler, getChatDetails)
  .put(renameGroupValidator(), validateHandler, renameGroup)
  .delete(chatIdValidator(), validateHandler, deleteChat);

export default app;
