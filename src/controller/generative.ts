import { Request, Response } from 'express'
import { ChatVertexAI } from "@langchain/google-vertexai-web"
import { ChatPromptTemplate } from "@langchain/core/prompts";

import dotenv from "dotenv";
dotenv.config();


