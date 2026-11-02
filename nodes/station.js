"use strict";

const { toEcowitt, encodeForm, uploadUrl } = require("../lib/ecowitt");

/**
 * nuasense-station: one reading in, one upload to NuaSense out.
 *
 * msg.payload carries the reading in metric units (see README). The node
 * posts it to the station's path exactly as an Ecowitt console would, and
 * passes the receiver's answer on as msg.payload so a flow can see it.
 */
module.exports = function (RED) {
  function NuaSenseStationNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = config.server || "ingest.nuasense.com";
    const deviceId = config.deviceId || node.id;
    const token = (node.credentials && node.credentials.token) || "";

    let url;
    try {
      url = uploadUrl(server, token);
    } catch (e) {
      node.status({ fill: "red", shape: "ring", text: "no station path" });
      node.error(e.message);
      return;
    }

    node.on("input", async (msg, send, done) => {
      send = send || function () { node.send.apply(node, arguments); };
      const fields = toEcowitt(msg.payload, { deviceId, stationType: "node-red-contrib-nuasense_V0.1.0" });
      const body = encodeForm(fields);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        const text = await res.text();
        msg.payload = { status: res.status, body: text, sent: fields };
        if (res.status >= 200 && res.status < 300) {
          node.status({ fill: "green", shape: "dot", text: `sent ${fields.dateutc.slice(11, 16)} UTC` });
          send(msg);
          if (done) done();
        } else {
          node.status({ fill: "yellow", shape: "ring", text: `${res.status}` });
          const reason = res.status === 404 ? "unknown or revoked station path"
            : res.status === 409 ? "path is bound to another device"
            : res.status === 429 ? "too fast — the receiver keeps one reading a minute"
            : `receiver answered ${res.status}`;
          if (done) done(new Error(`${reason}: ${text.slice(0, 120)}`)); else node.error(reason, msg);
        }
      } catch (e) {
        node.status({ fill: "red", shape: "ring", text: "upload failed" });
        if (done) done(e); else node.error(e.message, msg);
      }
    });
  }

  RED.nodes.registerType("nuasense-station", NuaSenseStationNode, {
    credentials: { token: { type: "password" } },
  });
};
