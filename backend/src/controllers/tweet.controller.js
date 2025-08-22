import { Types } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import { promiseAsyncHandler as asyncHandler } from "../utils/AsyncHandler.js";
import { cleanQuotedString, throwIfInvalid } from "../utils/validators.js";

const createTweet = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const content = cleanQuotedString(req.body.content);
    throwIfInvalid(!userId, 403, "User must be Logged In");
    throwIfInvalid(!content, 400, "Comment cannot be empty ");
    const tweet = await Tweet.create({
        tweetOwner: userId,
        content: content,
    });
    throwIfInvalid(!tweet, 500, "Tweet cant't be created right now ");
    return res.status(201).json(new ApiResponse(200, tweet, "Tweet created Successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
    const username = cleanQuotedString(req.params?.username) || "";
    const page = Number(req.query?.page) || 1;
    const limit = Number(req.query?.limit) || 7;
    const options = { page, limit };
    const pipeline = [];
    console.log(username);

    if (username) {
        const user = await User.findOne({
            username: username,
        }).select("_id");
        throwIfInvalid(!user?._id, 404, "User Not Found or wrong username");
        pipeline.push({
            $match: {
                tweetOwner: user._id,
            },
        });
    }
    pipeline.push(
        {
            $sort: {
                createdAt: 1,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "tweetOwner",
                foreignField: "_id",
                as: "tweetOwner",
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
                path: "$tweetOwner",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                updatedAt: 0,
                __v: 0,
                video: 0,
            },
        }
    );

    const tweets = await Tweet.aggregatePaginate(Tweet.aggregate(pipeline), options);
    res.status(200).json(new ApiResponse(200, tweets, "All tweets Fetched Successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { content } = req.body;
    const { tweetId } = req.params;

    throwIfInvalid(!userId, 403, "User must be Logged In");
    throwIfInvalid(!tweetId.trim(), 400, "Tweet Id is Required");
    throwIfInvalid(!Types.ObjectId.isValid(tweetId), 400, "Tweet Id is Invalid !!!");
    throwIfInvalid(!content.trim(), 400, "Comment cannot be empty ");

    const tweet = await Tweet.findById(tweetId.trim());
    throwIfInvalid(!tweet, 404, "Tweet not found or Deleted already");
    throwIfInvalid(!tweet.tweetOwner.equals(userId), 403, "You can only Update your own Tweets");
    tweet.content = content;
    const updatedTweet = await tweet.save();

    throwIfInvalid(!updatedTweet, 500, "Tweet cant be updated right now");
    return res.status(200).json(new ApiResponse(200, updatedTweet, "Tweet Updated Successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { tweetId } = req.params;
    throwIfInvalid(!userId, 403, "User must be Logged In");
    throwIfInvalid(!tweetId, 400, "Tweet Id is Required");
    throwIfInvalid(!Types.ObjectId.isValid(tweetId), 400, "Tweet Id is Invalid !!!");

    const tweet = await Tweet.findById(tweetId);
    throwIfInvalid(!tweet, 404, "Tweet not found or Deleted already");
    throwIfInvalid(!tweet.tweetOwner.equals(userId), 403, "You can only Delete your own Tweets");

    const deletedTweet = await Tweet.findByIdAndDelete(tweet._id);

    throwIfInvalid(!deletedTweet, 500, "Tweet cant be Deleted right now");
    return res.status(200).json(new ApiResponse(200, deletedTweet, "Tweet Deleted Successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
