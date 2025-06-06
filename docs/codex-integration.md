# Codex Integration

PocketDev now supports using the OpenAI Codex CLI as an alternative to Claude Code. When registering an engineer you can specify `engineType: "codex"` and tasks will be executed with the Codex CLI. The Docker image now installs `@openai/codex` and the container entrypoint selects the CLI based on the `ENGINE_TYPE` environment variable.

To run Codex tasks locally set `ENGINE_TYPE=codex` and provide `OPENAI_API_KEY`.
