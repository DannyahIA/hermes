CREATE TABLE "budget_limits" (
	"budget_id" uuid NOT NULL,
	"starts_on" timestamp with time zone NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	CONSTRAINT "budget_limits_budget_id_starts_on_pk" PRIMARY KEY("budget_id","starts_on")
);
--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "period_end" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "kind" varchar(8) DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_limits" ADD CONSTRAINT "budget_limits_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;