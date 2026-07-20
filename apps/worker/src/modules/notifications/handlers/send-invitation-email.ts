import { sendInvitationEmailJobSchema } from "@workspace/domain";
import { InviteEmail, type Resend, renderEmail } from "@workspace/email";
import type { Job } from "bullmq";

export interface SendInvitationEmailDependencies {
	resend: Pick<Resend, "emails">;
	emailFrom: string;
}

export async function handleSendInvitationEmail(
	job: Job,
	dependencies: SendInvitationEmailDependencies,
): Promise<void> {
	const payload = sendInvitationEmailJobSchema.parse(job.data);

	const html = await renderEmail(
		InviteEmail({
			inviterName: payload.inviterName,
			organizationName: payload.organizationName,
			inviteUrl: payload.inviteUrl,
		}),
	);

	const { error } = await dependencies.resend.emails.send({
		from: dependencies.emailFrom,
		to: payload.email,
		subject: `${payload.inviterName} invited you to ${payload.organizationName} on Echo`,
		html,
	});

	if (error) {
		throw new Error(`resend delivery failed: ${error.message}`);
	}
}
