import type { StepResult, StopCondition, ToolSet } from "ai";
import type { ProviderId } from "./providers";

interface ProviderBudgetCapConfig {
  maxInteractionUsd: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

const PROVIDER_BUDGET_CAPS: Record<ProviderId, ProviderBudgetCapConfig> = {
  gemini: {
    maxInteractionUsd: 0.1,
    inputUsdPerMillion: 0.5,
    outputUsdPerMillion: 3,
  },
  claude: {
    maxInteractionUsd: 0.1,
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
  },
  openai: {
    maxInteractionUsd: 0.1,
    inputUsdPerMillion: 2.5,
    outputUsdPerMillion: 15,
  },
  // `openrouter/auto` routes across different providers at the selected model's
  // price. Use a conservative ceiling so BYOK users are protected even when the
  // router picks a more expensive backend.
  openrouter: {
    maxInteractionUsd: 0.1,
    inputUsdPerMillion: 5,
    outputUsdPerMillion: 25,
  },
};

export interface BudgetCapTrip {
  estimatedCostUsd: number;
  modelId?: string;
  stepCount: number;
}

export function estimateInteractionCostUsd(
  steps: ReadonlyArray<Pick<StepResult<ToolSet>, "usage">>,
  config: ProviderBudgetCapConfig,
): number {
  return steps.reduce((total, step) => {
    const inputTokens = step.usage?.inputTokens ?? 0;
    const outputTokens = step.usage?.outputTokens ?? 0;
    return (
      total +
      (inputTokens * config.inputUsdPerMillion + outputTokens * config.outputUsdPerMillion) /
        1_000_000
    );
  }, 0);
}

function getStepModelId(step: StepResult<ToolSet>): string | undefined {
  const responseModel = (step.response as { model?: { modelId?: string } })?.model;
  return responseModel?.modelId ?? step.model?.modelId;
}

export function budgetCapStopCondition(
  provider: ProviderId,
  onTrip?: (trip: BudgetCapTrip) => void,
): StopCondition<ToolSet> {
  const config = PROVIDER_BUDGET_CAPS[provider];
  let tripped = false;

  return ({ steps }) => {
    if (tripped) return true;

    const estimatedCostUsd = estimateInteractionCostUsd(steps, config);
    if (estimatedCostUsd < config.maxInteractionUsd) return false;

    tripped = true;
    const lastStep = steps[steps.length - 1];
    onTrip?.({
      estimatedCostUsd,
      modelId: lastStep ? getStepModelId(lastStep) : undefined,
      stepCount: steps.length,
    });
    return true;
  };
}
