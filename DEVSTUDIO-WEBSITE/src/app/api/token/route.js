import crypto from "crypto";

export async function GET(request) {
    const TOKEN = process.env.NEXT_PUBLIC_GEMINI_API;
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.createHmac("sha256", salt).update(TOKEN).digest("hex");
    return new Response(JSON.stringify({ token: hash, salt }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
