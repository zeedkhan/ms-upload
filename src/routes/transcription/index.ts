import { Router } from "express";
import { geneateAudio, transcribeAndCompletion } from "../../controller/transcription";

const TranscriptionRoute = Router();

TranscriptionRoute.get("/generate-audio", geneateAudio);
TranscriptionRoute.post("/transcribe-and-completeion", transcribeAndCompletion);

export default TranscriptionRoute;