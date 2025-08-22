import { Types } from "mongoose";
import { Comment } from "../models/comment.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import { trycatchAsyncHandler as asyncHandler } from "../utils/AsyncHandler.js";
import { throwIfInvalid } from "../utils/validators.js";
import { Video } from "../models/video.model.js";

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const page = Number(req.query?.page) || 1;
    const limit = Number(req.query?.limit) || 5;
    const options = { page, limit };

    throwIfInvalid(!videoId, 400, "Video Id is Required");
    throwIfInvalid(!Types.ObjectId.isValid(videoId), 400, "Video Id is Invalid !!!");

    const video = await Video.findById(videoId);
    throwIfInvalid(!video, 404, "Video Not Found");

    const pipeline = [
        {
            $match: {
                video: video._id,
            },
        },
        {
            $sort: {
                createdAt: -1,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "commentOwner",
                foreignField: "_id",
                as: "commentOwner",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            ownerId: "$_id",
                            ownerName: "$username",
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$commentOwner",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                updatedAt: 0,
                __v: 0,
                video: 0,
            },
        },
    ];
    const allComments = await Comment.aggregatePaginate(Comment.aggregate(pipeline), options);

    res.status(200).json(
        new ApiResponse(
            200,
            allComments,
            "All Comments fetched Successfully 'commentCount = totalDocs' "
        )
    );
});

const addComment = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { videoId } = req.params;
    const { content } = req.body;

    throwIfInvalid(!userId, 403, "User must be Logged In");
    throwIfInvalid(!videoId, 400, "Video Id is Required");
    throwIfInvalid(!Types.ObjectId.isValid(videoId), 400, "Video Id is Invalid !!!");
    throwIfInvalid(!content.trim(), 400, "Comment cannot be empty ");

    const confirmedVideo = await Video.findById(videoId).select("_id owner");
    throwIfInvalid(!confirmedVideo._id, 404, "Video with this Id does not exists");

    const newComment = await Comment.create({
        content: content,
        video: confirmedVideo._id,
        commentOwner: userId,
    });

    const comment = await Comment.aggregate([
        {
            $match: {
                _id: newComment?._id,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "commentOwner",
                foreignField: "_id",
                as: "commentOwner",
                pipeline: [
                    {
                        $project: {
                            ownerId: "$_id",
                            ownerName: "$username",
                            _id: 0,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$commentOwner",
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
                pipeline: [
                    {
                        $project: {
                            videoId: "$_id",
                            videoTitle: "$title",
                            _id: 0,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$video",
        },
        {
            $project: {
                _id: 0,
                content: 1,
                commentOwner: 1,
                video: 1,
                commentId: "$_id",
            },
        },
    ]);

    return res.status(201).json(new ApiResponse(200, comment[0], "Comment created Successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { commentId } = req.params;
    const { content } = req.body;

    throwIfInvalid(!userId, 403, "User must be Logged In");
    throwIfInvalid(!content.trim(), 400, "Comment cannot be empty ");
    throwIfInvalid(!commentId, 400, "Comment Id is Required");
    throwIfInvalid(!Types.ObjectId.isValid(commentId), 400, "Comment id is Invalid");

    const comment = await Comment.findById(commentId);
    throwIfInvalid(!comment, 404, "Comment not Found, wrong Id");

    throwIfInvalid(!comment.commentOwner.equals(userId), 403, "You can only edit Your own Comment");
    comment.content = content;
    await comment.save();

    const updatedComment = await Comment.aggregate([
        {
            $match: { _id: comment._id },
        },
        {
            $project: {
                _id: 0,
                commentId: "$_id",
                updatedContent: "$content",
                videoId: "$video",
                commentOwner: 1,
            },
        },
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, updatedComment, "Comment Updated Successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { commentId } = req.params;

    throwIfInvalid(!userId, 403, "User must be Logged In");
    throwIfInvalid(!commentId, 400, "Comment Id is Required");
    throwIfInvalid(!Types.ObjectId.isValid(commentId), 400, "Comment id is Invalid");

    const comment = await Comment.findById(commentId);
    throwIfInvalid(!comment, 404, "Comment not Found, or Already deleted");

    throwIfInvalid(
        !comment.commentOwner.equals(userId),
        403,
        "You can only Delete Your own Comment"
    );

    const deletedComment = await Comment.findOneAndDelete({
        _id: comment._id,
    }).select("-createdAt -updatedAt -__v");

    return res
        .status(200)
        .json(new ApiResponse(200, deletedComment, "Comment Deleted Successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
