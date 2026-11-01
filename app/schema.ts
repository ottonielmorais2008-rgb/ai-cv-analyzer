import { z } from "zod";

export const MAX_CV_CHARS = 8000;
export const MAX_JOB_CHARS = 5000;

export const analysisSchema = z.object({
  matchScore: z.number().int().min(0).max(100).describe("How well the CV fits the job, 0-100"),
  matchedSkills: z.array(z.string()).describe("Skills required by the job that the CV shows"),
  missingSkills: z.array(z.string()).describe("Skills required by the job that the CV lacks"),
  suggestions: z.array(z.string()).min(3).max(5).describe("3-5 concrete, actionable suggestions"),
});

export type Analysis = z.infer<typeof analysisSchema>;
