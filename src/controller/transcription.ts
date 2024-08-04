import OpenAI, { toFile } from "openai";
import dotenv from "dotenv"
import { Request, Response } from "express";
import { Readable, Stream } from 'stream';
import { Storage } from "@google-cloud/storage";
import fs from "fs";
import { TranscriptionCreateParams } from "openai/resources/audio/transcriptions";
import path from "path";
import { Message } from "openai/resources/beta/threads/messages";
import { ChatCompletionMessageParam } from "openai/resources";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { ChatPromptTemplate } from "@langchain/core/prompts";


dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

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
            response_format: "opus",
        });


        console.log('Generating streaming audio for:', text);

        const readableStream = response.body instanceof Readable ? response.body : Readable.from("");

        if (!readableStream) {
            return res.status(500).json({ message: 'Failed to generate audio' });
        }

        res.writeHead(200, {
            "Content-Type": "audio/mpeg",
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


const transcribeProd = async (
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


const transcribeDev = async (
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
    Flow:
    1: Transcribe the audio file
    2: Complete the chat chat completion
    3: Generate audio from the chat completion
*/
export const transcribeAndCompletion = async (req: Request, res: Response) => {
    const { filePath, messages } = req.body
    if (!filePath) {
        return res.status(400).json({ message: 'File path is required' });
    };

    try {
        let transcription: string = "";

        if (process.env.NODE_ENV !== 'production') {
            transcription = await transcribeDev(filePath as string);
        }

        if (process.env.NODE_ENV === 'production') {
            transcription = await transcribeProd(filePath as string);
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

const chatCompletion = async (text: string, messages: ChatCompletionMessageParam[]) => {
    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `
                You are an AI assistant that will response as human speech to the user and your response language based on the user language.
                Now, you are talking directly to the user. Response as a human the way of human speak.
                Response as a human speak.
                `
            },
            ...messages,
            {
                role: "user",
                content: text,
            },
        ]
    });
    const textResponse = completion.choices[0].message.content;
    return textResponse;
};