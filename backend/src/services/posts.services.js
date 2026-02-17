import pool from "../db.js";

export const createPostInDB = async ({
    content,
    author_id,
    type,
    parent_id
}) => {

    const res = await pool.query(
        `
        INSERT INTO posts (content, author_id, type, parent_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
        `,
        [content, author_id, type, parent_id]
    );

    return res.rows[0];
};
