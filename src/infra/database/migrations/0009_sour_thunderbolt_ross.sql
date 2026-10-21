CREATE TABLE "chat_link_codes" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"channel" varchar(16) NOT NULL,
	"external_chat_id" varchar(64) NOT NULL,
	"username" varchar(64),
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "capture_events" ADD COLUMN "chat_message_id" varchar(32);--> statement-breakpoint
ALTER TABLE "capture_events" ADD COLUMN "chat_prompt_id" varchar(32);--> statement-breakpoint
ALTER TABLE "chat_link_codes" ADD CONSTRAINT "chat_link_codes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_links" ADD CONSTRAINT "chat_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_links_user_idx" ON "chat_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_links_chat_idx" ON "chat_links" USING btree ("channel","external_chat_id");