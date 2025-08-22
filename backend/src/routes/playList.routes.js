import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
    addVideoToPlaylist,
    createPlaylist,
    deletePlaylist,
    getPlaylistById,
    getUserPlaylists,
    removeVideoFromPlaylist,
    updatePlaylistCredentials,
} from "../controllers/playList.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/").get(getUserPlaylists);
router.route("/create-playlist").post(createPlaylist);
router.route("/find-playlist/:playlistId").get(getPlaylistById);
router.route("/update-playlist/:playlistId").patch(updatePlaylistCredentials);
router.route("/delete-playlist/:playlistId").delete(deletePlaylist);
router.route("/addVideo-to-playlist/:playlistId/:videoId").patch(addVideoToPlaylist);
router.route("/removeVideo-from-playlist/:playlistId/:videoId").patch(removeVideoFromPlaylist);

export { router };
