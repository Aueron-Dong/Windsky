import { fetchEvents } from "./event-source.js";
import {
  dateKeyInZone,
  eventsForDate,
  eventsForNextSevenDays,
  formatEventTime,
} from "./event-utils.js";

const IMPORTANCE_LABELS = {
  high: "高",
  medium: "中",
  low: "低",
};

export function createEventCard(event) {
  const times = formatEventTime(event);
  const card = document.createElement("article");
  const header = document.createElement("div");
  const name = document.createElement("h3");
  const importance = document.createElement("span");
  const date = document.createElement("p");
  const eventTimes = document.createElement("div");
  const et = document.createElement("p");
  const bj = document.createElement("p");

  card.className = "event-card";
  header.className = "event-card__header";
  name.textContent = event.name;
  importance.className = `importance importance-${event.importance}`;
  importance.textContent = IMPORTANCE_LABELS[event.importance];
  date.className = "event-date";
  date.textContent = `${event.date} · ${event.type}`;
  eventTimes.className = "event-times";
  et.textContent = `美东时间：${times.et}`;
  bj.textContent = `北京时间：${times.bj}`;

  header.append(name, importance);
  eventTimes.append(et, bj);
  card.append(header, date, eventTimes);

  if (event.note.trim()) {
    const note = document.createElement("p");
    note.className = "event-note";
    note.textContent = `备注：${event.note}`;
    card.append(note);
  }

  return card;
}

export function renderEvents(container, events) {
  container.replaceChildren(...events.map(createEventCard));
}

export async function startApp() {
  const todayStatus = document.getElementById("today-status");
  const todayEvents = document.getElementById("today-events");
  const upcomingEvents = document.getElementById("upcoming-events");
  const dataError = document.getElementById("data-error");

  try {
    const events = await fetchEvents();
    const todayKey = dateKeyInZone(new Date(), "Asia/Shanghai");
    const today = eventsForDate(events, todayKey);

    todayStatus.textContent = today.length
      ? "⚠️ 今日是风险事件日"
      : "✅ 今日无重大风险事件";
    renderEvents(todayEvents, today);
    renderEvents(upcomingEvents, eventsForNextSevenDays(events, todayKey));
  } catch {
    dataError.hidden = false;
    dataError.textContent = "事件数据加载失败，请稍后重试。";
  }
}

if (typeof document !== "undefined") {
  startApp();
}
