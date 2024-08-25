import { Router } from "express";
import { decisionAI, loaderForScreenshot } from "../../controller/crawler";


const CrawlerRoute = Router();

CrawlerRoute.post("/crawl", loaderForScreenshot);
CrawlerRoute.post("/decision", decisionAI);

export default CrawlerRoute;