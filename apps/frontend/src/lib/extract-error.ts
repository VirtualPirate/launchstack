/**
 * User-facing message for a failed API call. Prefers the API's own
 * `response.data.message` over Axios's generic "Request failed with status
 * code 409". Auth routes keep their own `getErrorMessage`: Better Auth errors
 * have a different shape.
 */
export function extractErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  const anyErr = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return (
    anyErr.response?.data?.message ??
    anyErr.message ??
    "Something went wrong"
  );
}
