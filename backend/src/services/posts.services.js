import pool from "../db.js";

export const createPostInDB = async (content) => {
        const res = await pool.query(`INSERT INTO posts (content) VALUES ($1) RETURNING *;`,[content]);
        return res.rows[0];    
}