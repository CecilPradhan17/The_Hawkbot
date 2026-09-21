import pool from "../db.js";

const dateOnly = value => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value).slice(0, 10);

const timeOnly = value => String(value).slice(0, 5);

const groupIntervals = (rows, idKey) => {
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row[idKey]) || [];
    list.push({
      opensAt: timeOnly(row.opens_at),
      closesAt: timeOnly(row.closes_at),
      closesNextDay: row.closes_next_day,
    });
    grouped.set(row[idKey], list);
  }
  return grouped;
};

export async function getFacilityDictionary(database = pool) {
  const result = await database.query(
    `SELECT f.id, f.name, a.normalized_alias
     FROM facilities f
     JOIN facility_aliases a ON a.facility_id = f.id
     WHERE f.active = TRUE
     ORDER BY length(a.normalized_alias) DESC`
  );
  return result.rows;
}

export async function getNamedHoursDictionary(database = pool) {
  const result = await database.query(
    `SELECT DISTINCT name
     FROM (
       SELECT p.name
       FROM special_periods p
       JOIN facility_schedules s ON s.id = p.schedule_id
       JOIN facilities f ON f.id = s.facility_id
       WHERE f.active = TRUE
       UNION
       SELECT e.name
       FROM date_exceptions e
       JOIN facility_schedules s ON s.id = e.schedule_id
       JOIN facilities f ON f.id = s.facility_id
       WHERE f.active = TRUE
     ) named_hours`
  );
  return result.rows;
}

/**
 * Reconstructs one immutable published schedule inside a repeatable-read
 * transaction. A concurrent replacement therefore cannot mix old and new rows.
 */
export async function getPublishedSchedule(facilityId, database = pool) {
  const client = await database.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const scheduleResult = await client.query(
      `SELECT s.*, f.name AS facility_name
       FROM facility_schedules s
       JOIN facilities f ON f.id = s.facility_id
       WHERE s.facility_id = $1 AND f.active = TRUE`,
      [facilityId]
    );
    if (scheduleResult.rowCount === 0) {
      await client.query("COMMIT");
      return null;
    }
    const schedule = scheduleResult.rows[0];
    const [weeklyRows, weeklyIntervals, periods, periodDays, periodIntervals, exceptions, exceptionIntervals] = await Promise.all([
      client.query("SELECT * FROM weekly_hours WHERE schedule_id = $1 ORDER BY weekday", [schedule.id]),
      client.query(`SELECT i.* FROM weekly_intervals i JOIN weekly_hours d ON d.id = i.weekly_hours_id WHERE d.schedule_id = $1 ORDER BY i.position`, [schedule.id]),
      client.query("SELECT * FROM special_periods WHERE schedule_id = $1 ORDER BY start_date", [schedule.id]),
      client.query(`SELECT d.* FROM special_period_days d JOIN special_periods p ON p.id = d.special_period_id WHERE p.schedule_id = $1 ORDER BY d.weekday`, [schedule.id]),
      client.query(`SELECT i.* FROM special_period_intervals i JOIN special_period_days d ON d.id = i.special_period_day_id JOIN special_periods p ON p.id = d.special_period_id WHERE p.schedule_id = $1 ORDER BY i.position`, [schedule.id]),
      client.query("SELECT * FROM date_exceptions WHERE schedule_id = $1 ORDER BY exception_date", [schedule.id]),
      client.query(`SELECT i.* FROM date_exception_intervals i JOIN date_exceptions e ON e.id = i.date_exception_id WHERE e.schedule_id = $1 ORDER BY i.position`, [schedule.id]),
    ]);
    await client.query("COMMIT");

    const weeklyIntervalMap = groupIntervals(weeklyIntervals.rows, "weekly_hours_id");
    const periodIntervalMap = groupIntervals(periodIntervals.rows, "special_period_day_id");
    const exceptionIntervalMap = groupIntervals(exceptionIntervals.rows, "date_exception_id");
    return {
      id: schedule.id,
      facilityId: schedule.facility_id,
      facilityName: schedule.facility_name,
      coverageStart: dateOnly(schedule.coverage_start),
      coverageEnd: dateOnly(schedule.coverage_end),
      sourceLabel: schedule.source_label,
      publishedAt: schedule.published_at,
      weekly: weeklyRows.rows.map(day => ({
        weekday: day.weekday,
        status: day.status,
        intervals: weeklyIntervalMap.get(day.id) || [],
      })),
      specialPeriods: periods.rows.map(period => ({
        name: period.name,
        startDate: dateOnly(period.start_date),
        endDate: dateOnly(period.end_date),
        days: periodDays.rows.filter(day => day.special_period_id === period.id).map(day => ({
          weekday: day.weekday,
          status: day.status,
          intervals: periodIntervalMap.get(day.id) || [],
        })),
      })),
      exceptions: exceptions.rows.map(exception => ({
        date: dateOnly(exception.exception_date),
        name: exception.name,
        status: exception.status,
        intervals: exceptionIntervalMap.get(exception.id) || [],
      })),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const METRIC_COLUMNS = new Set([
  "structured_hits", "unverified_answers", "ambiguous_fallbacks",
  "rag_fallbacks", "embedding_calls_avoided", "llm_calls_avoided",
]);

export async function incrementHoursMetrics(columns, database = pool) {
  const safeColumns = [...new Set(columns)].filter(column => METRIC_COLUMNS.has(column));
  if (safeColumns.length === 0) return;
  const insertColumns = ["usage_date", ...safeColumns].join(", ");
  const insertValues = ["CURRENT_DATE", ...safeColumns.map(() => "1")].join(", ");
  const updates = safeColumns.map(column => `${column} = hours_usage_daily.${column} + 1`).join(", ");
  await database.query(
    `INSERT INTO hours_usage_daily (${insertColumns}) VALUES (${insertValues})
     ON CONFLICT (usage_date) DO UPDATE SET ${updates}`
  );
}
