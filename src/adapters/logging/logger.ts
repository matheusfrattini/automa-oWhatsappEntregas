type LogFields = Record<string, unknown>;

function log(level: "info" | "warn" | "error", msg: string, fields?: LogFields): void {
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, fields?: LogFields) => log("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => log("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => log("error", msg, fields),
};
