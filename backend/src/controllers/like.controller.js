import { Types } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { promiseAsyncHandler as asyncHandler } from "../utils/AsyncHandler.js";
import { throwIfInvalid } from "../utils/validators.js";
import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { Tweet } from "../models/tweet.model.js";

const toggleVideoLikes = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const videoId = req.params.videoId;

    throwIfInvalid(!Types.ObjectId.isValid(userId), 400, "Invalid User Id");
    throwIfInvalid(!videoId, 400, "Video Id Missing");
    throwIfInvalid(!Types.ObjectId.isValid(videoId), 400, "Invalid Video Id");

    const video = await Video.findById(videoId);
    throwIfInvalid(!video, 404, "Video Not Found, Wrong Id");

    if (video.owner.equals(userId)) {
        throw new ApiError(403, "You cannot toggle likes on your own Video");
    }

    const like = await Like.findOne({
        likedBy: userId,
        video: video._id,
    });

    if (like) {
        const removedLike = await Like.findByIdAndDelete(like._id).select(
            "-createdAt -updatedAt -__v"
        );
        throwIfInvalid(!removedLike, 500, "Like cannot be removed right now");
        return res
            .status(200)
            .json(new ApiResponse(200, removedLike, "Like removed from the  Video Successfully"));
    }

    const addedLike = await Like.create({
        likedBy: userId,
        video: video._id,
    });
    throwIfInvalid(!addedLike, 500, "Like cannot be added right now");
    const addedLikeDetails = {
        _id: addedLike._id,
        likedBy: addedLike.likedBy,
        video: addedLike.video,
    };
    return res
        .status(201)
        .json(new ApiResponse(200, addedLikeDetails, "Like added to a Video Successfully"));
});

const toggleCommentLikes = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const commentId = req.params.commentId;

    throwIfInvalid(!Types.ObjectId.isValid(userId), 400, "Invalid User Id");
    throwIfInvalid(!commentId, 400, "Comment Id Missing");
    throwIfInvalid(!Types.ObjectId.isValid(commentId), 400, "Invalid Comment Id");

    const comment = await Comment.findById(commentId);
    throwIfInvalid(!comment, 404, "Comment Not Found, Wrong Id");

    if (comment.commentOwner.equals(userId)) {
        throw new ApiError(403, "You cannot toggle likes on your own Comment");
    }
    const like = await Like.findOne({
        likedBy: userId,
        comment: comment._id,
    });

    if (like) {
        const removedLike = await Like.findByIdAndDelete(like._id).select(
            "-createdAt -updatedAt -__v"
        );
        throwIfInvalid(!removedLike, 500, "Like cannot be removed right now");
        return res
            .status(200)
            .json(new ApiResponse(200, removedLike, "Like removed from the  Comment Successfully"));
    }

    const addedLike = await Like.create({
        likedBy: userId,
        comment: comment._id,
    });
    throwIfInvalid(!addedLike, 500, "Like cannot be added right now");
    const addedLikeDetails = {
        _id: addedLike._id,
        comment: addedLike.comment,
        likedBy: addedLike.likedBy,
    };
    return res
        .status(201)
        .json(new ApiResponse(200, addedLikeDetails, "Like added to a Comment Successfully"));
});

const toggleTweetLikes = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const tweetId = req.params.tweetId;

    throwIfInvalid(!Types.ObjectId.isValid(userId), 400, "Invalid User Id");
    throwIfInvalid(!tweetId, 400, "Tweet Id Missing");
    throwIfInvalid(!Types.ObjectId.isValid(tweetId), 400, "Invalid Tweet Id");

    const tweet = await Tweet.findById(tweetId);
    throwIfInvalid(!tweet, 404, "Tweet Not Found, Wrong Id");

    if (tweet.tweetOwner.equals(userId)) {
        throw new ApiError(403, "You cannot toggle likes on your own Tweet");
    }
    const like = await Like.findOne({
        likedBy: userId,
        tweet: tweet._id,
    });

    if (like) {
        const removedLike = await Like.findByIdAndDelete(like._id).select(
            "-createdAt -updatedAt -__v"
        );
        throwIfInvalid(!removedLike, 500, "Like cannot be removed right now");
        return res
            .status(200)
            .json(new ApiResponse(200, removedLike, "Like removed from the  Tweet Successfully"));
    }

    const addedLike = await Like.create({
        likedBy: userId,
        tweet: tweet._id,
    });
    throwIfInvalid(!addedLike, 500, "Like cannot be added right now");
    const addedLikeDetails = {
        _id: addedLike._id,
        likedBy: addedLike.likedBy,
        tweet: addedLike.tweet,
    };
    return res
        .status(201)
        .json(new ApiResponse(200, addedLikeDetails, "Like added to a Tweet Successfully"));
});

const getVideoLikes = asyncHandler(async (req, res) => {
    const videoId = req.params.videoId;

    throwIfInvalid(!videoId, 400, "Video Id Missing");
    throwIfInvalid(!Types.ObjectId.isValid(videoId), 400, "Invalid Video Id");

    const video = await Video.findById(videoId);
    throwIfInvalid(!video, 404, "Video Not Found, Wrong Id");
    let videoLikesDetail = await Like.aggregate([
        {
            $match: {
                video: video._id,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "likedBy",
                foreignField: "_id",
                as: "likedBy",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            username: 1,
                            email: 1,
                            fullName: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$likedBy",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $group: {
                _id: "$video",
                totalVideoLikes: { $sum: 1 },
                likes: {
                    $push: { like_id: "$_id", video_id: "$video", likedBy: "$likedBy" },
                },
            },
        },
    ]);
    // console.log(videoLikesDetail);

    if (JSON.stringify(videoLikesDetail) === "[]") {
        return res.status(200).json(new ApiResponse(200, { _id: video._id, totalVideoLikes: 0 }));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, videoLikesDetail[0], "All video likes fetched Successfully"));
});

const getTweetLikes = asyncHandler(async (req, res) => {
    const tweetId = req.params.tweetId;

    throwIfInvalid(!tweetId, 400, "Tweet Id Missing");
    throwIfInvalid(!Types.ObjectId.isValid(tweetId), 400, "Invalid Tweet Id");

    const tweet = await Tweet.findById(tweetId);
    throwIfInvalid(!tweet, 404, "Tweet Not Found, Wrong Id");
    let tweetLikesDetail = await Like.aggregate([
        {
            $match: {
                tweet: tweet._id,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "likedBy",
                foreignField: "_id",
                as: "likedBy",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            username: 1,
                            email: 1,
                            fullName: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$likedBy",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $group: {
                _id: "$tweet",
                totalTweetLikes: { $sum: 1 },
                likes: {
                    $push: { like_id: "$_id", tweet_id: "$tweet", likedBy: "$likedBy" },
                },
            },
        },
    ]);

    if (JSON.stringify(tweetLikesDetail) === "[]") {
        return res.status(200).json(new ApiResponse(200, { _id: tweet._id, totalTweetLikes: 0 }));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, tweetLikesDetail[0], "All Tweet likes fetched Successfully"));
});

const getCommentLikes = asyncHandler(async (req, res) => {
    const commentId = req.params.commentId;

    throwIfInvalid(!commentId, 400, "Comment Id Missing");
    throwIfInvalid(!Types.ObjectId.isValid(commentId), 400, "Invalid Comment Id");

    const comment = await Comment.findById(commentId);
    throwIfInvalid(!comment, 404, "Comment Not Found, Wrong Id");
    let commentLikesDetail = await Like.aggregate([
        {
            $match: {
                comment: comment._id,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "likedBy",
                foreignField: "_id",
                as: "likedBy",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            username: 1,
                            email: 1,
                            fullName: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$likedBy",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $group: {
                _id: "$comment",
                totalCommentLikes: { $sum: 1 },
                likes: {
                    $push: { like_id: "$_id", comment_id: "$comment", likedBy: "$likedBy" },
                },
            },
        },
    ]);

    if (JSON.stringify(commentLikesDetail) === "[]") {
        return res
            .status(200)
            .json(new ApiResponse(200, { _id: comment._id, totalCommentLikes: 0 }));
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, commentLikesDetail[0], "All Comment likes fetched Successfully")
        );
});

export {
    toggleVideoLikes,
    toggleCommentLikes,
    toggleTweetLikes,
    getVideoLikes,
    getTweetLikes,
    getCommentLikes,
};
