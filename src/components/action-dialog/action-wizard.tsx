"use client";

import { Fragment, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ActionDialogBody, ActionDialogFooter } from "./action-dialog";

export interface ActionWizardStep {
  id: string;
  label: string;
}

interface ActionWizardProps {
  steps: ActionWizardStep[];
  currentStepIndex: number;
  onBack: () => void;
  onNext: () => void;
  onComplete: () => void;
  onCancel: () => void;
  canAdvance: boolean;
  isSubmitting?: boolean;
  completeLabel?: string;
  completeIcon?: ReactNode;
  submittingLabel?: string;
  children: ReactNode;
  slideDirection?: "left" | "right";
}

export function ActionWizard({
  steps,
  currentStepIndex,
  onBack,
  onNext,
  onComplete,
  onCancel,
  canAdvance,
  isSubmitting,
  completeLabel = "Launch",
  completeIcon,
  submittingLabel = "Launching...",
  children,
  slideDirection = "left",
}: ActionWizardProps) {
  const totalSteps = steps.length;
  const isLastStep = currentStepIndex === totalSteps - 1;
  const isFirstStep = currentStepIndex === 0;

  return (
    <>
      <div className="relative shrink-0 px-8 pt-2 pb-5">
        <div className="flex items-start">
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isComplete = index < currentStepIndex;
            const isLast = index === totalSteps - 1;

            return (
              <Fragment key={step.id}>
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                      isActive &&
                        "bg-primary text-primary-foreground shadow-[0_0_18px_color-mix(in_oklch,var(--primary)_55%,transparent)]",
                      isComplete && "bg-primary/80 text-primary-foreground",
                      !isActive && !isComplete && "bg-muted text-muted-foreground",
                    )}
                  >
                    {isComplete ? "\u2713" : index + 1}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium whitespace-nowrap transition-colors",
                      isActive || isComplete
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {!isLast ? (
                  <div className="relative mx-3 mt-[15px] h-0.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-out",
                        isComplete ? "w-full" : "w-0",
                      )}
                    />
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes aw-slide-left {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes aw-slide-right {
          from { opacity: 0; transform: translateX(-16px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <ActionDialogBody key={currentStepIndex} className="py-4">
        <div
          style={{
            animation: `aw-slide-${slideDirection} 220ms ease-out`,
          }}
        >
          {children}
        </div>
      </ActionDialogBody>

      <ActionDialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          <X className="size-4" />
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          {!isFirstStep ? (
            <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : null}
          {isLastStep ? (
            <Button onClick={onComplete} disabled={!canAdvance || isSubmitting}>
              {completeIcon}
              {isSubmitting ? submittingLabel : completeLabel}
            </Button>
          ) : (
            <Button onClick={onNext} disabled={!canAdvance || isSubmitting}>
              Next
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </ActionDialogFooter>
    </>
  );
}
