export const createPost = (req, res) => {
    const { content } = req.body;

    if (!content){
        return res.status(400).json({message: "Content is required"});
    }

    console.log("Post has been recieved at posts.controllers.js");
    res.status(201).json({message: "Post has been created",
        post: { content },
    });
};