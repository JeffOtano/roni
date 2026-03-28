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
  coachingCue?: string;
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
                // Use movementDetails (LLM-prescribed) for sets/reps, not block defaults
                const sets = detail?.sets ?? ex.sets;
                const reps = detail?.reps ?? ex.reps;
                const duration = detail?.duration ?? ex.duration;
                const setRepLabel = formatSetRep(sets, reps, duration);

                return (
                  <div
                    key={ex.movementId}
                    className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3"
                  >
                    {/* Thumbnail */}
                    {detail?.thumbnailMediaUrl ? (
                      <Image
                        src={detail.thumbnailMediaUrl}
                        alt={name}
                        width={48}
                        height={48}
                        unoptimized
                        className="h-12 w-12 shrink-0 rounded bg-muted object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded bg-muted" aria-hidden />
                    )}

                    {/* Name + muscles + cue */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-foreground">{name}</p>
                      {muscles.length > 0 && (
                        <p className="truncate text-sm text-muted-foreground">
                          {muscles.join(", ")}
                        </p>
                      )}
                      {detail?.coachingCue && (
                        <p className="mt-0.5 text-xs italic text-primary/70">
                          {detail.coachingCue}
                        </p>
                      )}
                    </div>

                    {/* Sets x reps */}
                    <span className="shrink-0 text-base font-medium tabular-nums text-muted-foreground">
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
