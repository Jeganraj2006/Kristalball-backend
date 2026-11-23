CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "ScopeMode" AS ENUM ('LOCATION', 'ORGANIZATION');

CREATE TABLE "organizations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "locations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "parent_id" UUID REFERENCES "locations"("id"),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "locations_organization_id_code_key" UNIQUE ("organization_id", "code")
);

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "session_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_organization_id_email_key" UNIQUE ("organization_id", "email")
);

CREATE TABLE "roles" ("id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "code" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL);
CREATE TABLE "permissions" ("id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "code" TEXT NOT NULL UNIQUE);
CREATE TABLE "user_roles" ("user_id" UUID NOT NULL REFERENCES "users"("id"), "role_id" UUID NOT NULL REFERENCES "roles"("id"), PRIMARY KEY ("user_id", "role_id"));
CREATE TABLE "role_permissions" ("role_id" UUID NOT NULL REFERENCES "roles"("id"), "permission_id" UUID NOT NULL REFERENCES "permissions"("id"), PRIMARY KEY ("role_id", "permission_id"));
CREATE TABLE "location_grants" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL REFERENCES "users"("id"), "location_id" UUID REFERENCES "locations"("id"), "scope_mode" "ScopeMode" NOT NULL DEFAULT 'LOCATION', "inherit_descendants" BOOLEAN NOT NULL DEFAULT FALSE, "valid_from" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "valid_until" TIMESTAMPTZ
);
CREATE TABLE "refresh_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL REFERENCES "users"("id"), "token_hash" TEXT NOT NULL UNIQUE, "expires_at" TIMESTAMPTZ NOT NULL, "revoked_at" TIMESTAMPTZ, "replaced_by" UUID, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "last_used_at" TIMESTAMPTZ
);
CREATE TABLE "security_audit_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" UUID, "actor_id" UUID REFERENCES "users"("id"), "action" TEXT NOT NULL, "outcome" TEXT NOT NULL, "correlation_id" TEXT NOT NULL, "metadata" JSONB, "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "location_grants_user_id_valid_from_valid_until_idx" ON "location_grants"("user_id", "valid_from", "valid_until");
CREATE INDEX "refresh_sessions_user_id_expires_at_idx" ON "refresh_sessions"("user_id", "expires_at");
CREATE INDEX "security_audit_events_organization_id_occurred_at_idx" ON "security_audit_events"("organization_id", "occurred_at");

CREATE FUNCTION prevent_security_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'security_audit_events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_audit_events_append_only
  BEFORE UPDATE OR DELETE ON "security_audit_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_security_audit_event_mutation();
