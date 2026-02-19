import pool from "../db.js";

export const createPostInDB = async ({
    content,
    author_id,
    type,
    parent_id
}) => {

    try {
        await pool.query("BEGIN");

        const insertRes = await pool.query(
            `
            INSERT INTO posts (content, author_id, type, parent_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
            `,
            [content, author_id, type, parent_id]
        );

        const newPost = insertRes.rows[0];

        // If this is an answer then increment reply_count
        if (type === "answer" && parent_id) {
            await pool.query(
                `
                UPDATE posts
                SET reply_count = reply_count + 1
                WHERE id = $1;
                `,
                [parent_id]
            );
        }

        await pool.query("COMMIT");

        return newPost;

    } catch (err) {
        await pool.query("ROLLBACK");
        throw err;
    };
}
