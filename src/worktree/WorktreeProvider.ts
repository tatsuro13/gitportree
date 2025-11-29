import * as vscode from 'vscode';
import { WorktreeItem, WorktreeNode } from './WorktreeItem';
import { WorktreeScanner } from './WorktreeScanner';

export class WorktreeProvider
	implements vscode.TreeDataProvider<WorktreeItem>
{
	private readonly changeEmitter = new vscode.EventEmitter<WorktreeItem | void>();
	readonly onDidChangeTreeData = this.changeEmitter.event;

	constructor(private readonly scanner = WorktreeProvider.createScanner()) {}

	refresh(): void {
		this.changeEmitter.fire();
	}

	async open(item: WorktreeItem): Promise<void> {
		if (!item?.resourceUri) {
			return;
		}
		await vscode.commands.executeCommand('vscode.openFolder', item.resourceUri, true);
	}

	async create(): Promise<void> {
		await vscode.window.showInformationMessage('Create Worktree command triggered (MVP placeholder).');
	}

	async remove(item: WorktreeItem): Promise<void> {
		await vscode.window.showInformationMessage(
			`Remove Worktree command triggered for ${item?.label ?? 'unknown'} (MVP placeholder).`,
		);
	}

	async copyPortInfo(item: WorktreeItem): Promise<void> {
		const description = typeof item?.description === 'string' ? item.description : '';
		await vscode.env.clipboard.writeText(description);
		await vscode.window.showInformationMessage('Copied port info (MVP placeholder).');
	}

	getTreeItem(element: WorktreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: WorktreeItem): Promise<WorktreeItem[]> {
		if (element) {
			return element.children;
		}

		const nodes: WorktreeNode[] = await this.scanner.scan();
		return nodes.map((node) => new WorktreeItem(node));
	}

	private static createScanner(): WorktreeScanner {
		const folder = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath ?? process.cwd();
		return new WorktreeScanner(folder);
	}
}
