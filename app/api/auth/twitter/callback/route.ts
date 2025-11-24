import { NextRequest, NextResponse } from 'next/server';

/**
 * Twitter OAuth 2.0 Callback Handler
 * This endpoint receives the authorization code from Twitter
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json(
      { error: 'Authorization failed', details: error },
      { status: 400 }
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing authorization code or state' },
      { status: 400 }
    );
  }

  // Display the code and state so user can copy them
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Twitter Authorization</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          h1 {
            color: #1da1f2;
            margin-bottom: 20px;
          }
          .code-box {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            word-break: break-all;
            font-family: monospace;
            font-size: 14px;
          }
          .label {
            font-weight: bold;
            color: #666;
            margin-bottom: 5px;
          }
          .success {
            color: #28a745;
            font-size: 24px;
            margin-bottom: 20px;
          }
          .instructions {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
          }
          button {
            background: #1da1f2;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            margin-top: 10px;
          }
          button:hover {
            background: #1a91da;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅ Authorization Successful!</div>
          <h1>Twitter OAuth 2.0 Callback</h1>
          <p>Copy these values and run the token exchange script:</p>
          
          <div class="label">Authorization Code:</div>
          <div class="code-box" id="code">${code}</div>
          <button onclick="copyCode()">Copy Code</button>
          
          <div class="label" style="margin-top: 20px;">State:</div>
          <div class="code-box" id="state">${state}</div>
          <button onclick="copyState()">Copy State</button>
          
          <div class="instructions">
            <strong>Next steps:</strong>
            <ol>
              <li>Copy both values above</li>
              <li>Run in terminal: <code>npm run twitter:complete-auth</code></li>
              <li>Paste the code and state when prompted</li>
            </ol>
          </div>
        </div>
        
        <script>
          function copyCode() {
            const code = document.getElementById('code').textContent;
            navigator.clipboard.writeText(code);
            alert('Code copied to clipboard!');
          }
          
          function copyState() {
            const state = document.getElementById('state').textContent;
            navigator.clipboard.writeText(state);
            alert('State copied to clipboard!');
          }
        </script>
      </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

