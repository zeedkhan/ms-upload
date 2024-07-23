import express, { Express, Request, Response } from "express"
import path from 'path';
import uploadRouter from "../routes/upload";
import cors from "cors"
import dotenv from "dotenv";

dotenv.config();

const createServer = () => {
    const app: Express = express();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const gatewayURL = process.env.NODE_ENV !== "production" ? "http://localhost:8000" : process.env.GATEWAY_URL as string;
    const frontendURL = process.env.NODE_ENV !== "production" ? "http://localhost:3000" : process.env.FRONTEND_URL as string;

    app.use(cors({
        origin: [gatewayURL, frontendURL]
    }));

    // Serve static files
    // This is for development only
    // In production, we will 
    if (process.env.NODE_ENV !== "production") {
        const __dirname = path.dirname(__filename);
        app.use("/uploads", express.static(path.join(__dirname, '../../uploads')));
    }

    app.get("/", (req: Request, res: Response) => {
        res.send("Express + TypeScript Server");
    });

    app.use("/upload", uploadRouter)

    return app
}

export {
    createServer
}