#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { toEcowitt, encodeForm, uploadUrl, passkeyFor, dateUtc } = require("../lib/ecowitt");

let n = 0;
const check = (name, fn) => { fn(); n += 1; console.log(`PASS  ${name}`); };

check("metric in, Ecowitt out", () => {
  const f = toEcowitt({
    temperature: 17.4, humidity: 89.7, pressure: 759.9, wind_speed: 2.0, wind_gusts: 4.5,
    wind_direction: 371, rain_total_mm: 254, solar_wm2: 226.3, uv: 1.4, time: "2026-11-02T15:02:00Z",
  }, { deviceId: "north-field" });
  assert.strictEqual(f.tempf, "63.32");
  assert.strictEqual(f.humidity, "90");
  assert.strictEqual(f.baromabsin, "22.44"); // 759.9 hPa = 22.4399 inHg
  assert.strictEqual(f.windspeedmph, "4.47");
  assert.strictEqual(f.windgustmph, "10.07");
  assert.strictEqual(f.winddir, "11");
  assert.strictEqual(f.yearlyrainin, "10");
  assert.strictEqual(f.solarradiation, "226.3");
  assert.strictEqual(f.uv, "1");
  assert.strictEqual(f.dateutc, "2026-11-02 15:02:00");
  assert.match(f.PASSKEY, /^[0-9A-F]{32}$/);
  assert.strictEqual(f.PASSKEY, passkeyFor("north-field"));
});

check("lux becomes W/m² when that is all there is", () => {
  const f = toEcowitt({ light_lux: 12000 }, { deviceId: "x" });
  assert.strictEqual(f.solarradiation, "100");
  assert.strictEqual(toEcowitt({ light_lux: 12000, solar_wm2: 90 }, { deviceId: "x" }).solarradiation, "90");
});

check("missing values are not sent, junk is ignored", () => {
  const f = toEcowitt({ temperature: "abc", humidity: null, wind_speed: "" }, { deviceId: "x" });
  assert.ok(!("tempf" in f) && !("humidity" in f) && !("windspeedmph" in f));
  assert.ok("dateutc" in f && "PASSKEY" in f);
  assert.ok(Math.abs(Date.parse(f.dateutc.replace(" ", "T") + "Z") - Date.now()) < 5000);
});

check("the form is url-encoded in order", () => {
  assert.strictEqual(encodeForm({ PASSKEY: "AB", "a b": "c&d" }), "PASSKEY=AB&a%20b=c%26d");
});

check("upload url accepts the token as shown, and refuses junk", () => {
  assert.strictEqual(uploadUrl("ingest.nuasense.com", "kw7n-4hpd-x2vt"), "http://ingest.nuasense.com/station/kw7n-4hpd-x2vt");
  assert.strictEqual(uploadUrl("http://Ingest.NuaSense.com/", "KW7N4HPDX2VT"), "http://Ingest.NuaSense.com/station/kw7n4hpdx2vt");
  assert.throws(() => uploadUrl("ingest.nuasense.com", "short"), /looks wrong/);
});

check("dateUtc falls back to now on garbage", () => {
  assert.match(dateUtc("not a date"), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

console.log(`\n${n} passed`);
