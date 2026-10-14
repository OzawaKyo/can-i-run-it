import { PC_REPORT_PREFIX } from './pc-report';

/**
 * The Windows PowerShell (5.1+) command behind "full detection", one statement per line.
 * It only reads: processor and display adapter names, installed RAM, and the free space and
 * media type of the fixed drive with the most room. It installs and sends nothing; the
 * report goes to the clipboard, for the user to paste back on the site.
 */
const STATEMENTS = [
  `$cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim()`,
  `$gpus = @(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name })`,
  `$ram = [math]::Round((Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum / 1GB)`,
  `$drive = Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Sort-Object FreeSpace -Descending | Select-Object -First 1`,
  `$media = try { $n = (Get-Partition -DriveLetter $drive.DeviceID[0] | Get-Disk).Number; (Get-PhysicalDisk | Where-Object DeviceId -eq "$n").MediaType } catch { '' }`,
  `$report = @{ v = 1; cpu = $cpu; gpus = $gpus; ramGb = $ram; freeGb = [math]::Floor($drive.FreeSpace / 1GB); disk = "$media" } | ConvertTo-Json -Compress`,
  `Set-Clipboard "${PC_REPORT_PREFIX}$report"`,
  `Write-Host 'OK! Retournez sur Can I Run It? et collez (Ctrl+V) / Go back to Can I Run It? and paste (Ctrl+V)'`,
];

/** What the user pastes into PowerShell: a single line. */
export const DETECT_COMMAND = STATEMENTS.join('; ');

/** The same command, one statement per line, to show what it does. */
export const DETECT_COMMAND_READABLE = STATEMENTS.join('\n');
