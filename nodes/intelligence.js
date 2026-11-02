"use strict";

/**
 * nuasense-intelligence: ask NuaSense what it makes of a station.
 *
 * Three questions, chosen in the node: the stations on the account, the first
 * look for one station (tonight's low, the next calm dry window, the latest
 * reading against the model), or the computed hourly values (ET0, leaf
 * wetness, spray quality, …). The answer is the API's JSON as msg.payload.
 */
module.exports = function (RED) {
  function NuaSenseIntelligenceNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const base = String(config.baseUrl || "https://api.nuasense.com").replace(/\/+$/, "");
    const apiKey = (node.credentials && node.credentials.apiKey) || "";
    const what = config.what || "first-look";

    if (!apiKey) {
      node.status({ fill: "red", shape: "ring", text: "no API key" });
    }

    node.on("input", async (msg, send, done) => {
      send = send || function () { node.send.apply(node, arguments); };
      const stationId = msg.station_id || config.stationId || "";
      let path;
      if (what === "stations") path = "/api/nuasense/v1/ingest/stations";
      else if (what === "derived") path = `/api/nuasense/v1/ingest/derived?station_id=${encodeURIComponent(stationId)}&start=-24h&limit=24`;
      else path = `/api/nuasense/v1/ingest/first-look?station_id=${encodeURIComponent(stationId)}`;
      if (what !== "stations" && !stationId) {
        const err = new Error("station_id is required — set it on the node or in msg.station_id");
        if (done) done(err); else node.error(err.message, msg);
        return;
      }
      try {
        const res = await fetch(base + path, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
        });
        const text = await res.text();
        let body;
        try { body = JSON.parse(text); } catch { body = { raw: text }; }
        if (!res.ok) {
          node.status({ fill: "yellow", shape: "ring", text: `${res.status}` });
          const err = new Error(body.error || body.message || `NuaSense answered ${res.status}`);
          if (done) done(err); else node.error(err.message, msg);
          return;
        }
        msg.payload = body;
        node.status({ fill: "green", shape: "dot", text: what });
        send(msg);
        if (done) done();
      } catch (e) {
        node.status({ fill: "red", shape: "ring", text: "request failed" });
        if (done) done(e); else node.error(e.message, msg);
      }
    });
  }

  RED.nodes.registerType("nuasense-intelligence", NuaSenseIntelligenceNode, {
    credentials: { apiKey: { type: "password" } },
  });
};
