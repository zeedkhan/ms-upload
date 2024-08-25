import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { ChatVertexAI } from "@langchain/google-vertexai";
import type { BaseMessage } from "@langchain/core/messages";
import dotenv from "dotenv";
import { ChatCompletionMessageParam } from 'openai/resources';
import { HumanMessage, AIMessage, SystemMessage, BaseMessageLike } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { AgentExecutor, AgentStep, createOpenAIToolsAgent, createToolCallingAgent } from "langchain/agents";
import { z } from 'zod';
import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";
import { SearchApi } from "@langchain/community/tools/searchapi";
import { ChatOpenAI } from "@langchain/openai";
import { pull } from "langchain/hub";
import { renderTextDescription } from "langchain/tools/render";
import { formatLogToString } from "langchain/agents/format_scratchpad/log";
import { ReActSingleInputOutputParser } from "langchain/agents/react/output_parser";
import { BufferMemory } from "langchain/memory";
import { RunnableSequence } from "@langchain/core/runnables";
import { DynamicStructuredTool } from "@langchain/core/tools";

dotenv.config();

const wikiTools = new DynamicStructuredTool({
    name: "wikipedia-api",
    description: "Can perform a search on Wikipedia",
    schema: z.object({
        input: z.string().describe("Action Input")
    }),
    func: async ({ input }) => {
        console.log("input", input)
        const wiki = new WikipediaQueryRun({ maxDocContentLength: 1000, topKResults: 1 });
        const response = await wiki.invoke({ input });
        return response
    }
})


// const testTool = tool(async (input) => {
//     console.log(input, "Test tool")
//     const wiki = new WikipediaQueryRun({ maxDocContentLength: 1000, topKResults: 1 });

//     const response = await wiki.invoke({ input });

//     console.log(response)

//     return {
//         output: response
//     }
// }, {
//     name: "wikipedia-api",
//     description: "Wikipedia API tool",
//     schema: z.string(),

// })

const tools = [
    // new SearchApi(
    //     process.env.SEARCHAPI_API_KEY, {
    //     engine: "google"
    // }),
    wikiTools
];


export const conversationWithMemory = async (transcribe: string, messages: ChatCompletionMessageParam[]) => {
    // const llm = new ChatVertexAI({
    //     authOptions: {
    //         projectId: process.env.GCP_PROJECT_ID,
    //         credentials: {
    //             client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
    //             private_key: process.env.GCP_PRIVATE_KEY,
    //         }
    //     },
    //     verbose: true,
    //     model: "gemini-1.5-flash",
    //     temperature: 0,
    // });

    const llm = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: "gpt-4-turbo",
        temperature: 0,
    })

    const convertMsgs: BaseMessage[] = messages.map((msg: ChatCompletionMessageParam) => {
        if (msg.role === "assistant") {
            return new AIMessage({ content: msg.content || "" });
        } else if (msg.role === "user") {
            return new HumanMessage({ content: msg.content || "" });
        }
        return new SystemMessage({ content: msg.content || "" });
    });

    const prompt = ChatPromptTemplate.fromMessages([
        [
            "system",
            `You are an AI assistant that will response as human speech to the user and your response language based on the user language.
                Now, you are talking directly to the user. Response as a human the way of human speak.
                Response as a human speak.`
        ],
        ["placeholder", "{chat_history}"],
        ["human", "{input}"],
    ]);

    try {
        const chain = prompt.pipe(llm);
        const { content } = await chain.invoke({
            input: transcribe,
            chat_history: convertMsgs
        });
        return content as string;
    } catch (err: any) {
        if (err?.response) {
            console.log(err.response.data.candidates)
        } else {
            console.error(err);
        }

        return "Error with Google Cloud Vertext AI"
    }
}