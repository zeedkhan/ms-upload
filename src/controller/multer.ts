import { Request } from 'express'
import multer, { FileFilterCallback, StorageEngine } from 'multer'
import { v4 } from 'uuid';
import { Storage } from "@google-cloud/storage";
import dotenv from 'dotenv';

dotenv.config();

type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void


export const fileStorage = multer.diskStorage({
    destination: (
        request: Request,
        file: Express.Multer.File,
        callback: DestinationCallback
    ): void => {
        callback(null, 'uploads/')
    },

    filename: (
        req: Request,
        file: Express.Multer.File,
        callback: FileNameCallback
    ): void => {
        const s = v4();
        callback(null, `${s}-${file.originalname}`);
    }
});


export const filterImg = (
    request: Request,
    file: Express.Multer.File,
    callback: FileFilterCallback
): void => {
    // callback(null, true);
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
        callback(null, true)
    } else {
        callback(null, false)
    }
}


export const allFilesUpload = (
    request: Request,
    file: Express.Multer.File,
    callback: FileFilterCallback
): void => {
    callback(null, true);
}

const storageGCS: StorageEngine = {
    _handleFile: (req, file, cb) => {
        const storage = new Storage({
            projectId: process.env.GCP_PROJECT_ID,
            credentials: {
                client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GCP_PRIVATE_KEY,
            }
        });
        const bucket = storage.bucket(`${process.env.GCP_BUCKET_NAME}`);
        const gcsFilename = `${Date.now()}-${file.originalname}`;
        const fileStream = bucket.file(gcsFilename).createWriteStream({
            resumable: false,
            gzip: true
        });

        fileStream.on('error', (err) => {
            cb(err);
        });

        fileStream.on('finish', () => {
            const gcsFile: Record<string, string> = {
                bucket: bucket.name,
                filename: gcsFilename,
                path: `https://storage.googleapis.com/${bucket.name}/${gcsFilename}`
            };
            cb(null, gcsFile);
        });

        file.stream.pipe(fileStream);
    },
    _removeFile: (req, file, cb) => {
        cb(null);
        // const storage = new Storage();
        // const bucketName = 'your-bucket-name'; // replace with your GCS bucket name
        // const bucket = storage.bucket(bucketName);
        // const gcsFilename = file.filename;

        // bucket.file(gcsFilename).delete()
        //     .then(() => cb(null))
        //     .catch((err) => cb(err));
    }
};


export const useMulterImage = multer({
    storage: process.env.NODE_ENV === 'production' ? storageGCS : fileStorage,
    fileFilter: filterImg,
});

export const useMulter = multer({
    storage: process.env.NODE_ENV === 'production' ? storageGCS : fileStorage,
    fileFilter: allFilesUpload
});