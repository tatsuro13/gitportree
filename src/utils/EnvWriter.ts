import * as fs from 'fs/promises';
import * as path from 'path';

export interface EnvMap {
	[key: string]: string | number;
}

export class EnvWriter {
	constructor(private readonly root: string) {}

	async write(relativePath: string, values: EnvMap): Promise<void> {
		const target = path.join(this.root, relativePath);
		const content = Object.entries(values)
			.map(([key, value]) => `${key}=${value}`)
			.join('\n');

		await fs.mkdir(path.dirname(target), { recursive: true });
		await fs.writeFile(target, content, 'utf8');
	}
}
