# Use an OpenAI-compatible provider abstraction

Inline AI Editing will use an OpenAI-compatible provider abstraction, not a hardcoded OpenAI-only model. The realtime service now uses `AI_BASE_URL`, `AI_API_KEY` / `OPENAI_API_KEY`, and `AI_MODEL` so the same endpoint can work with standard OpenAI or another OpenAI-compatible API without code changes.
