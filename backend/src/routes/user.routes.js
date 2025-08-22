import { Router } from "express"; // direct method
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    updatePassword,
    getCurrentUser,
    updateUserInfo,
    updateTheAvatar,
    updateTheCoverImage,
    getUserChannelUpdates,
    getUserWatchHistory,
    addVideoToWatchHistory,
} from "../controllers/user.controller.js";

import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1,
        },
        {
            name: "coverImage",
            maxCount: 1,
        },
    ]),
    registerUser
);

router.route("/login").post(loginUser);

// secured routes // authenticated routes

router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/update-password").post(verifyJWT, updatePassword);
router.route("/me").get(verifyJWT, getCurrentUser);
router.route("/update-user-info").patch(verifyJWT, updateUserInfo);

router.route("/update-avatar").patch(upload.single("avatar"), verifyJWT, updateTheAvatar);

router
    .route("/update-coverImage")
    .patch(upload.single("coverImage"), verifyJWT, updateTheCoverImage);
router.route("/addVideo-to-watch-history/:videoId").patch(verifyJWT, addVideoToWatchHistory);
router.route("/channel/:username").get(verifyJWT, getUserChannelUpdates);
router.route("/watch-history").get(verifyJWT, getUserWatchHistory);

export { router };

// import express from "express"
// const router = express.Router() // indirect  method
