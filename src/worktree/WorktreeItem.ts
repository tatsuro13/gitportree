import * as vscode from 'vscode';

export interface WorktreeNode {
	label: string;
	description?: string;
	path: string;
	services?: Array<{ name: string; port: number }>;
	children?: WorktreeNode[];
}

export class WorktreeItem extends vscode.TreeItem {
	public readonly children: WorktreeItem[];

	constructor(node: WorktreeNode) {
		super(
			node.label,
			node.children && node.children.length > 0
				? vscode.TreeItemCollapsibleState.Expanded
				: vscode.TreeItemCollapsibleState.None,
		);

		this.description = node.description;
		this.tooltip = node.path;
		this.resourceUri = vscode.Uri.file(node.path);
		this.children = (node.children ?? []).map((child) => new WorktreeItem(child));
	}
}
