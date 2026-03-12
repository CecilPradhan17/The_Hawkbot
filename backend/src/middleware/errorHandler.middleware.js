export default function errorHandler(err, req, res, next) {
    if (process.env.NODE_ENV !== 'production') {
        console.error(err);
    }

    const statusCode = err.status || 500;
    res.status(statusCode).json({
        message: statusCode === 500 ? "Internal Server Error" : err.message
    });
};

