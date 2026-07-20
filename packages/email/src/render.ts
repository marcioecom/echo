import type { ReactElement } from "react";
import { render } from "react-email";

export async function renderEmail(component: ReactElement): Promise<string> {
	return render(component);
}
