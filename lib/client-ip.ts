// The first comma-delimited item identifies the original client under the
// existing forwarding-header trust policy. Optional whitespace is not part of
// the address, and a changing proxy suffix must not create a new limit key.
export const getIP = (request: Pick<Request, "headers">): string => {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
};
