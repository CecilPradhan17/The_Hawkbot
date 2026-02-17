import { createPostInDB } from "../services/posts.services.js";

export const createPost = async (req, res, next) => {
    const { content, type, parent_id } = req.body;
    const authorId = req.user.id;

    if (!content || !content.trim()) {
        const error = new Error("Content is required");
        error.status = 400;
        return next(error);
    }

    if (content.length > 500) {
        const error = new Error("Content exceeds 500 characters");
        error.status = 400;
        return next(error);
    }

    if (!["post","question", "answer"].includes(type)) {
        const error = new Error("Invalid post type");
        error.status = 400;
        return next(error);
    }

    if (type === "answer" && !parent_id) {
        const error = new Error("Answers must have a parent_id");
        error.status = 400;
        return next(error);
    }

    if (["post", "question"].includes(type) && parent_id) {
        const error = new Error("Only answers can have a parent_id");
        error.status = 400;
        return next(error);
}

    try {
        const post = await createPostInDB({
            content,
            author_id: authorId,
            type,
            parent_id: type === "answer" ? parent_id : null
        });

        res.status(201).json(post);

    } catch (error) {
        next(error);
    }
};
