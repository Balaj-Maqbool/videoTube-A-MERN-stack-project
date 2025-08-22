import { promiseAsyncHandler as asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { REFRESH_TOKEN_SECRET } from "../constants.js";
// import fs from "fs"
import mongoose from "mongoose";
// import { subscribe } from "diagnostics_channel";

// Register a user
const registerUser = asyncHandler(async (req, res, next) => {
    // get user data from frontend  , from req.body or url
    // validate data - should not be empty fields
    // check if user already exist : username , email
    // check for images, for avatar*
    // save files to local storage
    // encrypt the password ,
    // upload them on cloudinary especially the required ones (*)
    // create user Object  - create entry in DB
    // remove password and refresh tokens from response
    // check for user creation, check for response ,
    //  return response or error if don't get the response

    const { username, fullName, email, password, avatar, coverImage } = await req.body;
    const userObject = { username, fullName, email, password, avatar, coverImage };
    // console.log( "\n\n\n req body \n\n",req.body);

    // if (
    //     [username, email, password, fullName].some((field) => {
    //         return field?.trim() === "";
    //     })
    // ) {
    //     throw new Error(`All Fields are  required`)
    // }

    for (let key in userObject) {
        if (userObject[key]?.trim() === "") {
            throw new ApiError(400, `${key} is required`);
        }
    }

    const existingUser = await User.findOne({
        $or: [{ username: username?.trim().replace(/\s+/g, "-").toLowerCase() }, { email }],
    });
    if (existingUser) {
        throw new ApiError(
            409,
            `User with email : ${email} or username : ${username} already exists`
        );
    }
    // console.log("\n\n\n existing user \n\n",existingUser);
    // console.log("\n\n\n req FILES \n\n",req.files);

    const avatarLocalPath = await req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = await req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    const uploadedAvatar = await uploadOnCloudinary(avatarLocalPath);
    const uploadedCoverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!uploadedAvatar?.url) {
        throw new ApiError(424, "Avatar not uploaded ");
    }

    const user = await User.create({
        username: username?.trim().replace(/\s+/g, "-").toLowerCase(),
        fullName: fullName?.trim(),
        avatar: uploadedAvatar?.url || "",
        coverImage: uploadedCoverImage?.url || "",
        email: email?.trim(),
        password: password,
    });
    // console.log("\n\n\n THE USER \n\n",user);

    const createdUser = await User.findById(user?._id).select("-password -refreshTokens");

    // console.log("\n\n\n USER CREATED \n\n", createdUser);

    if (!createdUser) {
        throw new ApiError(500, "User can't be registered ");
    }

    return res
        .status(201)
        .json(new ApiResponse(200, createdUser, "User Registered Successfully !!!"));
});

// logIn the user
const loginUser = asyncHandler(async (req, res, next) => {
    const { username, email, password } = await req.body;
    const userObject = { username, email, password };

    for (let key in userObject) {
        if (userObject[key]?.trim() === "") {
            throw new ApiError(400, `${key} is required`);
        }
    }
    const user = await User.findOne({
        $and: [{ email, username }],
    });
    if (!user) {
        throw new ApiError(409, `The User with ${email} or ${username} or both  does not exist`);
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "The password is invalid, Try Again");
    }

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    // console.log(accessToken,refreshToken);

    if (!accessToken || !refreshToken) {
        throw new ApiError(500, "Tokens can't be generated at the time");
    }

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    if (!loggedInUser) {
        ApiError(404, "Cant find the user in the DataBase");
    }
    const cookieOptions = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },

                "User logged In Successfully  "
            )
        );
});

const logoutUser = asyncHandler(async (req, res, next) => {
    const userId = req.user?._id;
    await User.findByIdAndUpdate(
        userId,
        {
            // $set: {
            //     refreshToken: undefined
            // }

            $unset: {
                refreshToken: 1,
            },
        },
        {
            new: true,
        }
    );

    const cookieOptions = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "User LoggedOut"));
});

const refreshAccessToken = asyncHandler(async (req, res, next) => {
    const incomingToken = (await req.cookies?.refreshToken) || req.body?.refreshToken;
    if (!incomingToken) {
        throw new ApiError(401, "Unauthorized request, Refresh Token not found");
    }

    const decodedToken = jwt.verify(incomingToken, REFRESH_TOKEN_SECRET);
    const userId = decodedToken?._id;

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(401, "Invalid Refresh Token");
    }
    if (incomingToken !== user.refreshToken) {
        throw new ApiError(401, "Refresh Token is used or expired");
    }
    const cookieOptions = {
        httpOnly: true,
        secure: true,
    };

    const newAccessToken = await user.generateAccessToken();
    const newRefreshToken = await user.generateRefreshToken();

    await User.findByIdAndUpdate(user._id, {
        $set: {
            refreshToken: newRefreshToken,
        },
        new: true,
    });

    return res
        .status(200)
        .cookie("accessToken", newAccessToken, cookieOptions)
        .cookie("refreshToken", newRefreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                },
                "New Tokens Generated Successfully"
            )
        );
});

const updatePassword = asyncHandler(async (req, res, next) => {
    const { oldPassword, newPassword } = req.body;
    if (!(oldPassword || newPassword)) {
        throw new ApiError(400, "Old and New passwords are required");
    }
    if (oldPassword === newPassword) {
        throw new ApiError(400, "Old and New Passwords Cannot be same");
    }
    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not Found");
    }
    const isPasswordCorrect = await user?.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid Password");
    }
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    res.status(200).json(new ApiResponse(201, {}, "Password Changed Successfully!!"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current User Fetched Successfully"));
});

const updateUserInfo = asyncHandler(async (req, res) => {
    const { newEmail, newFullName } = req.body;

    if (!newEmail?.trim() || !newFullName?.trim()) {
        throw new ApiError(400, "both email and full name are required");
    }
    // console.log(req.user);

    if (newEmail === req.user?.email) {
        throw new ApiError(404, "Both emails are same , add a new Email");
    }
    if (newFullName === req.user?.fullName) {
        throw new ApiError(404, "Both FullNames are same , add a new FullName");
    }
    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not Found");
    }
    // console.log(user);

    user.email = newEmail.trim().toLowerCase();
    user.fullName = newFullName.trim();
    const updatedUser = await user.save();

    // const updatedUser = await User.findByIdAndUpdate(user._id,
    // {
    //     $set: {
    //         email: newEmail.trim().toLowerCase(),
    //         fullName: newFullName.trim()
    //     }
    // },
    // {
    //     new: true
    // }).select("-password -refreshToken")
    // console.log(updatedUser);

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "Email and FullName updated successfully"));
});

const updateTheAvatar = asyncHandler(async function (req, res, next) {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(404, "Avatar file is missing  ");
    }

    const updatedAvatar = await uploadOnCloudinary(avatarLocalPath);
    if (!updatedAvatar?.url) {
        throw new ApiError(404, "Error occurred while uploading the avatar on cloudinary");
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not Found");
    }

    user.avatar = updatedAvatar.url;
    const updatedUser = await user.save();
    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser.avatar, "Avatar updated successfully"));
});

const updateTheCoverImage = asyncHandler(async function (req, res, next) {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(404, "Avatar file is missing  ");
    }

    const updatedCoverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!updatedCoverImage?.url) {
        throw new ApiError(404, "Error occurred while uploading the avatar on cloudinary");
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not Found");
    }

    user.coverImage = updatedCoverImage.url;
    const updatedUser = await user.save();
    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser.coverImage, "CoverImage updated successfully"));
});

const addVideoToWatchHistory = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const videoId = req.params?.videoId;
    if (!userId) {
        throw new ApiError(403, "Unauthorized Access , User not Found");
    }
    const confirmedVideoId = await Video.findById(new mongoose.Types.ObjectId(videoId)).select(
        "_id"
    );

    if (!confirmedVideoId) {
        throw new ApiError(404, "Video Found in the DB, wrong video Id");
    }
    const user = await User.findByIdAndUpdate(
        userId,
        {
            $addToSet: { watchHistory: videoId },
        },
        {
            new: true,
        }
    ).select("_id username watchHistory");

    if (!user) {
        throw new ApiError(403, " Unauthorized Access , wrong user Id");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Video added to user WatchHistory Successfully!!"));
});

const getUserChannelUpdates = asyncHandler(async (req, res) => {
    const { username } = req.params;
    if (!username.trim()) {
        throw new ApiError(400, "Username is required");
    }
    const channelDetails = await User.aggregate([
        {
            $match: {
                username: username.toLowerCase(),
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
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo",
            },
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers",
                },
                subscribedToCount: {
                    $size: "$subscribedTo",
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                username: 1,
                fullName: 1,
                subscribedToCount: 1,
                subscriberCount: 1,
                coverImage: 1,
                avatar: 1,
                isSubscribed: 1,
            },
        },
    ]);
    if (!channelDetails?.length) {
        throw new ApiError(404, "Channel Does Not Exists");
    }
    // console.log(channelDetails);

    return res
        .status(200)
        .json(new ApiResponse(200, channelDetails[0], "User Channel details Fetched Successfully"));
});

const getUserWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id),
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullName: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $unwind: "$owner",
                    },
                    {
                        $addFields: {
                            videoOwner: "$owner",
                            videoId: "$_id",
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            videoId: 1,
                            title: 1,
                            views: 1,
                            videoOwner: 1,
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                currentUser: {
                    userId: "$_id",
                    username: "$username",
                    email: "$email",
                },
            },
        },
        {
            $project: {
                _id: 0,
                currentUser: 1,
                watchHistory: 1,
            },
        },
    ]);
    // console.log(watchHistory);

    return res.status(200).json(new ApiResponse(200, user[0], "User History Fetched Successfully"));
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    updatePassword,
    getCurrentUser,
    updateUserInfo,
    updateTheAvatar,
    updateTheCoverImage,
    getUserChannelUpdates,
    getUserWatchHistory,
    addVideoToWatchHistory,
};
