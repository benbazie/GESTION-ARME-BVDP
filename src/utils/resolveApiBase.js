const DEV_HOSTS = new Set(["localhost:3000", "127.0.0.1:3000"]);

export default function resolveApiBase() {
  if (typeof window !== "undefined") {
    const envBase = window.env?.API_BASE_URL;
    if (envBase) return envBase.replace(/\/$/, "");
    const origin = window.location?.origin || "";
    if (origin) {
      const host = origin.replace(/^https?:\/\//, "");
      if (DEV_HOSTS.has(host)) return "http://localhost:3001";
      return origin.replace(/\/$/, "");
    }
  }
  if (typeof process !== "undefined" && process.env?.API_BASE_URL) {
    return String(process.env.API_BASE_URL).replace(/\/$/, "");
  }
  return "http://localhost:3001";
}
