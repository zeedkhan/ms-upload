import { SearchApi } from "@langchain/community/tools/searchapi";
import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";


export const wikiSearch = async (q: string): Promise<string> => {
    const wiki = new WikipediaQueryRun({ maxDocContentLength: 1000, topKResults: 1 });
    try {
        const response = await wiki.invoke(q);
        return response;
    } catch (err) {
        console.error('Error searching wikipedia:', err);
        return "Tool is not available!";
    }
}

export const searchEngine = async (q: string): Promise<string> => {
    const search = new SearchApi(
        process.env.SEARCHAPI_API_KEY, {
        engine: "google"
    });
    try {
        const response = await search.invoke(q);
        return response;
    } catch (err) {
        console.error('Error searching wikipedia:', err);
        return "Tool is not available!";
    }
}