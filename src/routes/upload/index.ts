import { Router } from "express";
import { useMulterImage } from "../../controller/multer";

const uploadRouter = Router();

uploadRouter.post("/", useMulterImage.single("image"), (req, res) => {
    if (req.file) {
        const storePath = process.env.NODE_ENV !== 'production' ? `/uploads/${req.file.filename}` : req.file.filename ;
        
        res.status(200).json({ storePath: storePath, message: 'Image uploaded successfully', file: req.file });
    } else {
        res.status(400).json({ message: 'Image upload failed' });
    }
});

export default uploadRouter;