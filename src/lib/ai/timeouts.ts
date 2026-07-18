// Keep each layer bounded while allowing the server enough time to return a
// typed provider timeout before the browser gives up on the request.
export const ANALYSIS_PROVIDER_TIMEOUT_MS = 150_000;
export const ANALYSIS_CLIENT_TIMEOUT_MS = 170_000;
