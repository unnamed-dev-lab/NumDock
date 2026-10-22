import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_API_PORT ?? 8092);
const HOST = "127.0.0.1";
const ORG_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-01-01T00:00:00Z";

const organization = {
  id: ORG_ID,
  name: "Mock Workspace",
  slug: "mock-workspace",
  role: "owner",
  created_at: NOW,
};

const identity = {
  user: {
    id: USER_ID,
    email: "mock@example.test",
    name: "Mock User",
    created_at: NOW,
  },
  organizations: [organization],
};

const catalog = [
  {
    id: "33333333-3333-4333-8333-333333333331",
    e164: "+14155550101",
    country_code: "US",
    country_name: "United States",
    region: "San Francisco (Mock)",
    number_type: "mobile",
    capabilities: ["sms", "voice"],
    use_cases: ["openai", "google"],
    provider: "NumDock Mock",
    source: "mock",
    currency: "USD",
    monthly_fee_minor: 350,
    inbound_sms_fee_micros: 8000,
    status: "available",
    rental_options: [
      { days: 3, amount_minor: 35 },
      { days: 7, amount_minor: 82 },
      { days: 30, amount_minor: 350 },
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333332",
    e164: "+14155550102",
    country_code: "US",
    country_name: "United States",
    region: "Los Angeles (Mock)",
    number_type: "local",
    capabilities: ["sms", "mms"],
    use_cases: ["telegram", "whatsapp"],
    provider: "NumDock Mock",
    source: "mock",
    currency: "USD",
    monthly_fee_minor: 425,
    inbound_sms_fee_micros: 8500,
    status: "available",
    rental_options: [
      { days: 3, amount_minor: 43 },
      { days: 7, amount_minor: 100 },
      { days: 30, amount_minor: 425 },
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    e164: "+14155550103",
    country_code: "US",
    country_name: "United States",
    region: "Seattle (Mock)",
    number_type: "local",
    capabilities: ["sms", "voice"],
    use_cases: ["tiktok", "amazon"],
    provider: "NumDock Mock",
    source: "mock",
    currency: "USD",
    monthly_fee_minor: 475,
    inbound_sms_fee_micros: 9000,
    status: "available",
    rental_options: [
      { days: 3, amount_minor: 48 },
      { days: 7, amount_minor: 111 },
      { days: 30, amount_minor: 475 },
    ],
  },
];

let state;
let eventSeq = 0;
const sseClients = new Set();

function reset() {
  for (const client of sseClients) {
    try {
      client.end();
    } catch {
      // The client may already be closed by the browser.
    }
  }
  sseClients.clear();
  state = {
    wallet: { currency: "USD", available_minor: 0, reserved_minor: 0 },
    numbers: [],
    orders: [],
    payments: [],
    ledger: [],
    paymentSeq: 0,
    orderSeq: 0,
    ledgerSeq: 0,
    failNextOrder: false,
  };
}

reset();

function emit(type, resourceID) {
  eventSeq += 1;
  const event = JSON.stringify({
    id: eventSeq,
    type,
    resource_id: resourceID,
  });
  for (const client of sseClients) {
    try {
      client.write(`id: ${eventSeq}\ndata: ${event}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function now() {
  return new Date().toISOString();
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json",
    "x-request-id": "mock-request",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function fail(res, status, code) {
  send(res, status, {
    code,
    message: "Mock request rejected.",
    request_id: "mock-request",
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function summary() {
  return {
    mode: "mock",
    role: organization.role,
    wallet: state.wallet,
    counts: {
      numbers: state.numbers.filter((number) => number.status === "active")
        .length,
      unread_messages: 0,
      completed_orders: state.orders.filter(
        (order) => order.status === "completed",
      ).length,
    },
  };
}

function paginate(items, url) {
  const requestedLimit = Number(url.searchParams.get("limit") ?? 20);
  const requestedOffset = Number(url.searchParams.get("offset") ?? 0);
  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 20;
  const offset =
    Number.isInteger(requestedOffset) && requestedOffset >= 0
      ? requestedOffset
      : 0;
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
    mode: "mock",
  };
}

function filteredCatalog(url) {
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const country = url.searchParams.get("country") ?? "";
  const type = url.searchParams.get("number_type") ?? "";
  const capability = url.searchParams.get("capability") ?? "";
  const useCase = url.searchParams.get("use_case") ?? "";

  return catalog
    .filter(
      (item) =>
        (!country || item.country_code === country) &&
        (!type || item.number_type === type) &&
        (!capability || item.capabilities.includes(capability)) &&
        (!useCase || item.use_cases.includes(useCase)) &&
        (!q ||
          [
            item.e164,
            item.country_name,
            item.region,
            item.provider,
            ...item.use_cases,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    )
    .sort((left, right) => left.e164.localeCompare(right.e164));
}

function createPayment(amountMinor) {
  state.paymentSeq += 1;
  const createdAt = now();
  const payment = {
    id: `payment-${state.paymentSeq}`,
    reference: `PAY-MOCK-${state.paymentSeq}`,
    amount_minor: amountMinor,
    currency: "USD",
    provider: "mock",
    status: "pending",
    created_at: createdAt,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
  state.payments.unshift(payment);
  return payment;
}

function findPayment(resourceID) {
  return state.payments.find(
    (payment) => payment.id === resourceID || payment.reference === resourceID,
  );
}

async function route(req, res) {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  const segments = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  if (url.pathname === "/__reset" && req.method === "POST") {
    reset();
    send(res, 200, { reset: true });
    return;
  }

  if (url.pathname === "/__credit" && req.method === "POST") {
    const body = await readBody(req);
    const amountMinor = Number(body.amount_minor);
    if (!Number.isInteger(amountMinor) || amountMinor < 1) {
      fail(res, 400, "validation_failed");
      return;
    }
    state.wallet.available_minor += amountMinor;
    state.ledger.unshift({
      id: `ledger-${++state.ledgerSeq}`,
      reference_id: "mock-credit",
      kind: "mock_credit",
      available_delta: amountMinor,
      reserved_delta: 0,
      available_after: state.wallet.available_minor,
      reserved_after: state.wallet.reserved_minor,
      created_at: now(),
    });
    emit("wallet.updated", "mock-credit");
    send(res, 200, { wallet: state.wallet });
    return;
  }

  if (url.pathname === "/__fail-next-order" && req.method === "POST") {
    state.failNextOrder = true;
    send(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/__sse-count" && req.method === "GET") {
    send(res, 200, { count: sseClients.size });
    return;
  }

  if (url.pathname === "/v1/openapi.yaml") {
    res.writeHead(200, { "content-type": "application/yaml" });
    res.end(
      'openapi: 3.0.3\ninfo: {title: Mock API, version: 0.0.0}\npaths:\n  "/v1/organizations/{organization_id}/summary": {}\n',
    );
    return;
  }

  if (url.pathname === "/v1/auth/csrf" && req.method === "GET") {
    send(res, 200, { token: "mock-csrf" });
    return;
  }

  if (url.pathname === "/v1/me" && req.method === "GET") {
    send(res, 200, identity);
    return;
  }

  if (url.pathname === "/v1/catalog/numbers" && req.method === "GET") {
    send(res, 200, paginate(filteredCatalog(url), url));
    return;
  }

  if (
    segments.length === 4 &&
    segments[0] === "v1" &&
    segments[1] === "organizations" &&
    segments[3] === "summary" &&
    req.method === "GET"
  ) {
    send(res, 200, summary());
    return;
  }

  if (
    segments.length === 4 &&
    segments[0] === "v1" &&
    segments[1] === "organizations" &&
    segments[3] === "numbers" &&
    req.method === "GET"
  ) {
    const status = url.searchParams.get("status") ?? "";
    const items = state.numbers.filter(
      (number) => !status || number.status === status,
    );
    send(res, 200, paginate(items, url));
    return;
  }

  if (
    segments.length === 4 &&
    segments[0] === "v1" &&
    segments[1] === "organizations" &&
    segments[3] === "orders" &&
    req.method === "GET"
  ) {
    send(res, 200, paginate(state.orders, url));
    return;
  }

  if (
    segments.length === 5 &&
    segments[0] === "v1" &&
    segments[1] === "organizations" &&
    segments[3] === "billing" &&
    segments[4] === "ledger" &&
    req.method === "GET"
  ) {
    send(res, 200, paginate(state.ledger, url));
    return;
  }

  if (
    segments.length === 5 &&
    segments[0] === "v1" &&
    segments[1] === "organizations" &&
    segments[3] === "billing" &&
    segments[4] === "payments" &&
    req.method === "GET"
  ) {
    send(res, 200, paginate(state.payments, url));
    return;
  }

  if (
    segments.length === 6 &&
    segments[0] === "v1" &&
    segments[1] === "organizations" &&
    segments[3] === "billing" &&
    segments[4] === "payments" &&
    req.method === "GET"
  ) {
    const payment = findPayment(segments[5]);
    if (!payment) {
      fail(res, 404, "not_found");
      return;
    }
    send(res, 200, payment);
    return;
  }

  if (
    segments.length === 7 &&
    segments[0] === "v1" &&
    segments[1] === "organizations" &&
    segments[3] === "billing" &&
    segments[4] === "payments" &&
    segments[6] === "confirm" &&
    req.method === "POST"
  ) {
    const payment = findPayment(segments[5]);
    if (!payment) {
      fail(res, 404, "not_found");
      return;
    }
    if (payment.status === "succeeded") {
      send(res, 200, {
        id: payment.id,
        status: "succeeded",
        payment,
        wallet: state.wallet,
      });
      return;
    }
    if (payment.status !== "pending") {
      fail(res, 409, "validation_failed");
      return;
    }
    payment.status = "succeeded";
    state.wallet.available_minor += payment.amount_minor;
    state.ledger.unshift({
      id: `ledger-${++state.ledgerSeq}`,
      reference_id: payment.id,
      kind: "payment_credit",
      available_delta: payment.amount_minor,
      reserved_delta: 0,
      available_after: state.wallet.available_minor,
      reserved_after: state.wallet.reserved_minor,
      created_at: now(),
    });
    emit("payment.updated", payment.id);
    emit("wallet.updated", payment.id);
    send(res, 200, {
      id: payment.id,
      status: "succeeded",
      payment,
      wallet: state.wallet,
    });
    return;
  }

  if (
    segments.length === 7 &&
    segments[0] === "v1" &&
    segments[1] === "organizations" &&
    segments[3] === "billing" &&
    segments[4] === "payments" &&
    segments[6] === "cancel" &&
    req.method === "POST"
  ) {
    const payment = findPayment(segments[5]);
    if (!payment) {
      fail(res, 404, "not_found");
      return;
    }
    if (payment.status !== "pending") {
      fail(res, 409, "validation_failed");
      return;
    }
    payment.status = "canceled";
    emit("payment.updated", payment.id);
    send(res, 200, {
      id: payment.id,
      status: "canceled",
      payment,
      wallet: state.wallet,
    });
    return;
  }

  if (
    segments.length === 5 &&
    segments[0] === "v1" &&
    segments[1] === "organizations" &&
    segments[3] === "billing" &&
    segments[4] === "payments" &&
    req.method === "POST"
  ) {
    const body = await readBody(req);
    const amountMinor = Number(body.amount_minor);
    if (!Number.isInteger(amountMinor) || amountMinor < 1) {
      fail(res, 400, "validation_failed");
      return;
    }
    const payment = createPayment(amountMinor);
    send(res, 200, {
      id: payment.id,
      status: "pending",
      payment,
      wallet: state.wallet,
    });
    return;
  }

  if (
    segments.length === 4 &&
    segments[0] === "v1" &&
    segments[1] === "organizations" &&
    segments[3] === "orders" &&
    req.method === "POST"
  ) {
    const body = await readBody(req);
    const item = catalog.find((candidate) => candidate.id === body.catalog_item_id);
    if (!item) {
      fail(res, 404, "not_found");
      return;
    }
    if (!body.confirmed_terms) {
      fail(res, 400, "terms_required");
      return;
    }
    const option = item.rental_options.find(
      (candidate) => candidate.days === body.rental_days,
    );
    if (!option) {
      fail(res, 400, "invalid_rental_period");
      return;
    }
    if (state.failNextOrder) {
      state.failNextOrder = false;
      fail(res, 409, "inventory_unavailable");
      return;
    }
    if (state.wallet.available_minor < option.amount_minor) {
      fail(res, 409, "insufficient_balance");
      return;
    }

    state.orderSeq += 1;
    state.wallet.available_minor -= option.amount_minor;
    const createdAt = now();
    const orderID = `order-${state.orderSeq}`;
    const order = {
      id: orderID,
      e164: item.e164,
      status: "completed",
      purpose: body.purpose ?? "customer_support",
      amount_minor: option.amount_minor,
      rental_days: option.days,
      failure_code: "",
      created_at: createdAt,
    };
    const number = {
      id: `lease-${state.orderSeq}`,
      e164: item.e164,
      status: "active",
      country_code: item.country_code,
      number_type: item.number_type,
      capabilities: item.capabilities,
      use_cases: item.use_cases,
      monthly_fee_minor: item.monthly_fee_minor,
      rental_days: option.days,
      amount_minor: option.amount_minor,
      started_at: createdAt,
      expires_at: new Date(
        Date.now() + option.days * 24 * 60 * 60_000,
      ).toISOString(),
      order_id: orderID,
    };
    state.orders.unshift(order);
    state.numbers.unshift(number);
    state.ledger.unshift({
      id: `ledger-${++state.ledgerSeq}`,
      reference_id: orderID,
      kind: "settle",
      available_delta: -option.amount_minor,
      reserved_delta: 0,
      available_after: state.wallet.available_minor,
      reserved_after: state.wallet.reserved_minor,
      created_at: createdAt,
    });
    emit("order.updated", orderID);
    emit("number.updated", number.id);
    emit("wallet.updated", orderID);
    send(res, 200, {
      id: orderID,
      status: "completed",
      order,
      number,
      wallet: state.wallet,
    });
    return;
  }

  if (
    segments.length === 6 &&
    segments[0] === "v1" &&
    segments[1] === "organizations" &&
    segments[3] === "leases" &&
    segments[5] === "release" &&
    req.method === "POST"
  ) {
    const number = state.numbers.find((candidate) => candidate.id === segments[4]);
    if (!number) {
      fail(res, 404, "not_found");
      return;
    }
    number.status = "released";
    emit("number.updated", number.id);
    send(res, 200, { id: number.id, status: "released" });
    return;
  }

  if (
    segments.length === 5 &&
    segments[0] === "v1" &&
    segments[1] === "organizations" &&
    segments[3] === "events" &&
    segments[4] === "stream" &&
    req.method === "GET"
  ) {
    res.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/event-stream",
      "x-accel-buffering": "no",
    });
    sseClients.add(res);
    res.write("retry: 2000\n\n");
    const timer = setInterval(() => res.write(": keepalive\n\n"), 5000);
    req.on("close", () => {
      sseClients.delete(res);
      clearInterval(timer);
    });
    return;
  }

  fail(res, 404, "not_found");
}

const server = createServer((req, res) => {
  void route(req, res).catch(() => {
    if (!res.headersSent) fail(res, 500, "internal_error");
    else res.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Mock API listening on http://${HOST}:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
