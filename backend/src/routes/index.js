import express from 'express';
import postsRoutes from './posts.routes.js';
import deleteRoutes from './delete.routes.js';

const router = express.Router();

router.use("/posts", postsRoutes);
router.use("/delete", deleteRoutes);

export default router;

