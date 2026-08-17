const EASTERN_TIME_ZONE = "America/New_York";
const BEIJING_TIME_ZONE = "Asia/Shanghai";

function formattedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
}

function dateKeyFromParts(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function resolveEasternLocalTime(dateKey, time) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);

  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const candidate = new Date(localAsUtc + offsetMinutes * 60_000);
    const candidateParts = formattedParts(candidate, EASTERN_TIME_ZONE);
    if (
      dateKeyFromParts(candidateParts) === dateKey &&
      candidateParts.hour === time.slice(0, 2) &&
      candidateParts.minute === time.slice(3, 5)
    ) {
      return candidate;
    }
  }

  return null;
}

function addUtcDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateKeyInZone(date, timeZone) {
  return dateKeyFromParts(formattedParts(date, timeZone));
}

export function formatEventTime(event) {
  if (event.time_et === null) {
    return { et: "时间待定", bj: "时间待定" };
  }

  const easternInstant = resolveEasternLocalTime(event.date, event.time_et);
  if (easternInstant === null) {
    return { et: `${event.time_et} ET`, bj: "北京时间待定" };
  }

  const beijingParts = formattedParts(easternInstant, BEIJING_TIME_ZONE);
  const beijingDate = dateKeyFromParts(beijingParts);
  const dayLabel = beijingDate === event.date ? "" : beijingDate > event.date ? "次日 " : "前日 ";

  return {
    et: `${event.time_et} ET`,
    bj: `${dayLabel}${beijingParts.hour}:${beijingParts.minute} 北京时间`,
  };
}

function dateKeyForEventFiltering(event) {
  // Events without a published ET time are date-only, so their source date is
  // also the date used by the Beijing calendar filters.
  if (event.time_et === null) return event.date;

  const easternInstant = resolveEasternLocalTime(event.date, event.time_et);
  return easternInstant === null
    ? event.date
    : dateKeyInZone(easternInstant, BEIJING_TIME_ZONE);
}

export function eventsForDate(events, dateKey) {
  return events.filter((event) => dateKeyForEventFiltering(event) === dateKey);
}

export function eventsForNextSevenDays(events, todayKey) {
  const dateKeys = new Set(Array.from({ length: 7 }, (_, index) => addUtcDays(todayKey, index)));

  return events
    .filter((event) => dateKeys.has(dateKeyForEventFiltering(event)))
    .sort((left, right) => {
      const byDate = left.date.localeCompare(right.date);
      if (byDate !== 0) return byDate;
      return (left.time_et ?? "99:99").localeCompare(right.time_et ?? "99:99");
    });
}
