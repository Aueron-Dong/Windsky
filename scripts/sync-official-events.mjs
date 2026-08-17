import { writeFile } from "node:fs/promises";

const BLS_CALENDAR = "https://www.bls.gov/schedule/news_release/bls.ics";
const EVENT_TYPES = new Set(["CPI", "PPI", "NFP"]);

function unfoldIcs(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function parseIcsDate(value) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(value ?? "");
  if (!match) return null;
  return { date: `${match[1]}-${match[2]}-${match[3]}`, time_et: `${match[4]}:${match[5]}` };
}

export function parseBlsCalendar(icsText) {
  return unfoldIcs(icsText).split("BEGIN:VEVENT").slice(1).flatMap((block) => {
    const summary = /SUMMARY:(.+)/.exec(block)?.[1]?.trim() ?? "";
    const date = parseIcsDate(/DTSTART[^:]*:(.+)/.exec(block)?.[1]);
    const type = summary === "Consumer Price Index" ? "CPI"
      : summary === "Producer Price Index" ? "PPI"
      : summary === "Employment Situation" ? "NFP" : null;
    if (!type || !EVENT_TYPES.has(type) || !date) return [];
    return [{ ...date, type, name: summary, importance: "high", note: "来源：美国劳工统计局（BLS）" }];
  });
}

function etDate(today = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(today);
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function upcomingEvents(events, today = new Date()) {
  return events.filter((event) => event.date >= etDate(today));
}

export async function sync() {
  const response = await fetch(BLS_CALENDAR, { headers: { "User-Agent": "Windsky-risk-calendar" } });
  if (!response.ok) throw new Error(`BLS 日历请求失败：${response.status}`);
  const events = upcomingEvents(parseBlsCalendar(await response.text()));
  if (events.length === 0) throw new Error("BLS 日历未解析到目标事件，保留现有自动数据");
  await writeFile("events.auto.json", `${JSON.stringify(events, null, 2)}\n`);
  console.log(`已更新 ${events.length} 条 BLS 风险事件`);
}

if (import.meta.url === `file://${process.argv[1]}`) sync();
