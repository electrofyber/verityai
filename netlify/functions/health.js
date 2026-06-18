const DEFAULT_MODEL = "openrouter/auto";

exports.handler = async () => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  body: JSON.stringify({
    ok: true,
    keyConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL
  })
});
