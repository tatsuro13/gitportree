export type ColorTheme = 'blue' | 'green' | 'yellow';

export interface GeneratedColor {
	activityBar: string;
	statusBar: string;
	titleBar: string;
}

export class ColorGenerator {
	generate(branchName: string): GeneratedColor {
		const theme = this.pickTheme(branchName);
		const hue = this.randomHue(theme, branchName);
		const saturation = 45;
		const lightness = 38;

		const hex = this.hslToHex(hue, saturation, lightness);
		return {
			activityBar: hex,
			statusBar: hex,
			titleBar: hex,
		};
	}

	private pickTheme(branch: string): ColorTheme {
		const hash = this.hash(branch);
		const index = hash % 3;
		return ['blue', 'green', 'yellow'][index] as ColorTheme;
	}

	private randomHue(theme: ColorTheme, seed: string): number {
		const hash = this.hash(seed);
		const ranges: Record<ColorTheme, [number, number]> = {
			blue: [200, 240],
			green: [100, 150],
			yellow: [40, 70],
		};
		const [min, max] = ranges[theme];
		return min + (hash % (max - min));
	}

	private hslToHex(h: number, s: number, l: number): string {
		s /= 100;
		l /= 100;
		const k = (n: number) => (n + h / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		const f = (n: number) =>
			l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
		const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
		return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
	}

	private hash(value: string): number {
		let h = 0;
		for (let i = 0; i < value.length; i += 1) {
			h = (Math.imul(17, h) + value.charCodeAt(i)) | 0;
		}
		return Math.abs(h);
	}
}
