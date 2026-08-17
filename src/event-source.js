const EVENT_TYPES = new Set([
  "CPI", "PPI", "NFP", "FOMC", "POWELL_SPEECH", "GDP", "BTC_EVENT", "OTHER",
]);
const IMPORTANCE_LEVELS = new Set(["high", "medium", "low"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function assertEventRecord(event) {
  if (event === null || typeof event !== "object" || Array.isArray(event)) throw new Error("事件记录必须是对象");
  if (typeof event.date !== "string" || !DATE_PATTERN.test(event.date)) throw new Error("事件日期格式无效");
  if (typeof event.type !== "string" || !EVENT_TYPES.has(event.type)) throw new Error("事件类型无效");
  if (typeof event.name !== "string" || event.name.length === 0) throw new Error("事件名称无效");
  if (event.time_et !== null && (typeof event.time_et !== "string" || !TIME_PATTERN.test(event.time_et))) throw new Error("事件时间格式无效");
  if (typeof event.importance !== "string" || !IMPORTANCE_LEVELS.has(event.importance)) throw new Error("事件重要度无效");
  if (event.note !== undefined && typeof event.note !== "string") throw new Error("事件备注无效");
  return { ...event, note: event.note ?? "" };
}

function eventKey(event) {
  return [event.date, event.type, event.name, event.time_et ?? ""].join("|");
}

export function mergeEvents(manualEvents, automaticEvents) {
  const merged = new Map();
  for (const event of automaticEvents.map(assertEventRecord)) merged.set(eventKey(event), event);
  for (const event of manualEvents.map(assertEventRecord)) merged.set(eventKey(event), event);
  return [...merged.values()].sort((left, right) =>
    left.date.localeCompare(right.date) || (left.time_et ?? "99:99").localeCompare(right.time_et ?? "99:99"),
  );
}

async function loadEventArray(url, optional = false) {
  const response = await fetch(url);
  if (optional && response.status === 404) return [];
  if (!response.ok) throw new Error("无法读取事件数据");
  const events = await response.json();
  if (!Array.isArray(events)) throw new Error("事件数据必须是数组");
  return events;
}

export async function fetchEvents(manualUrl = "./events.json", autoUrl = "./events.auto.json") {
  const [manualEvents, automaticEvents] = await Promise.all([
    loadEventArray(manualUrl),
    loadEventArray(autoUrl, true),
  ]);
  return mergeEvents(manualEvents, automaticEvents);
}
