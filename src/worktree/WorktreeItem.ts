import * as vscode from 'vscode';

export interface WorktreeNode {
	label: string;
	description?: string;
	path: string;
	services?: Array<{ name: string; port: number; type?: string; location?: string }>;
	children?: WorktreeNode[];
	branch?: string;
	offset?: number;
	statusCount?: number;
	daysSinceCreated?: number;
	createdAt?: number;
	tooltip?: string;
	contextValue?: string;
}

export class WorktreeItem extends vscode.TreeItem {
	public readonly children: WorktreeItem[];
	public readonly node: WorktreeNode;

	constructor(node: WorktreeNode) {
		super(
			node.label,
			node.children && node.children.length > 0
				? vscode.TreeItemCollapsibleState.Expanded
				: vscode.TreeItemCollapsibleState.None,
		);

		this.node = node;
		this.description = node.description;
		this.tooltip = node.tooltip ?? this.buildTooltip(node);
		this.resourceUri = vscode.Uri.file(node.path);
		this.contextValue = node.contextValue;
		if (node.contextValue === 'gitPortree.worktree') {
			this.command = {
				command: 'gitPortree.openWorktree',
				title: 'Open Worktree',
				arguments: [this],
			};
		}
		this.children = (node.children ?? []).map((child) => new WorktreeItem(child));
	}

	private buildTooltip(node: WorktreeNode): string {
		const lines: string[] = [];
		lines.push(`Worktree: ${node.branch ?? node.label}`);
		lines.push(`Path: ${node.path}`);
		if (typeof node.offset === 'number') {
			lines.push(`Offset: ${node.offset}`);
		}
		if (node.services?.length) {
			lines.push('Services:');
			node.services.forEach((service) => {
				lines.push(`  ${service.name}: ${service.port}`);
			});
		}
		if (node.createdAt) {
			lines.push(`Updated: ${new Date(node.createdAt).toLocaleString()}`);
		}
		lines.push(
			`Status: ${node.statusCount && node.statusCount > 0 ? `dirty (${node.statusCount})` : 'clean'}`,
		);
		return lines.join('\n');
	}
}
