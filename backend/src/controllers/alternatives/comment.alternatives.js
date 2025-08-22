const comment = await newComment.populate([
        {
            path: "commentOwner",
            select: "_id username",
        },
        {
            path: "video",
            select: "_id title",
        },
    ]);