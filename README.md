# node-red-contrib-nuasense

Two nodes that connect a Node-RED flow to [NuaSense](https://nuasense.com):

- **station → NuaSense** sends a reading to NuaSense exactly as an Ecowitt console would. Any station you already have in Node-RED — a Davis through weewx, a LoRaWAN sensor, a Modbus logger — becomes a NuaSense station.
- **NuaSense intelligence** reads back what NuaSense computes for a station: tonight's low and whether it is a frost night, the next calm dry daylight window for spraying, how the latest reading compares with the model, and the hourly values (ET0, leaf wetness, spray quality, VPD, delta T).

The first three stations on a NuaSense account connect free.

## Install

In Node-RED: Manage palette → Install → `node-red-contrib-nuasense`. Or:

```
cd ~/.node-red && npm install node-red-contrib-nuasense
```

Needs Node.js 18 or newer (the nodes use the built-in `fetch`).

## Sending readings

1. In the NuaSense console open **External stations → Add a station**, pick *Home Assistant / weewx / Meteobridge / Node-RED*, give it a name and a position. The last screen shows a path like `/station/kw7n-4hpd-x2vt`. The part after `/station/` is the token.
2. Put the token into a **station → NuaSense** node.
3. Feed it a message every 60 s whose `msg.payload` carries the reading in metric units:

| key | unit | note |
|---|---|---|
| `temperature` | °C | |
| `humidity` | % | |
| `pressure` | hPa | station level (not reduced to sea level) |
| `wind_speed`, `wind_gusts` | m/s | |
| `wind_direction` | ° | |
| `rain_total_mm` | mm | a counter that only grows; NuaSense turns it into increments |
| `solar_wm2` or `light_lux` | W/m² or lux | |
| `uv` | index | |
| `time` | ISO 8601 | optional; now when absent |

Missing keys are simply not sent. The receiver keeps one reading per station per minute, so sending faster gains nothing.

The node's output carries the receiver's answer (`status`, `body`) and the form it sent, so a debug node shows exactly what went out.

## Reading the intelligence

Make an API key in the console (**API Keys**, scope `ingest:write` — it covers reading your own stations) and put it into a **NuaSense intelligence** node. Choose what to ask for:

- **First look** — `tonight` (`low_c`, `at`, `frost`: `none` / `watch` / `frost`), `spray` (`window.from`, `window.to`, `wind_max_ms`, or a `reason` when there is no window), `station_check` (`verdict`: `plausible` / `check` / `off`, with `reading_c` and `model_c`).
- **Computed hourly values** — `data[]` with `et0_hour`, `lwd_hour`, `lwd_consecutive_hours`, `spray_quality_index`, `spray_quality_label`, `spray_limiting_factor`, `vpd`, `delta_t`, `dew_point`, `inversion_risk` and the hourly means.
- **Stations** — the stations on the account, with their position and last upload.

Trigger it with an inject node every 15–60 minutes.

## Your data

When you connect a station, NuaSense stores its readings and computes your forecast, spray windows and risks from them. The readings are used aggregated and anonymised to improve forecasts and models for everyone; they are never passed on individually without your opt-in. You can disconnect the station in the console at any time and have all its data deleted.

## Development

```
npm test
```

MIT licence. Issues and pull requests: https://github.com/nuasense/node-red-contrib-nuasense
