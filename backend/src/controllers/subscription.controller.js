import { Types } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { promiseAsyncHandler as asyncHandler } from "../utils/AsyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user?._id;

    if (!channelId) {
        throw new ApiError(400, "Channel Id Missing ");
    }
    if (!Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "Invalid Channel Id");
    }
    const confirmedChannel = await User.findById(channelId).select("_id");
    if (!confirmedChannel?._id) {
        throw new ApiError(404, "Channel Not Found");
    }
    // console.log(userId, confirmedChannel._id, channelId);

    if (userId.equals(confirmedChannel._id)) {
        throw new ApiError(400, "You cannot subscribe to Your self ");
    }

    const existingSubscriber = await Subscription.findOneAndDelete({
        subscriber: userId,
        channel: confirmedChannel._id,
    })
        .populate("subscriber", "username")
        .populate("channel", "username")
        .select("-createdAt -updatedAt -__v -_id");
    if (existingSubscriber) {
        return res
            .status(200)
            .json(new ApiResponse(200, existingSubscriber, "The Channel was Unsubscribed Successfully"));
    } else {
        const newSubscriber = await Subscription.create({
            subscriber: userId,
            channel: confirmedChannel._id,
        });

        if (!newSubscriber) {
            throw new ApiError(500, "This Channel cannot be subscribed Right now");
        }
        const subscriptionDetails = await Subscription.findById(newSubscriber?._id)
            .populate("subscriber", "username")
            .populate("channel", "username")
            .select("-createdAt -updatedAt -__v -_id");

        if (!subscriptionDetails) {
            throw new ApiError(500, "Could not get the Subscription details from the server");
        }

        return res
            .status(201)
            .json(new ApiResponse(200, subscriptionDetails, "The Channel Subscribed Successfully"));
    }
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    if (!channelId) {
        throw new ApiError(400, "Channel Id missing");
    }
    if (!Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "Invalid Channel Id");
    }
    const confirmedChannel = await User.findById(channelId).select("_id");
    if (!confirmedChannel?._id) {
        throw new ApiError(404, "Channel Does Not exist");
    }

    const pipeline = [
        {
            $match: {
                channel: confirmedChannel?._id,
            },
        },
        {
            $group: {
                _id: "$channel",
                subscriberIds: {
                    $addToSet: "$subscriber",
                },
                subscriberCount: {
                    $sum: 1,
                },
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "channelDetails",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            channelId: "$_id",
                            channelName: "$username",
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$channelDetails",
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriberIds",
                foreignField: "_id",
                as: "subscribers",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            subscriberId: "$_id",
                            subscriberUserName: "$username",
                            subscriberFullName: "$fullName",
                        },
                    },
                ],
            },
        },
        {
            $project: {
                _id: 0,
                channelDetails: 1,
                subscribers: 1,
                subscriberCount: 1,
            },
        },
    ];
    const subscriberDetails = await Subscription.aggregate(pipeline);

    res
        .status(200)
        .json(new ApiResponse(200, subscriberDetails?.[0], "Subscriber details fetched successfully"));
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;
    if (!subscriberId) {
        throw new ApiError(400, "Subscriber Id missing");
    }
    if (!Types.ObjectId.isValid(subscriberId)) {
        throw new ApiError(400, "Invalid Subscriber Id");
    }
    const confirmedSubscriber = await User.findById(subscriberId).select("_id");
    if (!confirmedSubscriber?._id) {
        throw new ApiError(404, "Subscriber Does Not exist");
    }

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: confirmedSubscriber?._id,
            },
        },
        {
            $group: {
                _id: "$subscriber",
                subscribedToIds: {
                    $addToSet: "$channel",
                },
                subscribedChannelCount: {
                    $sum: 1,
                },
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "subscriberDetails",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            subscriberId: "$_id",
                            subscriberName: "$username",
                            subscriberFullName: "$fullName",
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$subscriberDetails",
        },
        {
            $lookup: {
                from: "users",
                localField: "subscribedToIds",
                foreignField: "_id",
                as: "subscribedChannelDetails",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            channelId: "$_id",
                            channelName: "$username",
                        },
                    },
                ],
            },
        },
        {
            $project: {
                _id: 0,
                subscriberDetails: 1,
                subscribedChannelDetails: 1,
                subscribedChannelCount: 1,
            },
        },
    ]);

    res
        .status(200)
        .json(
            new ApiResponse(200, subscribedChannels[0], "Subscribed Channels detail fetched successfully")
        );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
