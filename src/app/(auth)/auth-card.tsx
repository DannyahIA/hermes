import { Card } from '@/components/ui/card';

interface AuthCardProps {
  /**
   * Sheet number, drawn from the same title-block vocabulary as a technical
   * drawing's "DWG NO." field — each auth screen is a distinct sheet in the
   * same set, so the code is stable per screen, not a step in a sequence.
   */
  code: string;
  eyebrow: string;
  title: string;
  description: string;
  /**
   * "error" tints the title-block strip with the destructive color instead
   * of the neutral one — the same redlining convention `globals.css` uses
   * for expenses (marking up a drawing with a correction), applied here to
   * an auth failure.
   */
  tone?: 'default' | 'error';
  children: React.ReactNode;
}

export function AuthCard({
  code,
  eyebrow,
  title,
  description,
  tone = 'default',
  children,
}: AuthCardProps) {
  return (
    <div className="flex min-h-[calc(100vh-88px)] items-center justify-center px-6 py-16">
      <Card className="registration-frame w-full max-w-md p-0">
        <div className="border-border flex items-baseline justify-between border-b px-6 py-3">
          <span
            className={`font-display text-xs tracking-[0.2em] uppercase italic ${
              tone === 'error' ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {eyebrow}
          </span>
          <span className="dimension-figure text-muted-foreground text-xs">
            {code}
          </span>
        </div>

        <div className="p-6">
          <div className="mb-6 space-y-1.5">
            <h1 className="font-display text-2xl leading-tight font-semibold">
              {title}
            </h1>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          {children}
        </div>
      </Card>
    </div>
  );
}
