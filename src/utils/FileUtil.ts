import * as fs from 'fs/promises';

export class FileUtil {
	static async exists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	static async read(filePath: string): Promise<string> {
		return fs.readFile(filePath, 'utf8');
	}

	static async backup(filePath: string): Promise<void> {
		if (!(await FileUtil.exists(filePath))) {
			return;
		}

		const content = await FileUtil.read(filePath);
		await fs.writeFile(`${filePath}.bak`, content, 'utf8');
	}
}
