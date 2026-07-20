import {
	emailJobNames,
	emailQueueName,
	sendInvitationEmailJobSchema,
	type SendInvitationEmailJob,
} from "@workspace/domain";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export interface EmailQueue {
	enqueueSendInvitationEmail: (job: SendInvitationEmailJob) => Promise<void>;
	close: () => Promise<void>;
}

export function createEmailQueue(connection: Redis): EmailQueue {
	const queue = new Queue(emailQueueName, { connection });

	return {
		async enqueueSendInvitationEmail(job) {
			console.log({ job })
			const payload = sendInvitationEmailJobSchema.parse(job);
			await queue.add(emailJobNames.sendInvitationEmail, payload, {
				attempts: 3,
				backoff: { type: "exponential", delay: 1_000 },
			});
		},
		close: () => queue.close(),
	};
}
