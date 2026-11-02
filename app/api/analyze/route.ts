import { analyzeCv, validateInput } from "../../../lib/analyze";

export const maxDuration = 30;

export async function POST(req: Request) {
  let body: { cv?: unknown; job?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = validateInput(body);
  if (!input.ok) return Response.json({ error: input.error }, { status: input.status });

  try {
    return Response.json(await analyzeCv(input.cv, input.job));
  } catch (err) {
    console.error("analysis failed", err);
    return Response.json({ error: "The analysis failed. Please try again later." }, { status: 502 });
  }
}
