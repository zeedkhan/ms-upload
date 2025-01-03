import { Router } from "express";
import { decisionAI } from "../../controller/crawler";
import { searchEngine } from "../../lib/ai-tools/search";


const CrawlerRoute = Router();

CrawlerRoute.post("/decision", decisionAI);


CrawlerRoute.get("/ai/search", async (req, res) => {
    const { q } = req.query;
    try {
        const response = await searchEngine(q as string);
        console.log("response", response)
        res.json(response);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: JSON.stringify(err) });
    }
})

export default CrawlerRoute;