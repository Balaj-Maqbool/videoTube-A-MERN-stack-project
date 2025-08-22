import { promiseAsyncHandler as asyncHandler } from "../utils/AsyncHandler.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import mongoose from "mongoose";

const uploadAVideo = asyncHandler(async (req, res) => {
    const { videoFile, thumbnail, title, description } = req.body;
    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const videoFileLocalPath = await req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = await req.files?.thumbnail?.[0]?.path;

    if (!thumbnailLocalPath) {
        throw new ApiError(404, "Thumbnail not found!!");
    }

    if (!videoFileLocalPath) {
        throw new ApiError(404, "video File not found!!");
    }
    const uploadedVideoFile = await uploadOnCloudinary(videoFileLocalPath);
    const uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!uploadedVideoFile?.url) {
        throw new ApiError(424, "Video File can't be uploaded");
    }

    if (!uploadedThumbnail?.url) {
        throw new ApiError(424, "Thumbnail File can't be uploaded");
    }
    // console.log(uploadedVideoFile,uploadedThumbnail);

    const createdVideo = await Video.create({
        title: title?.trim(),
        description: description?.trim(),
        thumbnail: uploadedThumbnail?.url,
        videoFile: uploadedVideoFile?.url,
        duration: uploadedVideoFile?.duration || 0,
        videoFilePublicId: uploadedVideoFile?.public_id,
        thumbnailPublicId: uploadedThumbnail?.public_id,
        owner: req.user?._id,
    });

    if (!createdVideo) {
        throw new ApiError(500, "Video can't be uploaded right now");
    }

    // console.log(video);

    return res
        .status(201)
        .json(new ApiResponse(200, createdVideo, "Video File Uploaded Successfully!!"));
});

const getVideoDetails = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!videoId) {
        throw new ApiError(400, "Video Id not found");
    }
    const videoDetails = await Video.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(videoId) },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        {
            $unwind: "$owner",
        },
        {
            $addFields: {
                ownerDetails: {
                    username: "$owner.username",
                    fullName: "$owner.fullName",
                    email: "$owner.email",
                },
            },
        },
        {
            $project: {
                title: 1,
                thumbnail: 1,
                description: 1,
                videoFile: 1,
                ownerDetails: 1,
            },
        },
    ]);
    if (!videoDetails?.length) {
        throw new ApiError(404, "The Video Does not exist in the database ");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, videoDetails[0], "Video Owner Data fetch successfully !!"));
});

const updateVideoCredentials = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { videoId } = req.params;
    const { title, description } = req.body;
    if (!userId) {
        throw new ApiError(403, "User not Logged In");
    }

    if (!videoId) {
        throw new ApiError(404, "Video Id not found in the url");
    }

    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required to change the video credentials");
    }

    const thumbnailLocalPath = req.file?.path;
    if (!thumbnailLocalPath) {
        throw new ApiError(404, "Thumbnail file path not found");
    }
    const uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!uploadedThumbnail?.url) {
        throw new ApiError(424, "thumbnail File can't be uploaded on cloudinary");
    }
    const updatedVideo = await Video.findOneAndUpdate(
        {
            $and: [{ _id: new mongoose.Types.ObjectId(videoId) }, { owner: userId }],
        },
        {
            $set: {
                title: title,
                description: description,
                thumbnail: uploadedThumbnail?.url,
            },
            new: true,
        }
    ).select("-videoFile");
    console.log(updatedVideo);

    if (!updatedVideo) {
        throw new ApiError(
            403,
            "Unauthorized Access , Video Id is Wrong or the User is not Allowed "
        );
    }
    return res
        .status(202)
        .json(new ApiResponse(202, updatedVideo, "Video credentials updated successfully"));
});

const deleteAVideo = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { videoId } = req.params;
    if (!videoId) {
        throw new ApiError(404, "Video Id not found in the url");
    }
    if (!userId) {
        throw new ApiError(403, "User not Logged In");
    }
    const video = await Video.findOne({
        $and: [{ _id: new mongoose.Types.ObjectId(videoId) }, { owner: userId }],
    });
    // console.log(video);

    if (!video) {
        throw new ApiError(
            403,
            "Unauthorized Access , Video Id is Wrong or the User is not Allowed"
        );
    }
    const deleteVideoFile = await deleteFromCloudinary(video?.videoFilePublicId, "video");
    const deleteThumbnail = await deleteFromCloudinary(video?.thumbnailPublicId, "image");
    // console.log(deleteThumbnail, deleteVideoFile);

    if (deleteVideoFile?.result !== "ok") {
        throw new ApiError(404, "video not found on Cloudinary");
    }
    if (deleteThumbnail.result !== "ok") {
        throw new ApiError(404, "Thumbnail not found on cloudinary");
    }
    const deletedVideo = await Video.findByIdAndDelete(video._id).select(
        " title description duration -_id "
    );
    if (!deletedVideo) {
        throw new ApiError(404, "No video was found to delete");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, deletedVideo, "Video deleted Successfully from the DB"));
});

const toggleIsPublished = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { videoId } = req.params;
    if (!videoId) {
        throw new ApiError(404, "Video Id not found in the url");
    }
    if (!userId) {
        throw new ApiError(404, "User not found, or is logged out");
    }
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(400, "Video not found, wrong ID");
    }
    // console.log(video);

    // video.isPublished = !video?.isPublished
    // const updatedVideo = await video.save();

    const updatedVideo = await Video.findOneAndUpdate(
        {
            $and: [{ _id: new mongoose.Types.ObjectId(videoId) }, { owner: userId }],
        },
        {
            $set: {
                isPublished: !video?.isPublished,
            },
            $inc: { views: 0 },
            new: true,
        }
    ).select("isPublished _id title isPublished owner views");
    if (!updatedVideo) {
        throw new ApiError(403, "Unauthorized Access !!! Wrong User or Video Id");
    }
    return res
        .status(202)
        .json(new ApiResponse(200, updatedVideo, "Video Publish status toggled successfully"));
});

const toggleViews = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!videoId) {
        throw new ApiError(404, "Video Id not found in the url");
    }
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(400, "Video not found, wrong ID");
    }

    const updatedVideo = await Video.findByIdAndUpdate(videoId, {
        $inc: { views: 1 },
        new: true,
        projection: { __v: 0 },
    }).select("_id title views");
    if (!updatedVideo) {
        throw new ApiError(500, "published status cannot be toggled right now");
    }
    return res
        .status(202)
        .json(new ApiResponse(200, updatedVideo, "Views increased Successfully!!"));
});
const getAllVideos = asyncHandler(async (req, res) => {
    const page = req.query?.page || 1;
    const limit = req.query?.limit || 3;
    const sortBy = req.query?.sortBy || "views";
    const order = req.query?.order === "asc" ? 1 : -1;
    const username = req.query?.username || "";
    const pipeline = [];
    if (username) {
        const user = await User.findOne({ username: username.trim() }).select("_id");
        if (!user) {
            throw new ApiError(404, "The User Does Not Exists , Wrong username");
        } else {
            pipeline.push({
                $match: { owner: user?._id },
            });
        }
    }
    pipeline.push(
        {
            $sort: { [sortBy]: order },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        {
            $addFields: {
                ownerDetails: {
                    username: { $first: "$owner.username" },
                    fullName: { $first: "$owner.fullName" },
                    email: { $first: "$owner.email" },
                },
            },
        },
        {
            $project: {
                _id: 1,
                isPublished: 1,
                title: 1,
                thumbnail: 1,
                description: 1,
                videoFile: 1,
                views: 1,
                ownerDetails: 1,
            },
        }
    );

    const videos = await Video.aggregatePaginate(Video.aggregate(pipeline), { page, limit });
    // console.log(videos);

    // if (JSON.stringify(videos?.docs)===JSON.stringify([])) {
    //     throw new ApiError(404, "No Videos were found in the DB")
    // }

    return res.status(200).json(new ApiResponse(200, videos, "All videos Fetched Successfully"));
});

export {
    uploadAVideo,
    getVideoDetails,
    updateVideoCredentials,
    deleteAVideo,
    toggleIsPublished,
    toggleViews,
    getAllVideos,
};
