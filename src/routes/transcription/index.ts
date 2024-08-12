import { Router } from "express";
import { geneateAudio, fileTranscribeAndCompletion, transcribeMemoryAndCompletion } from "../../controller/transcription";
import { memoryMulter } from "../../controller/multer";

const TranscriptionRoute = Router();

TranscriptionRoute.get("/generate-audio", geneateAudio);
TranscriptionRoute.post("/transcribe-and-completeion", fileTranscribeAndCompletion);
TranscriptionRoute.post("/transcribe", memoryMulter.single("file"), transcribeMemoryAndCompletion);

export default TranscriptionRoute;