const pipeline1 = [
    {
        $match: {
            _id: confirmedChannel._id,
        },
    },
    {
        $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers",
        },
    },
    {
        $unwind: {
            path: "$subscribers",
            preserveNullAndEmptyArrays: true,
        },
    },
    {
        $lookup: {
            from: "users",
            localField: "subscribers.subscriber",
            foreignField: "_id",
            as: "subscriberDetails",
        },
    },
    {
        $unwind: {
            path: "$subscriberDetails",
            preserveNullAndEmptyArrays: true,
        },
    },
    {
        $group: {
            _id: "$_id",
            channelName: { $first: "$username" },
            subscribers: {
                $push: {
                    subId: "$subscriberDetails._id",
                    subName: "$subscriberDetails.username",
                    subEmail: "$subscriberDetails.email",
                },
            },
            subsCount: { $sum: 1 },
        },
    },
    {
        $project: {
            _id: 0,
            channelId: "$_id",
            channelName: 1,
            subscribers: 1,
            subsCount: 1,
        },
    },
];
const pipeline2 = [
    {
        $match: {
            // _id: ObjectId('685aa6643546bc080488de79')
            _id: confirmedChannel._id,
        },
    },
    {
        $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers",
            pipeline: [
                {
                    $lookup: {
                        from: "users",
                        localField: "subscriber",
                        foreignField: "_id",
                        as: "subsDetail",
                        pipeline: [
                            {
                                $project: {
                                    subId: "$_id",
                                    _id: 0,
                                    subName: "$username",
                                    subEmail: "$email",
                                },
                            },
                        ],
                    },
                },
            ],
        },
    },
    {
        $addFields: {
            subsCount: {
                $size: "$subscribers",
            },
        },
    },
    {
        $project: {
            _id: 0,
            channelId: "$_id",
            channelName: "$username",
            subscribers: "$subscribers",
            subsCount: 1,
        },
    },
];
const subscriberDetails = await User.aggregate(pipeline1); // pipeline2
const channelDetails = await Subscription.find({
    channel: confirmedChannel._id,
})

    .populate({
        path: "channel",
        select: "_id username",
    })
    .populate({
        path: "subscriber",
        select: "_id username email",
    });
const subscribers = channelDetails.map((sub) => ({
    subId: sub.subscriber._id,
    subName: sub.subscriber.username,
    subEmail: sub.subscriber.email,
}));

const result = {
    channelId: channelDetails[0].channel?._id,
    channelName: channelDetails[0].channel?.username,
    subscribers,
    subsCount: subscribers.length,
};
