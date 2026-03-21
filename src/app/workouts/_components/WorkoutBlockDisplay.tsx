import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BlockInput } from "../../../../convex/tonal/transforms";

interface MovementDetail {
  movementId: string;
  name: string;
  muscleGroups: string[];
  sets: number;
  reps?: number;
  duration?: number;
  phase: "warmup" | "main" | "cooldown";
  thumbnailMediaUrl?: string;
  accessory?: string;
}

interface WorkoutBlockDisplayProps {
  blocks: BlockInput[];
  movementDetails: MovementDetail[];
}

function formatSetRep(sets: number, reps?: number, duration?: number): string {
  if (duration != null) return `${sets} x ${duration}s`;
  if (reps != null) return `${sets} x ${reps}`;
  return `${sets} sets`;
}

export function WorkoutBlockDisplay({ blocks, movementDetails }: WorkoutBlockDisplayProps) {
  const detailMap = new Map<string, MovementDetail>(movementDetails.map((d) => [d.movementId, d]));

  return (
    <div className="space-y-4">
      {blocks.map((block, blockIdx) => {
        const isSuperset = block.exercises.length >= 2;
        const firstDetail = detailMap.get(block.exercises[0]?.movementId ?? "");
        const blockLabel = firstDetail?.accessory ?? `Block ${blockIdx + 1}`;

        return (
          <Card key={blockIdx}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  {blockLabel}
                </CardTitle>
                {isSuperset && (
                  <Badge variant="secondary" className="text-[10px]">
                    Superset
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {block.exercises.map((ex) => {
                const detail = detailMap.get(ex.movementId);
                const name = detail?.name ?? ex.movementId;
                const muscles = detail?.muscleGroups ?? [];
                const setRepLabel = formatSetRep(ex.sets, ex.reps, ex.duration);

                return (
                  <div
                    key={ex.movementId}
                    className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2"
                  >
                    {/* Thumbnail */}
                    {detail?.thumbnailMediaUrl ? (
                      <Image
                        src={detail.thumbnailMediaUrl}
                        alt={name}
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded bg-muted object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded bg-muted" aria-hidden />
                    )}

                    {/* Name + muscles */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{name}</p>
                      {muscles.length > 0 && (
                        <p className="truncate text-xs text-muted-foreground">
                          {muscles.join(", ")}
                        </p>
                      )}
                    </div>

                    {/* Sets x reps */}
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {setRepLabel}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
