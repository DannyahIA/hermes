import { ArchiveCategoryButton } from '@/app/categories/archive-category-button';
import { DeleteCategoryButton } from '@/app/categories/delete-category-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const DEFAULT_COLOR = '#94a3b8';

export interface CategoryCardProps {
  id: string;
  name: string;
  description?: string;
  color?: string;
  archived: boolean;
}

export function CategoryCard({
  id,
  name,
  description,
  color,
  archived,
}: CategoryCardProps) {
  return (
    <Card className="border-border/70 bg-card/80 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="mt-1 h-6 w-6 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: color ?? DEFAULT_COLOR }}
            aria-hidden
          />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold">{name}</p>
              {archived ? <Badge variant="secondary">Arquivada</Badge> : null}
            </div>
            {description ? (
              <p className="text-muted-foreground mt-1 text-sm">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ArchiveCategoryButton categoryId={id} archived={archived} />
          <DeleteCategoryButton categoryId={id} />
        </div>
      </div>
    </Card>
  );
}
