import OpenAI, { toFile } from "openai";
import dotenv from "dotenv"
import { Request, Response } from "express";
import { Readable } from 'stream';
import { Storage } from "@google-cloud/storage";
import fs from "fs";
import { TranscriptionCreateParams } from "openai/resources/audio/transcriptions";
import path from "path";
import { ChatCompletionMessageParam } from "openai/resources";
import { chatCompletion, CreateAndRunThreadProps, createThreadAndRun } from "./openai";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { HumanMessage, AIMessage, SystemMessage, BaseMessageLike } from "@langchain/core/messages";
import { conversationWithMemory } from "./generative";

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/*  
    Reuse the generateAudio function.
*/
export const geneateAudio = async (req: Request, res: Response) => {
    const { text } = req.query;

    if (!text) {
        return res.status(400).json({ message: 'Text is required' });
    }

    try {
        const response = await openai.audio.speech.create({
            model: "tts-1",
            voice: "nova",
            input: text as string,
            response_format: "wav",
        });

        console.log('Generating streaming audio for:', text);

        const readableStream = response.body instanceof Readable ? response.body : Readable.from("");

        if (!readableStream) {
            return res.status(500).json({ message: 'Failed to generate audio' });
        }

        res.writeHead(200, {
            "Content-Type": "audio/wav",
            "Transfer-Encoding": "chunked",
        });

        readableStream.pipe(res);

        readableStream.on("end", () => {
            console.log(`Stream ended.`);
            res.end();
        });

        readableStream.on("error", (e) => {
            res.end();
            console.error("Error streaming TTS:", e);
        });
    } catch (e) {
        console.error('Error generating audio:', e);
        res.status(500).json({ message: 'Internal server error' });
    }
}

/* 
    Function to transcribe the audio file from the file path. In production.
*/
const transcribeFilePathProd = async (
    filePath: string,
    format: TranscriptionCreateParams['response_format'] = "json",
    model: TranscriptionCreateParams['model'] = "whisper-1"
) => {
    const storage = new Storage({
        projectId: process.env.GCP_PROJECT_ID,
        credentials: {
            client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GCP_PRIVATE_KEY,
        }
    });
    const bucket = storage.bucket(`${process.env.GCP_BUCKET_NAME}`);
    const file = bucket.file(filePath).createReadStream();

    const transcription = await openai.audio.transcriptions.create({
        file: await toFile(file, filePath),
        model: model,
        response_format: format,
    });
    return transcription.text;
};

/* 
    Function to transcribe the audio file from the file path. In development.
*/
const transcribeFilePathDev = async (
    filePath: string,
    format: TranscriptionCreateParams['response_format'] = "json",
    model: TranscriptionCreateParams['model'] = "whisper-1"
) => {
    const folderPath = path.join(process.cwd(), filePath.toString());
    const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(folderPath),
        model: model,
        response_format: format,
    });
    return transcription.text;
}

/*
    Transcribe the audio file from the memory.
*/
const memoryTranscribe = async (file: Express.Multer.File, format: TranscriptionCreateParams['response_format']) => {
    const transcription = await openai.audio.transcriptions.create({
        file: await toFile(file.buffer, file.originalname),
        model: "whisper-1",
        response_format: format,
    });
    return transcription.text.trim() || "";
}

/*
    Function to run the transcribe the audio file and complete the chat.
*/
export const fileTranscribeAndCompletion = async (req: Request, res: Response) => {
    const { filePath, messages } = req.body
    if (!filePath) {
        return res.status(400).json({ message: 'File path is required' });
    };

    try {
        let transcription: string = "";

        if (process.env.NODE_ENV !== 'production') {
            transcription = await transcribeFilePathDev(filePath as string);
        }

        if (process.env.NODE_ENV === 'production') {
            transcription = await transcribeFilePathProd(filePath as string);
        }

        if (!transcription) {
            return res.status(500).json({ message: 'Failed to transcribe audio' });
        }

        const textResponse = await chatCompletion(transcription, messages as ChatCompletionMessageParam[]);

        return res.status(200).json({ assistantTranscription: textResponse, humanTranscription: transcription });
    } catch (e) {
        console.error('Error transcribing audio:', e);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

/* 
    Function to run the transcribe the audio file from the memory and complete the chat.
*/
export const transcribeMemoryAndCompletion = async (req: Request, res: Response) => {
    const { llm, assistantId } = req.query;
    const { file } = req;
    const socketId = req.headers['x-socket-id'];
    console.log(req.headers)
    console.log(socketId);

    if (file) {
        const transcribe = await memoryTranscribe(file, "json");
        let assistantResponse = "";
        let currentThreadId: string | null = null
        try {
            if (llm === "assistant") {
                let { threadId } = req.query;
                const paramsAssistant: CreateAndRunThreadProps = {
                    assistantId: assistantId as string,
                    input: transcribe,
                    messages: JSON.parse(req.body.messages as string),
                    socketId: socketId as string,
                };

                if (threadId) {
                    paramsAssistant.threadId = threadId as string;
                };

                const conversation = await createThreadAndRun(paramsAssistant);
                if (conversation) {
                    // first message
                    const firstMessage = conversation.data[0].content[0]
                    if (firstMessage.type === "text") {
                        assistantResponse = String(firstMessage.text.value);
                    } else {
                        assistantResponse = "I am only support the text at this moment.";
                    }
                    // set the thread id
                    currentThreadId = conversation.data[0].thread_id;
                }
            } else {
                const response = await chatCompletion(transcribe, JSON.parse(req.body.messages as string));
                assistantResponse = response;
            }
        } catch (e) {
            console.error('Error transcribing audio:', e);
            return res.status(500).json({ message: 'Internal server error' });
        }

        const response: Record<string, string> = {
            assistantTranscription: assistantResponse,
            humanTranscription: transcribe,
        }

        if (llm === "assistant" && currentThreadId) {
            response.threadId = currentThreadId;
        }

        return res.status(200).json(response);
    } else {
        return res.status(400).json({ message: 'File upload failed' });
    }
};