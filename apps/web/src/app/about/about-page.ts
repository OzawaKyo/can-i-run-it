import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** How verdicts are made, their limits, data sources and licences, privacy. */
@Component({
  selector: 'app-about-page',
  imports: [TranslocoPipe],
  templateUrl: './about-page.html',
  styleUrl: './about-page.scss',
})
export class AboutPage {
  protected readonly sections = ['how', 'levels', 'limits', 'sources', 'privacy'] as const;
}
