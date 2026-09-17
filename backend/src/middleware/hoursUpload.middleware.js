import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

export function uploadScheduleDocument(req, res, next) {
  upload.single("document")(req, res, error => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") {
      error.message = "Schedule documents must be 10 MB or smaller";
      error.status = 413;
    } else {
      error.status = 400;
    }
    next(error);
  });
}

