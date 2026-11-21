const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Store } = require("../src/store");
const { Agent } = require("../src/agent");
const { AgentApi } = require("../src/api");

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "drive-agent-"));
  const store = new Store(path.join(root, "state"));
  const config = store.loadConfig();
  store.saveConfig({
    ...config,
    serverUrl: "http://localhost:3000",
    connectKey: "scd_" + "a".repeat(43),
  });
  await fs.writeFile(path.join(root, "photo.jpg"), "original bytes");
  const share = {
    id: "share-1",
    kind: "album",
    rootPath: root,
    mediaSecret: "s".repeat(43),
    allowOriginals: true,
    rawDownload: "raw",
    status: "active",
    expiresAt: null,
    files: { image_01: "photo.jpg" },
  };
  store.updateShares(() => [share]);
  const agents = [];
  t.after(async () => {
    for (const agent of agents) await agent.stop();
    await fs.rm(root, { recursive: true, force: true });
  });
  const url = (agent, variant = "original") =>
    `http://127.0.0.1:${agent.port}/m/${share.id}/${share.mediaSecret}/image_01/${variant}`;
  const makeAgent = (fetch, options = {}) => {
    const agent = new Agent(store, {
      api: new AgentApi(store.loadConfig(), { fetch }),
      ...options,
    });
    agents.push(agent);
    return agent;
  };
  return { root, store, share, url, makeAgent };
}

for (const [operation, route, period] of [
  ["heartbeat", "heartbeat", 30000],
  ["poll", "shares", 60000],
])
  test(`initial ${operation} failure retries with bounded backoff and reconnects`, async (t) => {
    const { share, makeAgent } = await fixture(t);
    let attempts = 0;
    const timers = {
      setTimeout(run, delay) {
        return { run, delay };
      },
      clearTimeout(timer) {
        if (timer) timer.cancelled = true;
      },
    };
    const api = async (request) => {
      if (request.endsWith("/" + route) && ++attempts <= 2)
        return new Response(JSON.stringify({ error: "temporary outage" }), { status: 503 });
      return new Response(
        JSON.stringify(request.endsWith("/shares") ? { shares: [share] } : { device: {} }),
      );
    };
    const agent = makeAgent(api, { timers });
    const states = [];
    agent.on("connection", (state) => states.push(state));
    await assert.doesNotReject(agent.start({ noTunnel: true }));
    assert.equal(agent.stopped, false);
    assert.equal(agent.media.server.listening, true);
    assert.equal(states.at(-1).status, "error");
    if (operation === "poll") {
      await agent.heartbeat();
      assert.equal(states.at(-1).status, "error");
    }
    const timer = () => agent[operation + "Timer"];
    assert.equal(timer().delay, 1000);
    await timer().run();
    assert.equal(timer().delay, 2000);
    await timer().run();
    assert.equal(timer().delay, period);
    assert.equal(states.at(-1).status, "connected");
    const pending = timer();
    await agent.stop();
    assert.equal(pending.cancelled, true);
    const before = attempts;
    await pending.run();
    assert.equal(attempts, before);
  });

for (const operation of ["heartbeat", "poll"])
  test(`401 from ${operation} latches revocation and prevents all further media serving`, async (t) => {
    const { store, share, url, makeAgent } = await fixture(t);
    let revoked = false;
    const api = async (request) =>
      new Response(
        JSON.stringify(request.endsWith("/shares") ? { shares: [share] } : { device: {} }),
        { status: revoked ? 401 : 200 },
      );
    const agent = makeAgent(api);
    const states = [];
    agent.on("connection", (state) => states.push(state));
    await agent.start({ noTunnel: true });
    assert.equal(await (await fetch(url(agent))).text(), "original bytes");
    revoked = true;
    await assert.rejects(agent[operation](), /Khóa kết nối/);
    assert.equal((await fetch(url(agent))).status, 404);
    assert.equal(store.loadShares()[0].status, "paused");
    assert.equal(states.at(-1).status, "revoked");
    revoked = false;
    await assert.rejects(agent.heartbeat(), { status: 401 });
    await assert.rejects(agent.poll(), { status: 401 });
    store.updateShares(() => [share]);
    assert.equal((await fetch(url(agent, "thumb"))).status, 404);
    assert.equal(
      (await fetch(`http://127.0.0.1:${agent.port}/z/${share.id}/${share.mediaSecret}`)).status,
      404,
    );
    await agent.stop();
    store.saveConfig({ ...store.loadConfig(), connectKey: "scd_" + "b".repeat(43) });
    const recovered = makeAgent(api);
    await recovered.start({ noTunnel: true });
    assert.equal(await (await fetch(url(recovered))).text(), "original bytes");
  });
