import { writeFile } from "node:fs/promises";

const BLS_CALENDAR = "https://www.bls.gov/schedule/news_release/bls.ics";
const FED_CALENDAR = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
const BEA_SCHEDULE = "https://www.bea.gov/news/schedule";
const EVENT_TYPES = new Set(["CPI", "PPI", "NFP"]);
const MONTHS = { January: "01", February: "02", March: "03", April: "04", May: "05", June: "06", July: "07", August: "08", September: "09", October: "10", November: "11", December: "12" };

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

export function parseFedFomcCalendar(html) {
  const years = [...html.matchAll(/<h4[^>]*>\s*<a[^>]*>(20\d{2}) FOMC Meetings<\/a><\/h4>([\s\S]*?)(?=<h4|$)/g)];
  return years.flatMap(([, year, section]) => [...section.matchAll(/fomc-meeting__month[^>]*><strong>([A-Z][a-z]+)<\/strong>[\s\S]*?fomc-meeting__date[^>]*>(\d{1,2})-(\d{1,2})\*?/g)].flatMap(([, month, , endDay]) => {
    const monthNumber = MONTHS[month];
    if (!monthNumber) return [];
    return [{ date: `${year}-${monthNumber}-${endDay.padStart(2, "0")}`, time_et: "14:00", type: "FOMC", name: `FOMC 会议（${month}）`, importance: "high", note: "来源：美联储（Federal Reserve）" }];
  }));
}

export function parseBeaSchedule(html) {
  const year = /Year\s*(20\d{2})/.exec(html)?.[1];
  if (!year) return [];
  return [...html.matchAll(/<tr[\s\S]*?<div class="release-date">([A-Z][a-z]+)\s+(\d{1,2})<\/div>[\s\S]*?<small[^>]*>(\d{1,2}):(\d{2})\s+AM<\/small>[\s\S]*?<td class="release-title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/td>/g)].flatMap(([, month, day, hour, minute, title]) => {
    const cleanTitle = title.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const type = cleanTitle.startsWith("GDP (") ? "GDP" : cleanTitle.startsWith("Personal Income and Outlays") ? "OTHER" : null;
    if (!type || !MONTHS[month]) return [];
    return [{ date: `${year}-${MONTHS[month]}-${day.padStart(2, "0")}`, time_et: `${hour.padStart(2, "0")}:${minute}`, type, name: type === "GDP" ? cleanTitle : `PCE / ${cleanTitle}`, importance: "high", note: "来源：美国经济分析局（BEA）" }];
  });
}

export async function sync() {
  const headers = { "User-Agent": "Windsky-risk-calendar" };
  const [blsResponse, fedResponse, beaResponse] = await Promise.all([fetch(BLS_CALENDAR, { headers }), fetch(FED_CALENDAR, { headers }), fetch(BEA_SCHEDULE, { headers })]);
  if (!blsResponse.ok || !fedResponse.ok || !beaResponse.ok) throw new Error("官方日历请求失败，保留现有自动数据");
  const events = upcomingEvents([
    ...parseBlsCalendar(await blsResponse.text()),
    ...parseFedFomcCalendar(await fedResponse.text()),
    ...parseBeaSchedule(await beaResponse.text()),
  ]);
  if (events.length === 0) throw new Error("BLS 日历未解析到目标事件，保留现有自动数据");
  await writeFile("events.auto.json", `${JSON.stringify(events, null, 2)}\n`);
  console.log(`已更新 ${events.length} 条 BLS 风险事件`);
}

if (import.meta.url === `file://${process.argv[1]}`) sync();
