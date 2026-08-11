import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDayContextWeather } from "@/lib/blog/parseDayContext";

describe("parseDayContextWeather", () => {
  it("returns weather object when present", () => {
    const weather = parseDayContextWeather({
      weather: { location: "SF", temp: 68, description: "clear" },
    });
    assert.deepEqual(weather, {
      location: "SF",
      temp: 68,
      description: "clear",
    });
  });

  it("returns null for junk", () => {
    assert.equal(parseDayContextWeather(null), null);
    assert.equal(parseDayContextWeather({}), null);
  });
});
