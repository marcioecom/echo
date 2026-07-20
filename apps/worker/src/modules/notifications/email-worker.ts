import { emailJobNames, emailQueueName } from "@workspace/domain";
import { createResendClient } from "@workspace/email";
import { Worker } from "bullmq";
import type { Redis } from "ioredis";

import { handleSendInvitationEmail } from "./handlers/send-invitation-email";

export interface EmailWorkerOptions {
	connection: Redis;
	resendApiKey: string;
	emailFrom: string;
}

export function createEmailWorker(options: EmailWorkerOptions): Worker {
	const resend = createResendClient(options.resendApiKey);

	return new Worker(
		emailQueueName,
		async (job) => {
			if (job.name === emailJobNames.sendInvitationEmail) {
				console.log("chegou o job")
				await handleSendInvitationEmail(job, {
					resend,
					emailFrom: options.emailFrom,
				});
				return;
			}
			throw new Error(`unknown email job: ${job.name}`);
		},
		{ connection: options.connection },
	);
}
