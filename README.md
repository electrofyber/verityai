# Verity AI

Verity AI is a small Netlify-hosted chat website inspired by Verity from the Minecraft ThatMob series. It uses a simple smiley-face logo, a compact chat interface, and OpenRouter for AI responses.

The OpenRouter API key is kept on the server side through a Netlify function, so it is not exposed in the browser.

## Features

- Simple smiley-face Verity logo
- Compact chat interface
- Verity personality prompt
- OpenRouter API integration
- Netlify serverless backend proxy
- Footer credits and Electrofyber link
- API key stored safely in Netlify environment variables

## Project structure

```txt
index.html
assets/
  styles.css
  app.js
netlify/
  functions/
    chat.js
netlify.toml
package.json
.env.example
.gitignore
README.md
```

## Local setup

Install dependencies:

```bash
npm install
```

Run locally with Netlify CLI:

```bash
npm run dev
```

Open the local Netlify URL shown in the terminal.

For quick local testing without OpenRouter, open:

```txt
http://localhost:8888/?mock=1
```

This uses fake Verity replies so you can test the UI, timer, name reset, and secret page without an API key.

To test the real Netlify function locally, set your env vars and open without mock mode:

```txt
http://localhost:8888/?mock=0
```

## Environment variables

Create a `.env` file locally if your setup supports it, or add these variables directly in Netlify:

```txt
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openrouter/auto
```

Never commit your real API key to GitHub.

## Netlify deployment

1. Push this repository to GitHub.
2. Connect the GitHub repository to Netlify.
3. Add these environment variables in Netlify:
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL`
4. Deploy the site.
5. Test the chat from the live Netlify URL.

## Validation

Run:

```bash
npm run validate
```

This checks the Netlify function JavaScript syntax.

## Credits

Built by Electrofyber.

Website: https://electrofyber.cfd
