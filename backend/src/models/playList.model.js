import { Schema, model } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const playListSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    videos: [
        {
            type: Schema.Types.ObjectId,
            ref: "Video",
        },
    ],
    playListOwner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
});

playListSchema.plugin(mongooseAggregatePaginate);
export const PlayList = model("PlayList", playListSchema);
