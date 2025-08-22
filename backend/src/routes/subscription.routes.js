import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getSubscribedChannels,
  getUserChannelSubscribers,
  toggleSubscription,
} from "../controllers/subscription.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/toggle-subscription/:channelId").post(toggleSubscription);
router.route("/channel-subscribers-details/:channelId").get(getUserChannelSubscribers);
router.route("/subscribed-to-channels-details/:subscriberId").get(getSubscribedChannels);

export { router };
