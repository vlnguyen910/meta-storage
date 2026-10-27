CREATE TABLE "login_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id" varchar(255) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device" varchar(120),
	"operating_system" varchar(120),
	"browser" varchar(120),
	"model" varchar(120),
	CONSTRAINT "login_history_sessionId_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "user_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"facility_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_history_time_idx" ON "login_history" USING btree ("occurred_at","id");--> statement-breakpoint
CREATE INDEX "login_history_user_time_idx" ON "login_history" USING btree ("user_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "user_activity_logs_time_idx" ON "user_activity_logs" USING btree ("occurred_at","id");--> statement-breakpoint
CREATE INDEX "user_activity_logs_actor_time_idx" ON "user_activity_logs" USING btree ("actor_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "user_activity_logs_entity_idx" ON "user_activity_logs" USING btree ("entity_type","entity_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "user_activity_logs_facility_time_idx" ON "user_activity_logs" USING btree ("facility_id","occurred_at","id");