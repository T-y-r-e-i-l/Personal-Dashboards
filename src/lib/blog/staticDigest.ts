import { format, parseISO } from "date-fns";
import type { DayContext } from "@/lib/blog/types";

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function noteLine(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (!flat) return "(empty note)";
  return flat.length > 160 ? `${flat.slice(0, 160)}…` : flat;
}

/** Deterministic day log markdown — no LLM. */
export function buildStaticSummaries(context: DayContext): {
  private_summary: string;
  public_summary: string;
} {
  const privateParts: string[] = [];
  const publicParts: string[] = [];

  if (context.weather) {
    const line = `${context.weather.temp}° · ${context.weather.description}${
      context.weather.location ? ` (${context.weather.location})` : ""
    }`;
    privateParts.push(`### Weather\n\n${line}`);
    publicParts.push(`### Weather\n\n${line}`);
  }

  if (context.priorities.length > 0) {
    privateParts.push(
      `### Priorities\n\n${bulletList(
        context.priorities.map(
          (p) => `${p.done ? "✓" : "○"} ${p.title} (${p.tier})`,
        ),
      )}`,
    );
  }

  if (context.completed_tasks.length > 0) {
    privateParts.push(
      `### Completed tasks\n\n${bulletList(
        context.completed_tasks.map((t) => t.title),
      )}`,
    );
  }

  if (context.mood) {
    const bits = [`Mood ${context.mood.mood}/10`];
    if (context.mood.energy != null) bits.push(`energy ${context.mood.energy}/10`);
    if (context.mood.stress != null) bits.push(`stress ${context.mood.stress}/10`);
    let moodBlock = bits.join(" · ");
    if (context.mood.note?.trim()) {
      moodBlock += `\n\n${context.mood.note.trim()}`;
    }
    privateParts.push(`### Mood\n\n${moodBlock}`);
  }

  if (context.calendar.length > 0) {
    privateParts.push(
      `### Calendar\n\n${bulletList(
        context.calendar.map((event) => {
          const start = format(new Date(event.starts_at), "h:mm a");
          return `${start} — ${event.title}`;
        }),
      )}`,
    );
  }

  const completedHabits = context.habits.filter((h) => h.completed);
  if (completedHabits.length > 0) {
    privateParts.push(
      `### Habits\n\n${bulletList(completedHabits.map((h) => h.name))}`,
    );
  }

  if (context.water && context.water.glasses > 0) {
    privateParts.push(
      `### Water\n\n${context.water.glasses} / ${context.water.goal} glasses`,
    );
  }

  if (context.time_tracking.length > 0) {
    privateParts.push(
      `### Time tracking\n\n${bulletList(
        context.time_tracking.map((entry) => {
          const label = entry.task_title || entry.description || "Focus";
          return `${label} — ${formatMinutes(entry.minutes)}`;
        }),
      )}`,
    );
  }

  if (context.notes.length > 0) {
    privateParts.push(
      `### Notes\n\n${bulletList(
        context.notes.map((note) => {
          const time = format(parseISO(note.created_at), "h:mm a");
          return `${time} (${note.visibility}): ${noteLine(note.content)}`;
        }),
      )}`,
    );

    const publicNotes = context.notes.filter((n) => n.visibility === "public");
    if (publicNotes.length > 0) {
      publicParts.push(
        `### Notes\n\n${bulletList(
          publicNotes.map((note) => {
            const time = format(parseISO(note.created_at), "h:mm a");
            return `${time}: ${noteLine(note.content)}`;
          }),
        )}`,
      );
    }
  }

  const private_summary =
    privateParts.length > 0
      ? privateParts.join("\n\n")
      : "_No activity recorded for this day._";

  const public_summary =
    publicParts.length > 0
      ? publicParts.join("\n\n")
      : "_A quiet day._";

  return { private_summary, public_summary };
}
