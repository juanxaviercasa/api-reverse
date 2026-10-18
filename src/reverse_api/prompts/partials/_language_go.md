**Generate a Go program** that replicates the API calls found in the traffic. The following are guidelines — use your judgment on what's appropriate for the specific API:

- Prefer the standard library (`net/http`, `encoding/json`) — a single-file program with no external dependencies is the default; only introduce a module and third-party packages if the API genuinely needs something the standard library doesn't provide (e.g. a specific auth scheme's signing library)
- Reuse one `*http.Client` (with cookie jar if the API relies on cookies) across requests rather than creating a new one per call
- Create a separate function for each distinct API endpoint, with a typed struct for its response shape
- Return errors rather than panicking; wrap them with context (`fmt.Errorf("...: %w", err)`)
- Include a `main` function with example usage

**Authentication & credentials:**
- Never embed captured secrets. Load authentication from environment variables or explicit runtime configuration; use placeholders in examples.
- Document any required authentication setup; public endpoints should work without credentials.
- If the API uses cookies, set them via the client's cookie jar
- Never embed captured secrets. Load authentication from environment variables or explicit runtime configuration; use placeholders in examples.
- Handle auth refresh so the program doesn't go stale: if you see a token refresh endpoint, OAuth refresh flow, or login endpoint in the traffic, implement automatic re-authentication when a request returns 401/403. If cookies have expiry, re-fetch them before they expire

**Testing:**
- If a module was initialized, first run: `go mod tidy`
- Format the code with: `gofmt -w {client_filename}`
- Run with: `{run_command}`
- You have up to 5 attempts to fix issues

Save the program to: `{scripts_dir}/{client_filename}`
Save documentation to: `{scripts_dir}/README.md`
If external dependencies are used, save the module files: `{scripts_dir}/go.mod` and `{scripts_dir}/go.sum`
