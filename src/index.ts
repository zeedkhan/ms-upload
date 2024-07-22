import dotenv from "dotenv";
import { createServer } from "./utils/server"

dotenv.config();

const server = createServer();

const port = process.env.PORT || 8003;

server.listen(port, () => {
    console.log(`[server]: Server is running at ${port}`);
});

export default server;