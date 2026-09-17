import pool from "../db.js";

const dateOnly = value => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value).slice(0, 10);

export async function listFacilities(database = pool) {
  const result = await database.query(
    `SELECT f.id, f.name, f.active,
            COALESCE(array_agg(a.alias ORDER BY a.alias) FILTER (WHERE a.id IS NOT NULL), '{}') AS aliases,
            s.coverage_start, s.coverage_end, s.source_label, s.published_at
     FROM facilities f
     LEFT JOIN facility_aliases a ON a.facility_id = f.id
     LEFT JOIN facility_schedules s ON s.facility_id = f.id
     WHERE f.active = TRUE
     GROUP BY f.id, s.id
     ORDER BY f.name`
  );
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    active: row.active,
    aliases: row.aliases,
    schedule: row.source_label ? {
      coverageStart: dateOnly(row.coverage_start),
      coverageEnd: dateOnly(row.coverage_end),
      sourceLabel: row.source_label,
      publishedAt: row.published_at,
    } : null,
  }));
}

