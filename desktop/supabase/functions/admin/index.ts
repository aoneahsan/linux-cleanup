/**
 * POST /admin { action, ... }  (platform role admin or superadmin, read from user_roles)
 * Lists return { ok, items, next_cursor } (default 20, max 50). Every write passes a
 * `reason` and is audited by its SQL function in the same transaction as the change.
 * The five plan-administration capabilities: plans.upsert (create a plan, edit its
 * limits and prices), users.set_plan, users.override_limits, grants.list (provenance).
 * Update flow layer 2: releases.list (newest first, max 20) and releases.publish (a
 * release record is never edited; a newer row corrects it; the SQL audits the publish).
 */
import { requireAdmin, requireCaller } from '../_shared/auth.ts';
import { ok } from '../_shared/envelope.ts';
import { serve } from '../_shared/http.ts';
import { rpc } from '../_shared/rpc.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { readBody, z } from '../_shared/validate.ts';

const reason = z.string().trim().min(1).max(500);
const limit = z.number().int().min(1).max(50).optional();
const cursor = z.string().max(80).optional();
const planId = z.string().regex(/^[a-z][a-z0-9_]{1,31}$/);
const runs = z.number().int().min(0).max(100000);
const at = z.iso.datetime({ offset: true });
const semver = z.string().regex(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/, 'x.y.z, digits only');
const platform = z.enum(['desktop', 'web', 'docs']);
const channel = z.enum(['production', 'test']);

const PlanFields = z.object({
  id: planId,
  name: z.string().trim().min(1).max(40).optional(),
  description: z.string().max(300).optional(),
  rank: z.number().int().min(0).max(1000).optional(),
  is_active: z.boolean().optional(),
  price_month_cents: z.number().int().min(0).max(1000000).optional(),
  price_year_cents: z.number().int().min(0).max(10000000).optional(),
  per_seat: z.boolean().optional(),
  min_seats: z.number().int().min(1).max(1000).optional(),
  real_runs_unlimited: z.boolean().optional(),
  device_real_runs_per_month: runs.nullable().optional(),
  account_extra_real_runs_per_month: runs.nullable().optional(),
  max_synced_machines: z.number().int().min(0).max(1000).optional(),
  history_sync: z.boolean().optional(),
  schedules: z.boolean().optional(),
  exports: z.boolean().optional(),
  fleet_reports: z.boolean().optional(),
}).strict();

const Override = z.object({
  real_runs_unlimited: z.boolean().optional(),
  device_real_runs_per_month: runs.optional(),
  account_extra_real_runs_per_month: runs.optional(),
}).strict();

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('stats') }).strict(),
  z.object({ action: z.literal('users.list'), query: z.string().max(254).optional(), cursor, limit }).strict(),
  z.object({ action: z.literal('users.view'), user_id: z.uuid() }).strict(),
  z.object({
    action: z.literal('users.set_plan'), user_id: z.uuid(), plan_id: planId, ends_at: at.optional(), reason,
  }).strict().refine((b) => b.plan_id === 'free' || !!b.ends_at, 'ends_at is required unless the plan is free'),
  z.object({ action: z.literal('users.override_limits'), user_id: z.uuid(), overrides: Override.nullable(), reason }).strict(),
  z.object({ action: z.literal('plans.list') }).strict(),
  z.object({ action: z.literal('plans.upsert'), plan: PlanFields, reason }).strict(),
  z.object({
    action: z.literal('grants.list'), user_id: z.uuid().optional(), active_only: z.boolean().optional(), cursor, limit,
  }).strict(),
  z.object({
    action: z.literal('grants.create'), user_id: z.uuid(), plan_id: planId, starts_at: at.optional(), ends_at: at, reason,
  }).strict(),
  z.object({ action: z.literal('grants.revoke'), grant_id: z.uuid(), reason }).strict(),
  z.object({ action: z.literal('config.get') }).strict(),
  z.object({
    action: z.literal('config.set'), key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
    value: z.union([z.number(), z.boolean(), z.string().max(200)]), reason,
  }).strict(),
  z.object({
    action: z.literal('releases.list'), platform: platform.optional(), channel: channel.optional(),
    cursor: z.string().max(80).optional(), limit: z.number().int().min(1).max(20).optional(),
  }).strict(),
  z.object({
    action: z.literal('releases.publish'), platform, channel, version: semver,
    severity: z.enum(['urgent', 'normal']), reason: z.string().trim().min(1).max(280),
    min_native_version: semver.optional(),
  }).strict(),
  z.object({
    action: z.literal('audit.list'), filter_action: z.string().regex(/^[a-z_]+\.[a-z_]+$/).optional(),
    cursor: z.string().regex(/^[0-9]{1,18}$/).optional(), limit,
  }).strict(),
]);

type Shape = Record<string, unknown>;

serve('admin', ['POST'], async (req) => {
  const body = await readBody(req, Body); // 1 shape
  const caller = await requireCaller(req); // 2 authentication
  await requireAdmin(caller); // 3 authorization (re-checked inside every SQL function)
  const db = serviceClient();
  const actor = caller.id;

  switch (body.action) {
    case 'stats':
      return ok(await rpc<Shape>(db, 'admin_stats', { p_actor: actor }));
    case 'users.list':
      return ok(await rpc<Shape>(db, 'admin_users_list', {
        p_actor: actor, p_query: body.query ?? null, p_cursor: body.cursor ?? null, p_limit: body.limit ?? 20,
      }));
    case 'users.view':
      return ok(await rpc<Shape>(db, 'admin_user_view', { p_actor: actor, p_user: body.user_id }));
    case 'users.set_plan':
      return ok(await rpc<Shape>(db, 'admin_set_plan', {
        p_actor: actor, p_user: body.user_id, p_plan: body.plan_id, p_ends: body.ends_at ?? null, p_reason: body.reason,
      }));
    case 'users.override_limits':
      return ok(await rpc<Shape>(db, 'admin_override_limits', {
        p_actor: actor, p_user: body.user_id, p_override: body.overrides, p_reason: body.reason,
      }));
    case 'plans.list':
      return ok(await rpc<Shape>(db, 'admin_plans_list', { p_actor: actor }));
    case 'plans.upsert':
      return ok({ plan: await rpc<Shape>(db, 'admin_plan_upsert', { p_actor: actor, p_plan: body.plan, p_reason: body.reason }) });
    case 'grants.list':
      return ok(await rpc<Shape>(db, 'admin_grants_list', {
        p_actor: actor, p_user: body.user_id ?? null, p_active_only: body.active_only ?? false,
        p_cursor: body.cursor ?? null, p_limit: body.limit ?? 20,
      }));
    case 'grants.create':
      return ok(await rpc<Shape>(db, 'admin_grant_create', {
        p_actor: actor, p_user: body.user_id, p_plan: body.plan_id, p_starts: body.starts_at ?? null,
        p_ends: body.ends_at, p_reason: body.reason,
      }));
    case 'grants.revoke':
      return ok(await rpc<Shape>(db, 'admin_grant_revoke', { p_actor: actor, p_grant: body.grant_id, p_reason: body.reason }));
    case 'config.get':
      return ok(await rpc<Shape>(db, 'admin_config_get', { p_actor: actor }));
    case 'config.set':
      return ok(await rpc<Shape>(db, 'admin_config_set', {
        p_actor: actor, p_key: body.key, p_value: body.value, p_reason: body.reason,
      }));
    case 'releases.list':
      return ok(await rpc<Shape>(db, 'list_app_releases', {
        p_actor: actor, p_platform: body.platform ?? null, p_channel: body.channel ?? null,
        p_cursor: body.cursor ?? null, p_limit: body.limit ?? 20,
      }));
    case 'releases.publish':
      return ok(await rpc<Shape>(db, 'publish_app_release', {
        p_actor: actor, p_platform: body.platform, p_channel: body.channel, p_version: body.version,
        p_severity: body.severity, p_reason: body.reason, p_min_native_version: body.min_native_version ?? null,
      }));
    case 'audit.list':
      return ok(await rpc<Shape>(db, 'admin_audit_list', {
        p_actor: actor, p_action: body.filter_action ?? null,
        p_cursor: body.cursor ? Number(body.cursor) : null, p_limit: body.limit ?? 20,
      }));
  }
});
