import express from 'express';
import { deletePost } from '../controllers/delete.controllers.js';

const router = express.Router();

router.delete("/", deletePost);

export default router;