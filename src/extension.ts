import * as vscode from 'vscode';
import { WorktreeProvider } from './worktree/WorktreeProvider';

export function activate(context: vscode.ExtensionContext) {
	if (!vscode.workspace.workspaceFolders?.length) {
		vscode.window.showWarningMessage('GitPortree requires an open workspace folder.');
		return;
	}

	const provider = new WorktreeProvider({ memento: context.globalState });
	vscode.window.registerTreeDataProvider('gitPortree.worktrees', provider);

	context.subscriptions.push(
		provider,
		vscode.commands.registerCommand('gitPortree.refresh', () => provider.refresh()),
		vscode.commands.registerCommand('gitPortree.openWorktree', (item) => provider.open(item)),
		vscode.commands.registerCommand('gitPortree.createWorktree', () => provider.create()),
		vscode.commands.registerCommand('gitPortree.removeWorktree', (item) => provider.remove(item)),
		vscode.commands.registerCommand('gitPortree.copyPortInfo', (item) => provider.copyPortInfo(item)),
		vscode.commands.registerCommand('gitPortree.changeWorktree', (item) => provider.changeWorktree(item)),
	);
}

export function deactivate() {}
