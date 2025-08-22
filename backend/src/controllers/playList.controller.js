import { Types } from "mongoose";
import { PlayList } from "../models/playList.model.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { promiseAsyncHandler as asyncHandler } from "../utils/AsyncHandler.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";

const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    const userId = req?.user?._id;
    if (!name?.trim()) {
        throw new ApiError(400, "Playlist must have a name ");
    } else if (!description?.trim()) {
        throw new ApiError(400, "Playlist must have a description ");
    }
    if (!userId) {
        throw new ApiError(404, "User not Found!!!");
    }

    let newPlayList = await PlayList.create({
        name: name?.trim(),
        description: description?.trim(),
        playListOwner: userId,
    });
    await newPlayList.populate("playListOwner", "username email _id ");

    if (!newPlayList) {
        throw new ApiError(500, "Playlist cant be generated right now");
    }

    return res
        .status(201)
        .json(new ApiResponse(200, newPlayList, "A playlist created Successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { page, limit, username } = req.query;
    const order = req.query?.order == "asc" ? 1 : -1;
    const options = {
        page: Number(page) || 1,
        limit: Number(limit) || 5,
    };

    const pipeline = [];
    if (username) {
        const user = await User.findOne({ username: username.trim() }).select("_id");
        if (!user) {
            throw new ApiError(404, "The User Does Not Exists , Wrong username");
        } else {
            pipeline.push({
                $match: { playListOwner: user?._id },
            });
        }
    }

    pipeline.push(
        {
            $addFields: {
                videoCount: { $size: "$videos" },
            },
        },
        {
            $sort: { videoCount: order },
        },
        {
            $lookup: {
                from: "users",
                localField: "playListOwner",
                foreignField: "_id",
                as: "playListOwner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            _id: 1,
                            fullName: 1,
                            email: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$playListOwner",
        },
        {
            $project: {
                _id: 1,
                name: 1,
                videos: 1,
                playListOwner: 1,
            },
        }
    );
    const allPlayLists = await PlayList.aggregatePaginate(PlayList.aggregate(pipeline), options);

    res.status(200).json(new ApiResponse(200, allPlayLists, "All Playlist fetched Successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const userId = req?.user?._id;
    if (!playlistId?.trim()) {
        throw new ApiError(404, "Playlist Id Not Found");
    }

    // for .find(), it always returns an empty Array [], which is a truthly value

    const playlist = await PlayList.aggregate([
        {
            $match: {
                $and: [{ _id: new Types.ObjectId(playlistId?.trim()) }, { playListOwner: userId }],
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "playListOwner",
                foreignField: "_id",
                as: "playListOwner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            _id: 1,
                            fullName: 1,
                            email: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$playListOwner",
        },
        {
            $project: {
                _id: 1,
                name: 1,
                videos: 1,
                playListOwner: 1,
            },
        },
    ]);
    // console.log(playlist);

    if (!playlist?.[0]) {
        throw new ApiError(403, "No Playlist was found , Wrong Id or Wrong Owner");
    }
    return res
        .status(200)
        .json(new ApiResponse(200, playlist[0], "A Playlist fetched Successfully!!"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;
    if (!playlistId?.trim()) {
        throw new ApiError(404, "Playlist Id Missing ");
    }
    if (!videoId?.trim()) {
        throw new ApiError(404, "Video Id  Missing ");
    }
    const confirmedVideoId = await Video.findOne({ _id: videoId?.trim() }).select("_id");
    if (!confirmedVideoId) {
        throw new ApiError(403, "Unauthorized Access , This Video does not exist ");
    }
    const videoAddedPlaylist = await PlayList.findByIdAndUpdate(
        playlistId,
        {
            // $push: { videos: videoId}, just pushes no check for duplication
            $addToSet: { videos: confirmedVideoId }, // checks if videoId already exists in the videos field
        },
        {
            new: true,
        }
    ).populate("playListOwner", "_id username fullName email");
    if (!videoAddedPlaylist) {
        throw new ApiError(403, "Playlist Does not exists, Wrong Id");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, videoAddedPlaylist, "Video Added  to the Playlist"));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;
    if (!playlistId?.trim()) {
        throw new ApiError(404, "Playlist Id Missing ");
    }
    if (!videoId?.trim()) {
        throw new ApiError(404, "Video Id  Missing ");
    }
    const confirmedVideoId = await Video.findOne({ _id: videoId?.trim() }).select("_id");
    if (!confirmedVideoId) {
        throw new ApiError(403, "Unauthorized Access , This Video does not exist ");
    }
    // console.log(confirmedVideoId);

    const videoRemovedPlaylist = await PlayList.findByIdAndUpdate(
        playlistId?.trim(),
        {
            $pull: { videos: confirmedVideoId._id },
        },
        {
            new: true,
        }
    )
        .populate("playListOwner", "_id username")
        .select("_id name videos");

    if (!videoRemovedPlaylist) {
        throw new ApiError(403, "Playlist Does not exist in the DB");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                videoRemovedPlaylist,
                "Video from the Playlist is deleted Successfully"
            )
        );
});

const deletePlaylist = asyncHandler(async (req, res) => {
    const userId = req?.user?._id;
    const { playlistId } = req.params;

    if (!playlistId?.trim()) {
        throw new ApiError(404, "Playlist Id Not Found");
    }
    const playlist = await PlayList.findOneAndDelete(
        {
            $and: [{ _id: new Types.ObjectId(playlistId?.trim()) }, { playListOwner: userId }],
        },
        {
            new: true,
        }
    )
        .populate("playListOwner", "username email _id ")
        .select("name description playListOwner");
    if (!playlist) {
        throw new ApiError(403, " Unauthorized Access, Wrong Id or Wrong Owner");
    }

    return res
        .status(204)
        .json(new ApiResponse(200, playlist, "Playlist Deleted successfully !!!"));
});

const updatePlaylistCredentials = asyncHandler(async (req, res) => {
    const userId = req?.user?._id;
    const { playlistId } = req.params;
    const { name, description } = req.body;

    if (!playlistId?.trim()) {
        throw new ApiError(404, "Playlist Id Not Found");
    }

    if (!name?.trim()) {
        throw new ApiError(400, "Playlist must have a name ");
    } else if (!description?.trim()) {
        throw new ApiError(400, "Playlist must have a description ");
    }
    const playlist = await PlayList.findOneAndUpdate(
        {
            $and: [{ _id: new Types.ObjectId(playlistId?.trim()) }, { playListOwner: userId }],
        },
        {
            $set: {
                name: name.trim(),
                description: description.trim(),
            },
        }
    )
        .populate("playListOwner", "username email -_id")
        .select("name description playListOwner");
    if (!playlist) {
        throw new ApiError(403, "No Playlist was found , Wrong Id or Wrong Owner");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Playlist Updated successfully !!!"));
});

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylistCredentials,
};
