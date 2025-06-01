import crypto from "crypto";

export async function POST(request) {
  const TOKEN = process.env.NEXT_PUBLIC_GEMINI_API;

  // Generate a random 32-byte key (used as salt + encryption key)
  const salt = crypto.randomBytes(32); // key must be 32 bytes for AES-256
  const iv = crypto.randomBytes(16); // AES IV

  const cipher = crypto.createCipheriv("aes-256-cbc", salt, iv);
  let encrypted = cipher.update(TOKEN, "utf8", "hex");
  encrypted += cipher.final("hex");

  return new Response(
    JSON.stringify({
      encrypted,
      salt: salt.toString("hex"),
      iv: iv.toString("hex"),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
