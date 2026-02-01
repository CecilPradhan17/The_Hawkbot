import pool from "../db.js";

export const deletePostInDB = async (content) => {
        const res = await pool.query(`DELETE FROM posts WHERE id = $1 RETURNING *;`,[content]);
        return res.rows[0];    
}