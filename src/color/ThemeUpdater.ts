import * as vscode from 'vscode';
import { GeneratedColor } from './ColorGenerator';

export class ThemeUpdater {
	constructor(private readonly workspace: typeof vscode.workspace = vscode.workspace) {}

	async apply(color: GeneratedColor): Promise<void> {
		const config = this.workspace.getConfiguration();
		const current = config.get<Record<string, string>>('workbench.colorCustomizations') ?? {};
		const next = {
			...current,
			'activityBar.background': color.activityBar,
			'statusBar.background': color.statusBar,
			'titleBar.activeBackground': color.titleBar,
		};

		await config.update('workbench.colorCustomizations', next, vscode.ConfigurationTarget.Workspace);
	}
}
