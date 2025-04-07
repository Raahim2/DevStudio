import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = process.env.NEXT_PUBLIC_GITHUB_CLIENT_SECRET;
  const APP_PROTOCOL = "devstudio";

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error('GitHub token exchange error:', tokenData);
       return NextResponse.json({ error: tokenData.error_description || 'Failed to obtain access token' }, { status: 400 });
    }

    const accessToken = tokenData.access_token;

    // Redirect back to the Electron app using the custom protocol
    const redirectUrl = `${APP_PROTOCOL}://auth/callback?token=${accessToken}`;

    // Optional: Show a success message page briefly before redirecting
     return new NextResponse(
            `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Login Successful</title>
                <meta http-equiv="refresh" content="1;url=${redirectUrl}" />
                <script>
                    // Attempt immediate redirect via JS as fallback/primary
                    window.location.href = "${redirectUrl}";
                </script>
            </head>
            <body>
                <p>Login successful! Redirecting back to the application...</p>
                <p><a href="${redirectUrl}">Click here if you are not redirected automatically.</a></p>
            </body>
            </html>
        `,
            {
                status: 200,
                headers: {
                    'Content-Type': 'text/html',
                },
            }
     );

   

  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.json({ error: 'Internal Server Error during callback' }, { status: 500 });
  }
}