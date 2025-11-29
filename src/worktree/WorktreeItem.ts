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
		this.tooltip = node.path;
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
}
