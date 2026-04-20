const isDev = process.env.NODE_ENV !== "production";

function fmt(level: string, msg: string, meta?: unknown): string {
  const m = meta && Object.keys(meta as object).length ? ` ${JSON.stringify(meta)}` : "";
  return `[${level}] ${msg}${m}`;
}

export const logger = {
  info: (msg: string, meta?: unknown) => {
    if (isDev) console.error(fmt("INFO", msg, meta));
  },
  warn: (msg: string, meta?: unknown) => console.error(fmt("WARN", msg, meta)),
  error: (msg: string, meta?: unknown) => console.error(fmt("ERROR", msg, meta)),
};
