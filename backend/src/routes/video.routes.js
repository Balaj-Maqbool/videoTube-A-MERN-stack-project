import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

import {
    getVideoDetails,
    updateVideoCredentials,
    uploadAVideo,
    deleteAVideo,
    toggleIsPublished,
    toggleViews,
    getAllVideos,
} from "../controllers/video.controller.js";

const router = Router();

router.route("/upload-video").post(
    verifyJWT,
    upload.fields([
        { name: "videoFile", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
    ]),
    uploadAVideo
);

router.route("/video-details/:videoId").get(getVideoDetails);
router
    .route("/update-video-credentials/:videoId")
    .patch(verifyJWT, upload.single("thumbnail"), updateVideoCredentials);
    
router.route("/delete-video/:videoId").delete(verifyJWT, deleteAVideo);
router.route("/toggle-publish-status/:videoId").patch(verifyJWT, toggleIsPublished);
router.route("/add-views/:videoId").get(toggleViews);

router.route("/").get(getAllVideos);
export { router };
