import pool from "../db.js";
import { deletePostInDB } from "../services/delete.services.js";

export const deletePost = async (req, res) => {
    const { content } = req.body;

    if (!content){
        return res.status(400).json({message: "Content is required"});
    }

    try{
        const post = await deletePostInDB(content);
        res.status(201).json({
            message: "Post deleted",
            post: post,
        });
    }
    catch(error){
        console.log(error);
        res.status(500).json({ message: "Database error" });
    }
};