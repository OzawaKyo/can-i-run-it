import { writeFile } from 'node:fs/promises';
import { calibrateGpuScore } from './hardware/calibrate-gpu-score';

/** Refits the GPU score to the anchors in gpu-anchors.ts and saves the result for scoreGpu. */
async function main() {
  const { calibration, errors } = calibrateGpuScore();
  await writeFile(
    'apps/data-pipeline/src/hardware/gpu-calibration.json',
    `${JSON.stringify(calibration, null, 2)}\n`,
  );
  for (const { anchor, error } of errors
    .sort((a, b) => Math.abs(b.error) - Math.abs(a.error))
    .slice(0, 10)) {
    console.log(`${(error * 100).toFixed(1).padStart(6)}%  ${anchor}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
