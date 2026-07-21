import type { EnvConfig } from "@/config/env.config";
import type { User } from "@/domain/entities/user";
import type { ContactSync } from "@/domain/services/contact-sync";
import type { Logger } from "@/domain/services/logger";

const CONTACTS_ENDPOINT = "https://api.brevo.com/v3/contacts";
const REQUEST_TIMEOUT_MS = 5000;

export class BrevoContactSync implements ContactSync {
  private readonly logger: Logger;

  constructor(private readonly env: EnvConfig, logger: Logger) {
    this.logger = logger.scope("brevo");
  }

  async syncUser(user: User): Promise<void> {
    if (!this.env.BREVO_API_KEY || !this.env.BREVO_LIST_ID) {
      return;
    }

    try {
      const response = await fetch(CONTACTS_ENDPOINT, {
        method: "POST",
        headers: {
          "api-key": this.env.BREVO_API_KEY,
          "content-type": "application/json",
          accept: "application/json"
        },

        body: JSON.stringify({
          email: user.email,
          attributes: { FIRSTNAME: user.name },
          listIds: [this.env.BREVO_LIST_ID],
          updateEnabled: true
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        this.logger.warn(
          `Contact sync rejected for ${user.email} (${response.status}): ${this.logger.preview(body)}`
        );
        return;
      }

      this.logger.info(`Synced contact ${user.email} to list ${this.env.BREVO_LIST_ID}.`);
    } catch (error) {
      this.logger.warn(`Contact sync failed for ${user.email}`, error);
    }
  }
}
