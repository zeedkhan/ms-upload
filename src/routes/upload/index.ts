import { Router } from "express";
import { useMulter, useMulterImage } from "../../controller/multer";

const uploadRouter = Router();

uploadRouter.post("/", useMulterImage.single("image"), (req, res) => {
    const folder = req.headers['x-folder'] || '';
    if (req.file) {
        const storePath = process.env.NODE_ENV !== 'production' ? `/uploads/${folder}/${req.file.filename}` : req.file.filename;
        res.status(200).json({ storePath: storePath, message: 'Image uploaded successfully', file: req.file });
    } else {
        res.status(400).json({ message: 'Image upload failed' });
    }
});

uploadRouter.post("/file", useMulter.single("file"), (req, res) => {
    const folder = req.headers['x-folder'] || '';
    if (req.file) {
        const storePath = process.env.NODE_ENV !== 'production' ? `/uploads/${folder}/${req.file.filename}` : req.file.filename;
        res.status(200).json({ storePath: storePath, message: 'File uploaded successfully', file: req.file });
    } else {
        res.status(400).json({ message: 'File upload failed' });
    }
});

export default uploadRouter;