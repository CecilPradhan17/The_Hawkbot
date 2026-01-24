import pool from "../db.js";
import { createPostInDB } from "../services/posts.services.js";

export const createPost = async (req, res) => {
    const { content } = req.body;

    if (!content){
        return res.status(400).json({message: "Content is required"});
    }

    try{
        const post = await createPostInDB(content);
        res.status(201).json({
            message: "Post created",
            post: post,
        });
    }
    catch(error){
        console.log(error);
        res.status(500).json({ message: "Database error" });
    }
};