import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    getCommentLikes,
    getTweetLikes,
    getVideoLikes,
    toggleCommentLikes,
    toggleTweetLikes,
    toggleVideoLikes,
} from "../controllers/like.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/video-likes/:videoId").post(toggleVideoLikes).get(getVideoLikes);
router.route("/comment-likes/:commentId").post(toggleCommentLikes).get(getCommentLikes);
router.route("/tweet-likes/:tweetId").post(toggleTweetLikes).get(getTweetLikes);
export { router };
