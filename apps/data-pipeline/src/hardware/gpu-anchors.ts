/**
 * Gaming equivalences the GPU score is calibrated on: `a ≈ ratio × b`, as widely reported
 * by game benchmark roundups (averages over many titles at 1080p). Specs are boost FP32
 * throughput and memory bandwidth as Wikipedia lists them.
 */

export interface AnchorGpu {
  name: string;
  fp32Gflops: number;
  /** Omitted for integrated GPUs, whose bandwidth is the system memory's. */
  bandwidthGBs?: number;
  architecture: string;
}

export interface GpuAnchor {
  a: AnchorGpu;
  b: AnchorGpu;
  ratio: number;
}

const gpu = (
  name: string,
  fp32Gflops: number,
  bandwidthGBs: number | undefined,
  architecture: string,
): AnchorGpu => ({
  name,
  fp32Gflops,
  bandwidthGBs,
  architecture,
});

// NVIDIA
const gtx260 = gpu('GeForce GTX 260 Core 216', 805, 112, 'Tesla');
const gtx285 = gpu('GeForce GTX 285', 1063, 159, 'Tesla');
const gtx460 = gpu('GeForce GTX 460 1GB', 907, 115, 'Fermi');
const gtx480 = gpu('GeForce GTX 480', 1345, 177, 'Fermi');
const gtx570 = gpu('GeForce GTX 570', 1405, 152, 'Fermi');
const gtx580 = gpu('GeForce GTX 580', 1581, 192, 'Fermi');
const gtx660 = gpu('GeForce GTX 660', 1882, 144, 'Kepler');
const gtx680 = gpu('GeForce GTX 680', 3250, 192, 'Kepler');
const gtx780ti = gpu('GeForce GTX 780 Ti', 5345, 336, 'Kepler');
const gtx960 = gpu('GeForce GTX 960', 2413, 112, 'Maxwell');
const gtx970 = gpu('GeForce GTX 970', 3920, 224, 'Maxwell');
const gtx980ti = gpu('GeForce GTX 980 Ti', 6060, 336, 'Maxwell');
const gt1030 = gpu('GeForce GT 1030 GDDR5', 1127, 48, 'Pascal');
const gt1030ddr4 = gpu('GeForce GT 1030 DDR4', 1059, 16.8, 'Pascal');
const gtx1050ti = gpu('GeForce GTX 1050 Ti', 2138, 112, 'Pascal');
const gtx1060 = gpu('GeForce GTX 1060 6GB', 4372, 192, 'Pascal');
const gtx1060_3gb = gpu('GeForce GTX 1060 3GB', 3935, 192, 'Pascal');
const gtx1050 = gpu('GeForce GTX 1050', 1862, 112, 'Pascal');
const gtx1080ti = gpu('GeForce GTX 1080 Ti', 11340, 484, 'Pascal');
const gtx750ti = gpu('GeForce GTX 750 Ti', 1389, 86.4, 'Maxwell');
const gtx1070 = gpu('GeForce GTX 1070', 6463, 256, 'Pascal');
const gtx1080 = gpu('GeForce GTX 1080', 8873, 320, 'Pascal');
const gtx1650 = gpu('GeForce GTX 1650', 2849, 128, 'Turing');
const gtx1660 = gpu('GeForce GTX 1660', 5027, 192, 'Turing');
const gtx1660super = gpu('GeForce GTX 1660 Super', 5027, 336, 'Turing');
const rtx2060 = gpu('GeForce RTX 2060', 6451, 336, 'Turing');
const rtx2070 = gpu('GeForce RTX 2070', 7465, 448, 'Turing');
const rtx2080ti = gpu('GeForce RTX 2080 Ti', 13448, 616, 'Turing');
const rtx3050 = gpu('GeForce RTX 3050 8GB', 9098, 224, 'Ampere');
const rtx3060 = gpu('GeForce RTX 3060 12GB', 12738, 360, 'Ampere');
const rtx3070 = gpu('GeForce RTX 3070', 20314, 448, 'Ampere');
const rtx4060 = gpu('GeForce RTX 4060', 15114, 272, 'Ada Lovelace');
const rtx4070super = gpu('GeForce RTX 4070 Super', 35480, 504, 'Ada Lovelace');
const rtx5070 = gpu('GeForce RTX 5070', 30870, 672, 'Blackwell');
const rtx5070ti = gpu('GeForce RTX 5070 Ti', 43940, 896, 'Blackwell');
// AMD
const hd4870 = gpu('Radeon HD 4870', 1200, 115, 'TeraScale 1');
const hd5870 = gpu('Radeon HD 5870', 2720, 154, 'TeraScale 2');
const hd6970 = gpu('Radeon HD 6970', 2703, 176, 'TeraScale 3');
const hd7970ghz = gpu('Radeon HD 7970 GHz', 4301, 288, 'GCN 1');
const hd7850 = gpu('Radeon HD 7850', 1761, 153.6, 'GCN 1');
const r9270x = gpu('Radeon R9 270X', 2688, 179, 'GCN 1');
const r9290 = gpu('Radeon R9 290', 4849, 320, 'GCN 2');
const r9290x = gpu('Radeon R9 290X', 5632, 320, 'GCN 2');
const furyX = gpu('Radeon R9 Fury X', 8602, 512, 'GCN 3');
const rx580 = gpu('Radeon RX 580 8GB', 6175, 256, 'GCN 4');
const rx570 = gpu('Radeon RX 570 4GB', 5095, 224, 'GCN 4');
const rx560 = gpu('Radeon RX 560 4GB', 2611, 112, 'GCN 4');
const vega56 = gpu('Radeon RX Vega 56', 10544, 410, 'GCN 5');
const rx5700xt = gpu('Radeon RX 5700 XT', 9754, 448, 'RDNA 1');
const rx5500xt = gpu('Radeon RX 5500 XT 8GB', 5196, 224, 'RDNA 1');
const rx6600 = gpu('Radeon RX 6600', 8928, 224, 'RDNA 2');
const rx6650xt = gpu('Radeon RX 6650 XT', 10790, 280, 'RDNA 2');
const rx7600 = gpu('Radeon RX 7600', 21750, 288, 'RDNA 3');
const rx9070xt = gpu('Radeon RX 9070 XT', 48660, 640, 'RDNA 4');
// Intel
const uhd630 = gpu('UHD Graphics 630', 384, undefined, 'Gen9');
const arcA770 = gpu('Arc A770 16GB', 19660, 560, 'Xe-HPG');
const arcB580 = gpu('Arc B580', 13670, 456, 'Xe2-HPG');

/**
 * Deliberately left out: the RX 6500 XT, whose PCIe x4 link and 64-bit bus starve it in
 * ways a bandwidth figure can't express (its Infinity Cache hides the bus on paper).
 */
export const GPU_ANCHORS: GpuAnchor[] = [
  // NVIDIA generations
  { a: gtx1060, b: gtx970, ratio: 1.12 },
  { a: gtx1070, b: gtx1060, ratio: 1.38 },
  { a: gtx1080, b: gtx1070, ratio: 1.25 },
  { a: gtx1050ti, b: gtx1060, ratio: 0.59 },
  { a: gt1030, b: gtx1050ti, ratio: 0.5 },
  { a: gt1030ddr4, b: gt1030, ratio: 0.6 },
  { a: gtx980ti, b: gtx1070, ratio: 0.98 },
  { a: gtx960, b: gtx970, ratio: 0.67 },
  { a: gtx780ti, b: gtx970, ratio: 0.95 },
  { a: gtx680, b: gtx780ti, ratio: 0.75 },
  { a: gtx660, b: gtx680, ratio: 0.74 },
  { a: gtx580, b: gtx660, ratio: 1 },
  { a: gtx480, b: gtx580, ratio: 0.87 },
  { a: gtx570, b: gtx580, ratio: 0.9 },
  { a: gtx460, b: gtx480, ratio: 0.75 },
  { a: gtx285, b: gtx460, ratio: 0.9 },
  { a: gtx260, b: gtx285, ratio: 0.8 },
  { a: rtx2060, b: gtx1080, ratio: 0.93 },
  { a: rtx2070, b: rtx2060, ratio: 1.17 },
  { a: gtx1660, b: gtx1060, ratio: 1.15 },
  { a: gtx1660super, b: gtx1660, ratio: 1.15 },
  { a: gtx1650, b: gtx1050ti, ratio: 1.3 },
  { a: rtx3060, b: rtx2070, ratio: 1 },
  { a: rtx3070, b: rtx2060, ratio: 1.6 },
  { a: rtx4060, b: rtx3060, ratio: 1.18 },
  { a: rtx4070super, b: rtx3070, ratio: 1.45 },
  { a: rtx5070, b: rtx4070super, ratio: 0.97 },
  { a: rtx5070ti, b: rtx5070, ratio: 1.2 },
  { a: gtx1050, b: gtx1050ti, ratio: 0.8 },
  { a: gtx750ti, b: gtx1050, ratio: 0.7 },
  { a: gtx1080ti, b: gtx1080, ratio: 1.28 },
  { a: rtx2080ti, b: rtx2070, ratio: 1.45 },
  { a: rtx3050, b: gtx1660super, ratio: 0.95 },
  // AMD against NVIDIA
  { a: rx580, b: gtx1060, ratio: 1 },
  { a: rx570, b: gtx1060_3gb, ratio: 1 },
  { a: rx560, b: gtx1050, ratio: 0.95 },
  { a: hd7850, b: gtx660, ratio: 0.85 },
  { a: r9270x, b: gtx660, ratio: 1.05 },
  { a: rx5500xt, b: gtx1060, ratio: 1.05 },
  { a: r9290, b: gtx970, ratio: 0.95 },
  { a: r9290x, b: gtx780ti, ratio: 1.05 },
  { a: hd7970ghz, b: r9290, ratio: 0.8 },
  { a: furyX, b: gtx980ti, ratio: 0.95 },
  { a: vega56, b: gtx1070, ratio: 1.05 },
  { a: rx5700xt, b: rtx2070, ratio: 1.05 },
  { a: rx6600, b: rtx3060, ratio: 0.92 },
  { a: rx6650xt, b: rx6600, ratio: 1.22 },
  { a: rx7600, b: rx6650xt, ratio: 1.05 },
  { a: rx9070xt, b: rtx5070ti, ratio: 1.02 },
  { a: hd4870, b: gtx260, ratio: 1 },
  { a: hd5870, b: gtx480, ratio: 0.88 },
  { a: hd6970, b: gtx570, ratio: 1 },
  // Intel against NVIDIA
  { a: arcA770, b: rtx3060, ratio: 1.1 },
  { a: arcB580, b: rtx4060, ratio: 1.1 },
  { a: uhd630, b: gt1030, ratio: 0.33 },
];
