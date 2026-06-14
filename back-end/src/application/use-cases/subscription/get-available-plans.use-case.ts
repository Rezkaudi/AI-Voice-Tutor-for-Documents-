import type { PlanOptionDto } from "@/application/dto/billing-dto";
import { CREDIT_PACKAGES } from "@/config/credit-packages.config";
import { SUBSCRIPTION_PLANS } from "@/config/subscription-plans.config";

export class GetAvailablePlansUseCase {

  execute(): PlanOptionDto[] {
    const subscriptions: PlanOptionDto[] = Object.values(SUBSCRIPTION_PLANS).map(
      (plan) => ({
        id: plan.id,
        name: plan.name,
        credits: plan.credits,
        amount: plan.amount,
        currency: plan.currency,
        recurring: true
      })
    );
    const packages: PlanOptionDto[] = Object.values(CREDIT_PACKAGES).map(
      (pkg) => ({
        id: pkg.id,
        name: pkg.name,
        credits: pkg.credits,
        amount: pkg.amount,
        currency: pkg.currency,
        recurring: false
      })
    );
    return [...subscriptions, ...packages];
  }
}
