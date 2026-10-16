import { PC_REPORT_PREFIX } from './pc-report';

/** The systems with a full detection command. */
export type DetectOs = 'windows' | 'linux';

/** The command to paste in a terminal, and the same statements one per line to show what it does. */
export interface DetectCommand {
  command: string;
  readable: string;
}

const DONE_MESSAGE =
  'OK! Retournez sur Can I Run It? et collez (Ctrl+V) / Go back to Can I Run It? and paste (Ctrl+V)';

/**
 * Windows PowerShell (5.1+). It only reads: processor and display adapter names, installed
 * RAM, and the free space and media type of the fixed drive with the most room. It installs
 * and sends nothing; the report goes to the clipboard, for the user to paste back on the site.
 */
const WINDOWS = [
  `$cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim()`,
  `$gpus = @(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name })`,
  `$ram = [math]::Round((Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum / 1GB)`,
  `$drive = Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Sort-Object FreeSpace -Descending | Select-Object -First 1`,
  `$media = try { $n = (Get-Partition -DriveLetter $drive.DeviceID[0] | Get-Disk).Number; (Get-PhysicalDisk | Where-Object DeviceId -eq "$n").MediaType } catch { '' }`,
  `$report = @{ v = 1; cpu = $cpu; gpus = $gpus; ramGb = $ram; freeGb = [math]::Floor($drive.FreeSpace / 1GB); disk = "$media" } | ConvertTo-Json -Compress`,
  `Set-Clipboard "${PC_REPORT_PREFIX}$report"`,
  `Write-Host '${DONE_MESSAGE}'`,
];

/**
 * Linux, for bash. Same readings and same report as on Windows. GPU names come from the
 * NVIDIA driver, else from OpenGL (both the default and the PRIME-offload GPU), else from the
 * PCI bus. RAM is the usable total rounded up (the kernel keeps a little of what is installed).
 * The report is printed and, when a clipboard tool is installed, copied.
 *
 * Run through `bash -c '…'` so it works from zsh or fish too: hence no single quote, and no
 * double backslash (fish would collapse it), inside.
 */
const LINUX = [
  `c=$(grep -m1 "^model name" /proc/cpuinfo | cut -d: -f2- | sed "s/^ *//")`,
  `g=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null)`,
  `[ -z "$g" ] && g=$( (glxinfo -B; DRI_PRIME=1 glxinfo -B) 2>/dev/null | sed -n "s/.*OpenGL renderer string: //p" | sed "s|/PCIe.*||" | sort -u)`,
  `[ -z "$g" ] && g=$(lspci 2>/dev/null | sed -nE "s/.*(VGA|3D|Display)[^:]*: //p" | sed -E "s/ [(]rev [^)]*[)]$//; s/.*\\[([^]]*)\\]$/\\1/")`,
  `m=$(grep MemTotal /proc/meminfo | tr -dc 0-9); m=$(( (m + 1048575) / 1048576 ))`,
  `set -- $(df -B1 --output=avail,source -x tmpfs -x devtmpfs -x squashfs -x overlay -x efivarfs 2>/dev/null | tail -n +2 | sort -n | tail -n 1)`,
  `f=$(( \${1:-0} / 1073741824 )); k=""; case "$(lsblk -ndo ROTA "$2" 2>/dev/null | tr -d " ")" in 0) k=SSD;; 1) k=HDD;; esac`,
  `q=$(printf "%s" "$g" | tr -d "\\042\\134" | sed "/^$/d; s/.*/\\"&\\"/" | paste -sd, -)`,
  `r="${PC_REPORT_PREFIX}{\\"v\\":1,\\"cpu\\":\\"$(printf "%s" "$c" | tr -d "\\042\\134")\\",\\"gpus\\":[$q],\\"ramGb\\":$m,\\"freeGb\\":$f,\\"disk\\":\\"$k\\"}"`,
  `echo; echo "$r"; echo`,
  `if printf "%s" "$r" | (wl-copy || xclip -selection clipboard || xsel -bi) 2>/dev/null; then echo "${DONE_MESSAGE}"; else echo "Copiez la ligne ci-dessus (Ctrl+Maj+C) puis collez-la sur le site / Copy the line above (Ctrl+Shift+C) and paste it on the site"; fi`,
];

export const DETECT_COMMANDS: Record<DetectOs, DetectCommand> = {
  windows: { command: WINDOWS.join('; '), readable: WINDOWS.join('\n') },
  linux: { command: `bash -c '${LINUX.join('; ')}'`, readable: LINUX.join('\n') },
};

/** The visitor's system, from the browser; undefined when no command fits it. */
export function detectOs(userAgent: string): DetectOs | undefined {
  if (/windows/i.test(userAgent)) return 'windows';
  // Android and ChromeOS report "Linux" too, but have no terminal to run the command.
  if (/linux/i.test(userAgent) && !/android|cros/i.test(userAgent)) return 'linux';
  return undefined;
}
