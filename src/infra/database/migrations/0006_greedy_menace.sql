ALTER TABLE "transactions" ADD COLUMN "settles_account_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_settles_account_id_accounts_id_fk" FOREIGN KEY ("settles_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Link bill payments recorded before this column existed to the card they
-- paid, where that's unambiguous: the default description, no category, a
-- cash account, and exactly one credit card on the user. Anything else is
-- left as a plain expense for the user to fix by hand.
UPDATE "transactions" AS t
SET "settles_account_id" = (
	SELECT c."id" FROM "accounts" AS c
	WHERE c."user_id" = a."user_id" AND c."type" = 'credit'
)
FROM "accounts" AS a
WHERE a."id" = t."account_id"
	AND t."type" = 'expense'
	AND t."description" = 'Pagamento de fatura'
	AND t."category_id" IS NULL
	AND t."settles_account_id" IS NULL
	AND a."type" <> 'credit'
	AND (
		SELECT count(*) FROM "accounts" AS c
		WHERE c."user_id" = a."user_id" AND c."type" = 'credit'
	) = 1;
