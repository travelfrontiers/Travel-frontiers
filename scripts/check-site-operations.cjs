const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load(file, mocks = {}, env = {}, network = fetch) {
    const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const module = { exports: {} };
    const imports = name => name in mocks ? mocks[name] : require(name);
    new Function("module", "exports", "require", "process", "fetch", outputText)(
        module, module.exports, imports, { env }, network,
    );
    return module.exports;
}

(async () => {
    const auth = { studioBearer: request => request.headers.get("authorization")?.slice(7), isAuthorizedStudioUser: async request => request.headers.get("authorization") === "Bearer studio" };
    const controls = load("src/lib/studio-request.ts", { "./crm-api": auth });
    const request = (path, authHeader, body) => new Request("https://site.test/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: authHeader ? { authorization: authHeader } : {},
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let archived = 0;
    const transaction = {
        patch(id, builder) {
            builder({ ifRevisionId() { return this; }, set(value) {
                assert.equal(value.status, "archived");
                archived++;
            } });
            return this;
        },
        async commit() {},
    };
    const client = {
        withConfig() { return this; },
        fetch: async () => [{ _id: "p1", _rev: "a", language: "pt", validUntil: "2000-01-01" },
            { _id: "p1-en", _rev: "b", language: "en" }, { _id: "drafts.p1-fr", _rev: "c", language: "fr" }],
        transaction: () => transaction,
    };
    const archive = load("src/app/api/expire-promotions/route.ts", {
        "@/lib/crm-api": auth, "@/lib/studio-request": controls,
        "@/lib/promotions": { promotionDay: () => "2026-11-11", promotionGroupId: id => id.replace(/^drafts\./, "").replace(/-(en|fr)$/, "") },
        "@/sanity/client": { writeClient: client },
    }, { CRON_SECRET: "only-scheduled" });
    assert.equal((await archive.GET(new Request("https://site.test/expire", { headers: { "x-vercel-cron": "1" } }))).status, 401);
    assert.equal((await archive.POST(request("expire", "Bearer only-scheduled", {}))).status, 401);
    assert.equal(archived, 0);
    assert.equal((await archive.GET(request("expire", "Bearer only-scheduled"))).status, 200);
    assert.equal(archived, 3);
    assert.equal((await archive.POST(request("expire", "Bearer studio", { id: "p1" }))).status, 200);
    assert.equal(archived, 6);

    let providerCalls = 0;
    const translate = load("src/app/api/translate/route.ts", {
        "@/lib/studio-request": controls,
        "@/lib/gemini": { generateText: async () => { providerCalls++; throw new Error("failure"); } },
    });
    const promotion = { title: "Teste", description: ["Texto"], subtitle: "", location: "", duration: "", highlights: [], inclusions: [] };
    assert.equal((await translate.POST(request("translate", null, promotion))).status, 401);
    assert.equal(providerCalls, 0);
    assert.equal((await translate.POST(request("translate", "Bearer studio", promotion))).status, 502);
    assert.equal(providerCalls, 2);
    assert.equal((await translate.POST(request("translate", "Bearer studio", { ...promotion, description: ["x".repeat(25_000)] }))).status, 413);

    let migrationStarted = false;
    const source = load("src/app/api/itinerary-source/route.ts", {
        "@/lib/crm-api": auth, "@/lib/studio-request": controls,
        "@/lib/itinerary-source": { sourceExtension: () => "pdf" },
        "@/sanity/client": { writeClient: { withConfig() { migrationStarted = true; } } },
    });
    assert.equal((await source.POST(request("itinerary-source?action=migrate", null, {}))).status, 401);
    assert.equal(migrationStarted, false);

    const bytes = Buffer.from("%PDF-synthetic-only");
    const migrationOperations = [];
    let brokenBackup = true;
    let committed = false;
    const migrationTransaction = {
        create(document) { migrationOperations.push(["draft", document]); return this; },
        patch(id, builder) {
            builder({ ifRevisionId() { return this; }, unset() { return this; } });
            migrationOperations.push(["patch", id]); return this;
        },
        delete(id) { migrationOperations.push(["delete", id]); return this; },
        toJSON: () => migrationOperations,
        async commit() { committed = true; },
    };
    const migrationClient = {
        withConfig() { return this; },
        config: () => ({ projectId: "test", dataset: "production" }),
        fetch: async () => [{ _id: "old", _rev: "v1", title: "Synthetic", asset: { _id: "old-asset", url: "https://cdn.sanity.io/files/test/production/fake.pdf", extension: "pdf" } }],
        transaction: () => migrationTransaction,
    };
    const migration = load("src/app/api/itinerary-source/route.ts", {
        "@/lib/crm-api": auth, "@/lib/studio-request": controls,
        "@/lib/itinerary-source": {
            sourceExtension: () => "pdf",
            readOldSource: async () => bytes,
            savePrivateSource: async (key, uploaded) => { assert.match(key, /^[a-f0-9]{64}\.pdf$/); assert.deepEqual(uploaded, bytes); },
            loadPrivateSource: async () => brokenBackup ? Buffer.from("invalid") : bytes,
        },
        "@/sanity/client": { writeClient: migrationClient },
    });
    assert.equal((await migration.POST(request("itinerary-source?action=migrate", "Bearer studio", {}))).status, 502);
    assert.deepEqual(migrationOperations, []);
    assert.equal(committed, false);
    brokenBackup = false;
    const moved = await migration.POST(request("itinerary-source?action=migrate", "Bearer studio", {}));
    assert.deepEqual(await moved.json(), { documents: 1, files: 1 });
    assert.equal(committed, true);
    assert.equal(migrationOperations[0][1]._id, "drafts.old");
    assert.deepEqual(migrationOperations.slice(-2), [["delete", "old"], ["delete", "old-asset"]]);

    const { calculateCommission } = load("src/lib/commission.ts");
    const base = { commission: 100, travelerCount: 3, travelerPrice: 100, selfTravels: false, costPerTraveler: 80, shareSaving: false, cedeCommission: true, requestedCession: 0.01 };
    assert.deepEqual(calculateCommission(base).otherPriceGroups, [{ count: 2, price: 100 }, { count: 1, price: 99.99 }]);
    for (const selfTravels of [false, true]) for (const shareSaving of [false, true]) for (let count = 1; count <= 20; count++) {
        const result = calculateCommission({ ...base, travelerCount: count, selfTravels, shareSaving });
        const sum = (result.ownPrice ?? 0) + result.otherPriceGroups.reduce((total, group) => total + group.count * group.price, 0);
        assert.equal(Math.round(sum * 100), Math.round(result.totalCollected * 100));
    }
    console.log("PASS: Studio authorization, cron secret, reversible promotion archiving, translation errors and limits, itinerary migration authorization, commission cents.");
})().catch(error => { console.error(error); process.exitCode = 1; });
