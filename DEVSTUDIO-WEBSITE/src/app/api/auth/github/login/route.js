import { NextResponse } from 'next/server';

export async function GET(request) {
  const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const REDIRECT_URI = `https://devstudio-ai.vercel.app/api/auth/github/callback`;
  const scope = 'read:user user:email repo';

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&response_type=code`;

  return NextResponse.redirect(githubAuthUrl);
}
