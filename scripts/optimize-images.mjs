import { mkdir, readdir } from 'node:fs/promises';
import { join, parse } from 'node:path';
import sharp from 'sharp';

const tasks = [
  { input: 'mascot', output: 'mascot-optimized', width: 720, quality: 78 },
  { input: 'dashboard', output: 'dashboard-optimized', width: 1200, quality: 80 },
];

for (const task of tasks) {
  const inputDirectory = join(process.cwd(), 'public', task.input);
  const outputDirectory = join(process.cwd(), 'public', task.output);
  await mkdir(outputDirectory, { recursive: true });
  for (const file of await readdir(inputDirectory)) {
    if (!file.endsWith('.png')) continue;
    const output = join(outputDirectory, `${parse(file).name}.webp`);
    await sharp(join(inputDirectory, file))
      .resize({ width: task.width, height: task.width, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: task.quality, effort: 5, smartSubsample: true })
      .toFile(output);
    console.log(`Optimized ${task.input}/${file}`);
  }
}
