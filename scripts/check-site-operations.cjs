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
        module, module.exports, imports, { env, cwd: process.cwd }, network,
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

    const emptyMeal = { nome: "", porque: "", morada: "", preco: "", maps: "" };
    const days = Array.from({ length: 15 }, (_, i) => ({
        data: `2030-04-${String(i + 6).padStart(2, "0")}`, titulo_dia: "Visita",
        atividades: ["Passeio de teste"], sugestao_jantar: emptyMeal,
        sugestao_almoco: { ...emptyMeal, nome: "Restaurante", maps: "endereço inválido" },
        imagem_nome_ingles: "",
    }));
    let planMode = "complete";
    const itinerary = load("src/app/api/generate-itinerary/route.ts", {
        "@/lib/studio-request": controls,
        "@/lib/itinerary-source": { sourceExtension: () => "txt", loadPrivateSource: async () => Buffer.from("Viagem fictícia") },
        "@/lib/gemini": { generateText: async (prompt, options) => {
            if (options.schema.properties.resumo) {
                return JSON.stringify({ partida: "2030-04-06", regresso: "2030-04-20", resumo: "Viagem fictícia" });
            }
            assert.ok(options.timeoutMs > 20_000);
            assert.match(prompt, /2030-04-06.*2030-04-20/);
            if (planMode === "timeout") throw new DOMException("timeout", "AbortError");
            return JSON.stringify({ introducao: "Roteiro", dicas: [], dias: planMode === "partial" ? days.slice(0, -1) : days });
        } },
    }, {}, async () => Response.json({}));
    const generate = () => itinerary.POST(request("generate-itinerary", "Bearer studio", { key: "test.txt", title: "Teste" }));
    const generated = await generate();
    assert.equal(generated.status, 200);
    assert.match(generated.headers.get("content-type"), /wordprocessingml/);
    assert.equal(Buffer.from(await generated.arrayBuffer()).subarray(0, 2).toString(), "PK");
    planMode = "partial";
    assert.equal((await generate()).status, 502);
    planMode = "timeout";
    assert.equal((await generate()).status, 504);

    const operations = [];
    let deletionStarted = false;
    const deletionTransaction = {
        patch(id, builder) {
            builder({ ifRevisionId() { return this; }, unset() { return this; } });
            operations.push(["patch", id]); return this;
        },
        delete(id) { operations.push(["delete", id]); return this; },
        async commit() {},
    };
    const deletionClient = {
        withConfig({ token }) { assert.equal(token, "studio"); deletionStarted = true; return this; },
        fetch: async (query) => query.includes("sanity.fileAsset")
            ? [{ _id: "old-asset", shared: 0 }, { _id: "shared-asset", shared: 1 }]
            : [{ _id: "old", _rev: "v1", assetId: "old-asset" }, { _id: "drafts.old2", _rev: "v2", assetId: "shared-asset" }],
        transaction: () => deletionTransaction,
    };
    const source = load("src/app/api/itinerary-source/route.ts", {
        "@/lib/crm-api": auth, "@/lib/studio-request": controls,
        "@/lib/itinerary-source": {},
        "@/sanity/client": { writeClient: deletionClient },
    });
    const path = "itinerary-source?action=delete-legacy";
    assert.equal((await source.POST(request(path, null, { confirmed: true }))).status, 401);
    assert.equal((await source.POST(request(path, "Bearer studio", {}))).status, 400);
    assert.equal(deletionStarted, false);
    const removed = await source.POST(request(path, "Bearer studio", { confirmed: true }));
    assert.deepEqual(await removed.json(), { documents: 2, files: 1, retainedFiles: 1 });
    assert.deepEqual(operations, [["patch", "old"], ["delete", "old"], ["patch", "drafts.old2"], ["delete", "drafts.old2"], ["delete", "old-asset"]]);

    const { calculateCommission } = load("src/lib/commission.ts");
    const base = { commission: 100, travelerCount: 3, travelerPrice: 100, selfTravels: false, costPerTraveler: 80, shareSaving: false, cedeCommission: true, requestedCession: 0.01 };
    assert.deepEqual(calculateCommission(base).otherPriceGroups, [{ count: 2, price: 100 }, { count: 1, price: 99.99 }]);
    for (const selfTravels of [false, true]) for (const shareSaving of [false, true]) for (let count = 1; count <= 20; count++) {
        const result = calculateCommission({ ...base, travelerCount: count, selfTravels, shareSaving });
        const sum = (result.ownPrice ?? 0) + result.otherPriceGroups.reduce((total, group) => total + group.count * group.price, 0);
        assert.equal(Math.round(sum * 100), Math.round(result.totalCollected * 100));
    }
    console.log("PASS: Studio authorization, cron secret, reversible promotion archiving, translation errors and limits, complete itinerary Word output and timeout, legacy itinerary deletion authorization and shared asset protection, commission cents.");
})().catch(error => { console.error(error); process.exitCode = 1; });
