import pool from "../db.js";
import { validateSchedule } from "./hours-validation.services.js";

export const normalizeAlias = (value = "") => value
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

function httpError(message, status, details) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

function cleanFacilityInput({ name, aliases = [] } = {}) {
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName || cleanName.length > 100) {
    throw httpError("Facility name must be between 1 and 100 characters", 400);
  }
  if (!Array.isArray(aliases) || aliases.length > 20) {
    throw httpError("Aliases must be an array with at most 20 entries", 400);
  }

  const byNormalizedValue = new Map([[normalizeAlias(cleanName), cleanName]]);
  for (const alias of aliases) {
    if (typeof alias !== "string" || !alias.trim() || alias.trim().length > 100) {
      throw httpError("Each alias must be between 1 and 100 characters", 400);
    }
    byNormalizedValue.set(normalizeAlias(alias), alias.trim());
  }
  return { name: cleanName, aliases: [...byNormalizedValue].map(([normalized, display]) => ({ normalized, display })) };
}

async function addIntervals(client, table, foreignKey, parentId, intervals) {
  for (let position = 0; position < intervals.length; position += 1) {
    const interval = intervals[position];
    await client.query(
      `INSERT INTO ${table} (${foreignKey}, opens_at, closes_at, closes_next_day, position)
       VALUES ($1, $2, $3, $4, $5)`,
      [parentId, interval.opensAt, interval.closesAt, interval.closesNextDay === true, position]
    );
  }
}

export async function createFacility(input, database = pool) {
  const facility = cleanFacilityInput(input);
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "INSERT INTO facilities (name) VALUES ($1) RETURNING id, name, active",
      [facility.name]
    );
    for (const alias of facility.aliases) {
      await client.query(
        `INSERT INTO facility_aliases (facility_id, alias, normalized_alias)
         VALUES ($1, $2, $3)`,
        [result.rows[0].id, alias.display, alias.normalized]
      );
    }
    await client.query("COMMIT");
    return { ...result.rows[0], aliases: facility.aliases.map(alias => alias.display) };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") throw httpError("That facility already exists", 409);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateFacility(facilityId, input, database = pool) {
  if (!Number.isInteger(facilityId) || facilityId <= 0) throw httpError("Facility not found", 404);
  const facility = cleanFacilityInput(input);
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "UPDATE facilities SET name = $1, updated_at = NOW() WHERE id = $2 AND active = TRUE RETURNING id, name, active",
      [facility.name, facilityId]
    );
    if (result.rowCount === 0) throw httpError("Facility not found", 404);
    await client.query("DELETE FROM facility_aliases WHERE facility_id = $1", [facilityId]);
    for (const alias of facility.aliases) {
      await client.query(
        `INSERT INTO facility_aliases (facility_id, alias, normalized_alias)
         VALUES ($1, $2, $3)`,
        [facilityId, alias.display, alias.normalized]
      );
    }
    await client.query("COMMIT");
    return { ...result.rows[0], aliases: facility.aliases.map(alias => alias.display) };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") throw httpError("That facility already exists", 409);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteFacility(facilityId, database = pool) {
  if (!Number.isInteger(facilityId) || facilityId <= 0) throw httpError("Facility not found", 404);
  const result = await database.query(
    "DELETE FROM facilities WHERE id = $1 AND active = TRUE RETURNING id",
    [facilityId]
  );
  if (result.rowCount === 0) throw httpError("Facility not found", 404);
}

export async function publishSchedule(schedule, database = pool) {
  const validation = validateSchedule(schedule);
  if (!validation.valid) throw httpError("Schedule validation failed", 400, validation);

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const facility = await client.query(
      "SELECT id FROM facilities WHERE id = $1 AND active = TRUE FOR UPDATE",
      [schedule.facilityId]
    );
    if (facility.rowCount === 0) throw httpError("Facility not found", 404);

    // Cascades remove all old rules. The transaction makes deletion and the
    // fully populated replacement visible as one atomic change.
    await client.query("DELETE FROM facility_schedules WHERE facility_id = $1", [schedule.facilityId]);
    const inserted = await client.query(
      `INSERT INTO facility_schedules
        (facility_id, coverage_start, coverage_end, source_label, published_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, published_at`,
      [schedule.facilityId, schedule.coverageStart, schedule.coverageEnd, schedule.sourceLabel.trim()]
    );
    const scheduleId = inserted.rows[0].id;

    for (const day of schedule.weekly) {
      const row = await client.query(
        `INSERT INTO weekly_hours (schedule_id, weekday, status)
         VALUES ($1, $2, $3) RETURNING id`,
        [scheduleId, day.weekday, day.status]
      );
      await addIntervals(client, "weekly_intervals", "weekly_hours_id", row.rows[0].id, day.intervals);
    }

    for (const period of schedule.specialPeriods) {
      const periodRow = await client.query(
        `INSERT INTO special_periods (schedule_id, name, start_date, end_date)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [scheduleId, period.name.trim(), period.startDate, period.endDate]
      );
      for (const day of period.days) {
        const dayRow = await client.query(
          `INSERT INTO special_period_days (special_period_id, weekday, status)
           VALUES ($1, $2, $3) RETURNING id`,
          [periodRow.rows[0].id, day.weekday, day.status]
        );
        await addIntervals(client, "special_period_intervals", "special_period_day_id", dayRow.rows[0].id, day.intervals);
      }
    }

    for (const exception of schedule.exceptions) {
      const row = await client.query(
        `INSERT INTO date_exceptions (schedule_id, exception_date, name, status)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [scheduleId, exception.date, exception.name.trim(), exception.status]
      );
      await addIntervals(client, "date_exception_intervals", "date_exception_id", row.rows[0].id, exception.intervals);
    }

    await client.query("COMMIT");
    return { scheduleId, publishedAt: inserted.rows[0].published_at };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

