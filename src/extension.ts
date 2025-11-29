import * as vscode from 'vscode';
import { WorktreeProvider } from './worktree/WorktreeProvider';

export function activate(context: vscode.ExtensionContext) {
	const provider = new WorktreeProvider();

	vscode.window.registerTreeDataProvider('gitPortree.worktrees', provider);

	context.subscriptions.push(
		vscode.commands.registerCommand('gitPortree.refresh', () => provider.refresh()),
		vscode.commands.registerCommand('gitPortree.openWorktree', (item) => provider.open(item)),
		vscode.commands.registerCommand('gitPortree.createWorktree', () => provider.create()),
		vscode.commands.registerCommand('gitPortree.removeWorktree', (item) => provider.remove(item)),
		vscode.commands.registerCommand('gitPortree.copyPortInfo', (item) => provider.copyPortInfo(item)),
	);
}

export function deactivate() {}
