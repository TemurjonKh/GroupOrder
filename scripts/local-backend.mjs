// A stand-in for Supabase, for running the app locally with no account or Docker.
//
// The database part is real: your migrations, row-level security and functions run on
// embedded Postgres (PGlite) under the same client roles. The HTTP layer is a small
// imitation of Supabase Auth and PostgREST covering only what this app calls, and it
// answers 501 for anything else. There is no Realtime, so the app polls in local mode.
//
// It is for development only: it listens on localhost and is never deployed.
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const DATA = ".local";
const DEMO_PASSWORD = "demo1234";
const DEMO_USERS = [["temur", "Temur"], ["minji", "Minji"], ["jisoo", "Jisoo"], ["dana", "Dana"]];
const ACCESS_SECONDS = 3600;
const REMINDER_INTERVAL_MS = 60_000;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    Object.assign(this, { status, code });
  }
}

// ------------------------------------------------------------------ database setup

async function openDatabase() {
  mkdirSync(DATA, { recursive: true });
  const fresh = !existsSync(join(DATA, "db"));
  const db = new PGlite(join(DATA, "db"));
  if (fresh) {
    await db.exec(readFileSync("supabase/local/bootstrap.sql", "utf8"));
    await db.exec("create table auth.local_migrations (name text primary key)");
  }
  // pg_cron does not exist here; startLocalBackend runs the reminder job on a timer instead.
  const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql") && !f.endsWith("_cron.sql")).sort();
  for (const file of files) {
    const { rows } = await db.query("select 1 from auth.local_migrations where name = $1", [file]);
    if (rows.length) continue;
    await db.exec(readFileSync(join("supabase/migrations", file), "utf8"));
    await db.query("insert into auth.local_migrations values ($1)", [file]);
    console.log(`local backend: applied ${file}`);
  }
  if (fresh) {
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    for (const [i, [handle, name]] of DEMO_USERS.entries()) {
      await db.query(
        "insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values ($1, $2, $3, $4)",
        [`00000000-0000-0000-0000-00000000000${i + 1}`, `${handle}@demo.test`, { name }, hashPassword(DEMO_PASSWORD)],
      );
    }
    await db.exec(readFileSync("supabase/local/demo.sql", "utf8"));
    console.log("local backend: created sample restaurants and demo accounts");
  }
  return db;
}

async function readSchema(db) {
  const { rows: relations } = await db.query(`
    select c.conrelid::regclass::text as "from", a.attname as "column", c.confrelid::regclass::text as "to", b.attname as "target"
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_attribute b on b.attrelid = c.confrelid and b.attnum = c.confkey[1]
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace and c.confrelid::regclass::text not like 'auth.%'`);
  const { rows: columns } = await db.query(`
    select c.relname as "table", a.attname as "column", format_type(a.atttypid, a.atttypmod) as "type"
    from pg_attribute a join pg_class c on c.oid = a.attrelid
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped`);
  const { rows: functions } = await db.query(`
    select p.proname as "name", p.proretset as "returnsSet", format_type(p.prorettype, null) as "returns",
      p.proargnames[1:p.pronargs] as "argNames",
      (select array_agg(format_type(t, null) order by o) from unnest(p.proargtypes) with ordinality as x(t, o)) as "argTypes"
    from pg_proc p where p.pronamespace = 'public'::regnamespace`);
  const clean = (name) => name.replace(/^public\./, "");
  return {
    relations: relations.map((r) => ({ ...r, from: clean(r.from), to: clean(r.to) })),
    columnType: new Map(columns.map((c) => [`${c.table}.${c.column}`, c.type])),
    tables: new Set(columns.map((c) => c.table)),
    functions: new Map(functions.map((f) => [f.name, f])),
  };
}

// ------------------------------------------------------------------ tokens and passwords

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

function checkPassword(password, stored) {
  const [salt, hash] = (stored ?? "").split(":");
  if (!salt || !hash) return false;
  return timingSafeEqual(scryptSync(password, salt, 32), Buffer.from(hash, "hex"));
}

function makeTokens(secret) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const sign = (body) => createHmac("sha256", secret).update(body).digest("base64url");
  return {
    create(claims, seconds) {
      const iat = Math.floor(Date.now() / 1000);
      const body = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ ...claims, iat, exp: iat + seconds })}`;
      return `${body}.${sign(body)}`;
    },
    verify(token, type) {
      const [head, payload, signature] = String(token ?? "").split(".");
      if (!signature || sign(`${head}.${payload}`) !== signature) return null;
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
      return claims.typ === type && claims.exp > Date.now() / 1000 ? claims : null;
    },
  };
}

// ------------------------------------------------------------------ auth endpoints

function authRoutes(db, tokens) {
  const publicUser = (u) => ({
    id: u.id, aud: "authenticated", role: "authenticated", email: u.email,
    user_metadata: u.raw_user_meta_data, app_metadata: { provider: "email" },
    email_confirmed_at: u.created_at, created_at: u.created_at, updated_at: u.created_at,
    identities: [{ id: u.id, provider: "email" }],
  });
  const session = (u) => {
    const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_SECONDS;
    return {
      access_token: tokens.create({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", typ: "access", session_id: randomUUID() }, ACCESS_SECONDS),
      refresh_token: tokens.create({ sub: u.id, typ: "refresh" }, 30 * 86_400),
      token_type: "bearer", expires_in: ACCESS_SECONDS, expires_at: expiresAt, user: publicUser(u),
    };
  };
  const byId = async (id) => (await db.query("select * from auth.users where id = $1", [id])).rows[0];
  const byEmail = async (email) => (await db.query("select * from auth.users where email = $1", [email])).rows[0];
  const emailOf = (body) => String(body.email ?? "").trim().toLowerCase();

  return async function route(method, path, query, body, bearer) {
    if (method === "POST" && path === "/signup") {
      const email = emailOf(body);
      if (!/^\S+@\S+$/.test(email)) throw new HttpError(422, "email_address_invalid", "Invalid email");
      if (String(body.password ?? "").length < 6) throw new HttpError(422, "weak_password", "Password too short");
      if (await byEmail(email)) throw new HttpError(422, "user_already_exists", "User already registered");
      const { rows } = await db.query(
        "insert into auth.users (email, raw_user_meta_data, encrypted_password) values ($1, $2, $3) returning *",
        [email, body.data ?? {}, hashPassword(body.password)],
      );
      return session(rows[0]);
    }
    if (method === "POST" && path === "/token" && query.get("grant_type") === "password") {
      const user = await byEmail(emailOf(body));
      if (!user || !checkPassword(String(body.password ?? ""), user.encrypted_password)) {
        throw new HttpError(400, "invalid_credentials", "Invalid login credentials");
      }
      return session(user);
    }
    if (method === "POST" && path === "/token" && query.get("grant_type") === "refresh_token") {
      const claims = tokens.verify(body.refresh_token, "refresh");
      const user = claims && await byId(claims.sub);
      if (!user) throw new HttpError(400, "refresh_token_not_found", "Invalid refresh token");
      return session(user);
    }
    if (method === "GET" && path === "/user") {
      const claims = tokens.verify(bearer, "access");
      const user = claims && await byId(claims.sub);
      if (!user) throw new HttpError(401, "bad_jwt", "Invalid token");
      return publicUser(user);
    }
    if (method === "POST" && path === "/logout") return null;
    throw new HttpError(501, "not_supported", `Local backend does not support auth ${method} ${path}`);
  };
}

// ------------------------------------------------------------------ PostgREST subset

const ident = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new HttpError(400, "bad_identifier", `Bad name: ${name}`);
  return `"${name}"`;
};

/** "id, menu_item:menu_items!inner(*, r:restaurants(name))" into a tree. */
function parseSelect(text) {
  const parts = [];
  let depth = 0, current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(current); current = ""; } else current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((raw) => {
    const part = raw.trim();
    const embed = part.match(/^(?:([a-z_0-9]+):)?([a-z_0-9]+)(!inner)?\((.*)\)$/s);
    if (embed) {
      return { alias: embed[1] ?? embed[2], table: embed[2], inner: Boolean(embed[3]), children: parseSelect(embed[4]) };
    }
    return { column: part };
  });
}

/** Turns the URL's filters and options into SQL for one select request. */
function buildQuery(schema, table, url) {
  const params = [];
  const param = (value) => { params.push(value); return `($${params.length}::text)`; };

  const filters = new Map(); // "" for the main table, else the embed path
  for (const [key, value] of url.searchParams) {
    if (["select", "order", "limit", "columns"].includes(key)) continue;
    const dot = key.lastIndexOf(".");
    const path = dot < 0 ? "" : key.slice(0, dot);
    const column = key.slice(dot + 1);
    const split = value.indexOf(".");
    const [op, operand] = [value.slice(0, split), value.slice(split + 1)];
    if (!filters.has(path)) filters.set(path, []);
    filters.get(path).push({ column, op, operand });
  }
  const where = (path, alias) => (filters.get(path) ?? []).map(({ column, op, operand }) => {
    const col = `${alias}.${ident(column)}`;
    if (op === "eq") return `${col}::text = ${param(operand)}`;
    if (op === "neq") return `${col}::text <> ${param(operand)}`;
    if (op === "is" && operand === "null") return `${col} is null`;
    if (op === "in") {
      const items = operand.replace(/^\(|\)$/g, "").split(",").filter(Boolean).map((v) => v.replace(/^"|"$/g, ""));
      return `${col}::text = any(${param(`{${items.map((v) => `"${v}"`).join(",")}}`)}::text[])`;
    }
    throw new HttpError(501, "not_supported", `Local backend does not support filter ${op}`);
  });

  let aliasCount = 0;
  function selectList(parent, alias, nodes, path, innerConditions) {
    return nodes.map((node) => {
      if (node.column === "*") return `${alias}.*`;
      if (node.column) return `${alias}.${ident(node.column)}`;
      if (!schema.tables.has(node.table)) throw new HttpError(404, "PGRST200", `Unknown table ${node.table}`);
      const childPath = path ? `${path}.${node.alias}` : node.alias;
      const child = `t${++aliasCount}`;
      const toOne = schema.relations.filter((r) => r.from === parent && r.to === node.table);
      const toMany = schema.relations.filter((r) => r.from === node.table && r.to === parent);
      if (toOne.length + toMany.length !== 1) {
        throw new HttpError(501, "not_supported", `Local backend needs exactly one relation ${parent} -> ${node.table}`);
      }
      const join = toOne.length
        ? `${child}.${ident(toOne[0].target)} = ${alias}.${ident(toOne[0].column)}`
        : `${child}.${ident(toMany[0].column)} = ${alias}.${ident(toMany[0].target)}`;
      const conditions = [join, ...where(childPath, child)].join(" and ");
      const from = `from public.${ident(node.table)} ${child} where ${conditions}`;
      if (node.inner) innerConditions.push(`exists (select 1 ${from})`);
      const name = ident(node.alias);
      if (node.children.length === 1 && node.children[0].column === "count") {
        return `json_build_array(json_build_object('count', (select count(*) ${from}))) as ${name}`;
      }
      const nested = [];
      const columns = selectList(node.table, child, node.children, childPath, nested);
      const inner = `select ${columns.join(", ")} ${from}${nested.map((n) => ` and ${n}`).join("")}`;
      return toOne.length
        ? `(select to_json(s) from (${inner}) s) as ${name}`
        : `coalesce((select json_agg(s) from (${inner}) s), '[]'::json) as ${name}`;
    });
  }

  const conditions = [];
  const columns = selectList(table, "t0", parseSelect(url.searchParams.get("select") ?? "*"), "", conditions);
  conditions.push(...where("", "t0"));
  const order = (url.searchParams.get("order") ?? "").split(",").filter(Boolean).map((term) => {
    const [column, direction] = term.split(".");
    return `t0.${ident(column)} ${direction === "desc" ? "desc" : "asc"}`;
  });
  const limit = Number(url.searchParams.get("limit"));
  const rowsSql = [
    `select ${columns.join(", ")} from public.${ident(table)} t0`,
    conditions.length ? `where ${conditions.join(" and ")}` : "",
    order.length ? `order by ${order.join(", ")}` : "",
    limit > 0 ? `limit ${Math.floor(limit)}` : "",
  ].join(" ");
  return { rowsSql, params, whereOnly: () => conditions.join(" and ") };
}

/** A JSON value as text Postgres can cast to the target type. */
function toPgText(value, type) {
  if (value === null || value === undefined) return null;
  if (type.endsWith("[]")) return `{${value.map((v) => `"${v}"`).join(",")}}`;
  if (type === "jsonb" || type === "json") return JSON.stringify(value);
  return String(value);
}

function restRoutes(db, schema, tokens) {
  async function asCaller(bearer, work) {
    const claims = tokens.verify(bearer, "access");
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [claims?.sub ?? ""]);
      await tx.exec(`set local role ${claims ? "authenticated" : "anon"}`);
      return work(tx);
    });
  }

  return async function route(method, path, url, body, bearer, headers) {
    const rpc = path.match(/^\/rpc\/([a-z_0-9]+)$/);
    if (rpc && method === "POST") {
      const fn = schema.functions.get(rpc[1]);
      if (!fn) throw new HttpError(404, "PGRST202", `Unknown function ${rpc[1]}`);
      const params = [];
      const args = Object.entries(body ?? {}).map(([name, value]) => {
        const index = (fn.argNames ?? []).indexOf(name);
        if (index < 0) throw new HttpError(404, "PGRST202", `Unknown argument ${name}`);
        params.push(toPgText(value, fn.argTypes[index]));
        return `${ident(name)} => ($${params.length}::text)::${fn.argTypes[index]}`;
      });
      const call = `public.${ident(fn.name)}(${args.join(", ")})`;
      const sql = fn.returnsSet
        ? `select coalesce(json_agg(r), '[]'::json) as data from ${call} r`
        : `select to_json(${call}) as data`;
      const { rows } = await asCaller(bearer, (tx) => tx.query(sql, params));
      return fn.returns === "void" ? null : rows[0].data;
    }

    const table = path.slice(1);
    if (!schema.tables.has(table)) throw new HttpError(404, "PGRST205", `Unknown table ${table}`);

    if (method === "GET") {
      const { rowsSql, params } = buildQuery(schema, table, url);
      const { rows } = await asCaller(bearer, (tx) =>
        tx.query(`select coalesce(json_agg(r), '[]'::json) as data from (${rowsSql}) r`, params));
      if (!(headers.accept ?? "").includes("vnd.pgrst.object")) return rows[0].data;
      if (rows[0].data.length !== 1) throw new HttpError(406, "PGRST116", "Expected one row");
      return rows[0].data[0];
    }

    if (method === "PATCH") {
      const selectUrl = new URL(url);
      selectUrl.searchParams.delete("select");
      const { params, whereOnly } = buildQuery(schema, table, selectUrl);
      const sets = Object.entries(body ?? {}).map(([column, value]) => {
        const type = schema.columnType.get(`${table}.${column}`);
        if (!type) throw new HttpError(400, "PGRST204", `Unknown column ${column}`);
        params.push(toPgText(value, type));
        return `${ident(column)} = ($${params.length}::text)::${type}`;
      });
      const condition = whereOnly();
      const wanted = (url.searchParams.get("select") ?? "*").split(",").map((c) => c.trim());
      const returning = wanted.includes("*") ? "*" : wanted.map(ident).join(", ");
      const sql = `with u as (update public.${ident(table)} t0 set ${sets.join(", ")}${condition ? ` where ${condition}` : ""} returning ${returning})
        select coalesce(json_agg(u), '[]'::json) as data from u`;
      const { rows } = await asCaller(bearer, (tx) => tx.query(sql, params));
      return (headers.prefer ?? "").includes("return=representation") ? rows[0].data : null;
    }

    throw new HttpError(501, "not_supported", `Local backend does not support ${method} on tables`);
  };
}

// ------------------------------------------------------------------ server

const STATUS_FOR_SQLSTATE = { 42501: 403, P0001: 400, 23505: 409, 23514: 400, "22P02": 400 };

export async function startLocalBackend(port) {
  const db = await openDatabase();
  const schema = await readSchema(db);
  const secretFile = join(DATA, "secret");
  if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString("hex"), { mode: 0o600 });
  const tokens = makeTokens(readFileSync(secretFile, "utf8"));
  const auth = authRoutes(db, tokens);
  const rest = restRoutes(db, schema, tokens);

  const reminders = setInterval(() => {
    db.query("select public.queue_reminders()").catch((e) => console.error("reminders:", e.message));
  }, REMINDER_INTERVAL_MS);
  reminders.unref();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const send = (status, value) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(value === undefined ? undefined : JSON.stringify(value));
    };
    try {
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      let result;
      if (url.pathname.startsWith("/auth/v1")) {
        result = await auth(req.method, url.pathname.slice("/auth/v1".length), url.searchParams, body ?? {}, bearer);
      } else if (url.pathname.startsWith("/rest/v1")) {
        result = await rest(req.method, url.pathname.slice("/rest/v1".length), url, body, bearer, req.headers);
      } else {
        throw new HttpError(404, "not_found", "Not found");
      }
      if (result === null) send(204);
      else send(200, result);
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 501) console.error(`local backend: ${error.message}`);
        const isAuth = url.pathname.startsWith("/auth/");
        return send(error.status, isAuth
          ? { code: error.status, error_code: error.code, msg: error.message }
          : { code: error.code, message: error.message, details: null, hint: null });
      }
      if (error.code) {
        return send(STATUS_FOR_SQLSTATE[error.code] ?? 400, { code: error.code, message: error.message, details: null, hint: null });
      }
      console.error(error);
      send(500, { code: "local_backend_error", message: "Local backend error" });
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${port}`, db, server };
}
